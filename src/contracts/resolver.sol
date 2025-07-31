// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// 1inch Limit Order Protocol interfaces
interface IOrderMixin {
    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;
        uint256 makingAmount;
        uint256 takingAmount;
        uint256 offsets;
        bytes interactions;
    }
}

interface ILimitOrderProtocol is IOrderMixin {
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external returns (uint256 actualMakingAmount, uint256 actualTakingAmount);
    
    function hashTypedDataV4(bytes32 structHash) external view returns (bytes32);
    
    function cancelOrder(Order calldata order) external;
    
    function remaining(bytes32 orderHash) external view returns (uint256);
}

contract Resolver is Ownable {
    using SafeERC20 for IERC20;
    
    ILimitOrderProtocol public immutable limitOrderProtocol;
    
    // Events
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed makerAsset,
        address indexed takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 actualMakingAmount,
        uint256 actualTakingAmount
    );
    
    event InventoryDeposited(address indexed token, uint256 amount);
    event InventoryWithdrawn(address indexed token, uint256 amount);
    
    constructor(address _limitOrderProtocol, address _owner) Ownable(_owner) {
        limitOrderProtocol = ILimitOrderProtocol(_limitOrderProtocol);
    }
    
    /**
     * @dev Fill a Fusion order directly via LOP
     * @param order The order structure from 1inch
     * @param signature The order signature
     * @param interaction Optional interaction data
     * @param makingAmount Amount to make (0 for full fill)
     * @param takingAmount Amount to take (0 for full fill)
     */
    function fillOrder(
        IOrderMixin.Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount
    ) external onlyOwner returns (uint256 actualMakingAmount, uint256 actualTakingAmount) {
        // Check if we have enough destination tokens in inventory
        uint256 requiredAmount = takingAmount > 0 ? takingAmount : order.takingAmount;
        require(
            IERC20(order.takerAsset).balanceOf(address(this)) >= requiredAmount,
            "Insufficient inventory"
        );
        
        // Approve LOP to spend our destination tokens
        IERC20(order.takerAsset).forceApprove(address(limitOrderProtocol), requiredAmount);
        
        // Fill the order directly via LOP
        (actualMakingAmount, actualTakingAmount) = limitOrderProtocol.fillOrder(
            order,
            signature,
            interaction,
            makingAmount,
            takingAmount,
            0 // skipPermitAndThresholdAmount
        );
        
        // Calculate order hash for event
        bytes32 orderHash = limitOrderProtocol.hashTypedDataV4(
            keccak256(abi.encode(
                keccak256("Order(uint256 salt,address makerAsset,address takerAsset,address maker,address receiver,address allowedSender,uint256 makingAmount,uint256 takingAmount,uint256 offsets,bytes interactions)"),
                order.salt,
                order.makerAsset,
                order.takerAsset,
                order.maker,
                order.receiver,
                order.allowedSender,
                order.makingAmount,
                order.takingAmount,
                order.offsets,
                keccak256(order.interactions)
            ))
        );
        
        emit OrderFilled(
            orderHash,
            order.makerAsset,
            order.takerAsset,
            makingAmount > 0 ? makingAmount : order.makingAmount,
            takingAmount > 0 ? takingAmount : order.takingAmount,
            actualMakingAmount,
            actualTakingAmount
        );
    }
    
    /**
     * @dev Batch fill multiple orders in one transaction
     */
    function fillOrders(
        IOrderMixin.Order[] calldata orders,
        bytes[] calldata signatures,
        bytes[] calldata interactions,
        uint256[] calldata makingAmounts,
        uint256[] calldata takingAmounts
    ) external onlyOwner {
        require(
            orders.length == signatures.length &&
            orders.length == interactions.length &&
            orders.length == makingAmounts.length &&
            orders.length == takingAmounts.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < orders.length; i++) {
            this.fillOrder(
                orders[i],
                signatures[i],
                interactions[i],
                makingAmounts[i],
                takingAmounts[i]
            );
        }
    }
    
    /**
     * @dev Check remaining amount for an order
     */
    function getRemainingAmount(bytes32 orderHash) external view returns (uint256) {
        return limitOrderProtocol.remaining(orderHash);
    }
    
    /**
     * @dev Cancel an order (only if we're the maker)
     */
    function cancelOrder(IOrderMixin.Order calldata order) external onlyOwner {
        limitOrderProtocol.cancelOrder(order);
    }
    
    /**
     * @dev Deposit tokens for inventory management
     */
    function depositToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit InventoryDeposited(token, amount);
    }
    
    /**
     * @dev Withdraw tokens from inventory
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
        emit InventoryWithdrawn(token, amount);
    }
    
    /**
     * @dev Emergency withdraw all tokens of a specific type
     */
    function emergencyWithdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
            emit InventoryWithdrawn(token, balance);
        }
    }
    
    /**
     * @dev Get token balance in our inventory
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @dev Emergency ETH withdrawal
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
        }
    }
    
    /**
     * @dev Approve token spending for external contracts (like DEXes)
     */
    function approveToken(address token, address spender, uint256 amount) external onlyOwner {
        IERC20(token).forceApprove(spender, amount);
    }
    
    /**
     * @dev Execute arbitrary call (for advanced strategies)
     */
    function executeCall(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Call failed");
        return result;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
    
    // Fallback function
    fallback() external payable {}
} 