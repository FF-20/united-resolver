# Functional requirement
- Listen for order from relayer
    - Participate in dutch auction
- Lock maker's funds (call LOP fillorderargs)
- Create destination escrow and lock taker's funds
- Withdraw
- Withdraw for maker
- Cancelation (refunds funds)
- Handle timeout

# Data needed for making escrow
## Solidity
```
struct Order {
    uint256 salt;
    Address maker;
    Address receiver;
    Address makerAsset;
    Address takerAsset;
    uint256 makingAmount;
    uint256 takingAmount;
    MakerTraits makerTraits;
}
```
```
struct Immutables {
    bytes32 orderHash;
    bytes32 hashlock;  // Hash of the secret.
    Address maker;
    Address taker;
    Address token;
    uint256 amount;
    uint256 safetyDeposit;
    Timelocks timelocks;
}
```
bytes32 r,
bytes32 vs,
uint256 amount,
TakerTraits takerTraits,
bytes calldata args


Sepolia contract = 0x18b8b5a7FcE1397Ee62354236c9FaAd82FBf80f2
