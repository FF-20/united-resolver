import { ethers } from 'ethers';
import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('SimpleFusionResolver');

interface FusionOrder {
  salt: string;
  makerAsset: string;
  takerAsset: string;
  maker: string;
  receiver: string;
  allowedSender: string;
  makingAmount: string;
  takingAmount: string;
  offsets: string;
  interactions: string;
  signature: string;
  auctionDetails: {
    startAmount: string;
    endAmount: string;
    startTime: number;
    endTime: number;
    currentAmount: string;
  };
}

// ABI for our Resolver contract
const RESOLVER_ABI = [
  "function fillOrder((uint256,address,address,address,address,address,uint256,uint256,uint256,bytes) order, bytes signature, bytes interaction, uint256 makingAmount, uint256 takingAmount) external returns (uint256 actualMakingAmount, uint256 actualTakingAmount)",
  "function getTokenBalance(address token) external view returns (uint256)",
  "function depositToken(address token, uint256 amount) external",
  "function withdrawToken(address token, uint256 amount) external",
  "function emergencyWithdrawToken(address token) external"
];

export class SimpleFusionResolver {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private resolverContract: ethers.Contract;
  private isRunning = false;
  private processedOrders = new Set<string>();

  // 1inch API endpoints
  private readonly RELAYER_API = 'https://api.1inch.dev/fusion-relayer';
  
  constructor(
    provider: ethers.Provider,
    privateKey: string,
    private resolverContractAddress: string,
    private chainId: number = 1
  ) {
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.resolverContract = new ethers.Contract(
      resolverContractAddress,
      RESOLVER_ABI,
      this.wallet
    );
    
    logger.info('Simple Fusion Resolver initialized', {
      resolverAddress: this.wallet.address,
      contractAddress: resolverContractAddress,
      chainId: this.chainId
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Resolver already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Simple Fusion Resolver...');

    // Poll for new orders every 2 seconds
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.processNewOrders();
      } catch (error) {
        logger.error('Error processing orders:', error);
      }
    }, 2000);
  }

  private async processNewOrders(): Promise<void> {
    try {
      // Get pending orders from 1inch Relayer API
      const orders = await this.fetchPendingOrders();
      
      for (const order of orders) {
        if (this.processedOrders.has(order.salt)) {
          continue;
        }

        logger.info(`New order detected: ${order.salt.slice(0, 10)}...`);
        
        // For POC: Execute any order that comes in
        logger.info(`Executing order: ${order.salt.slice(0, 10)}...`);
        await this.executeOrder(order);
        
        this.processedOrders.add(order.salt);
      }
    } catch (error) {
      logger.error('Error fetching orders:', error);
    }
  }

  private async fetchPendingOrders(): Promise<FusionOrder[]> {
    // This would connect to 1inch Relayer API
    // For now, return mock data structure
    const response = await axios.get(`${this.RELAYER_API}/v1.0/${this.chainId}/orders/pending`, {
      headers: {
        'Authorization': `Bearer ${process.env.INCH_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    }).catch(() => ({ data: [] })); // Graceful fallback for testing

    return response.data || [];
  }



  private async executeOrder(order: FusionOrder): Promise<void> {
    try {
      // Check if we have enough destination tokens in our inventory
      const hasInventory = await this.checkInventory(order.takerAsset, order.auctionDetails.currentAmount);
      
      if (!hasInventory) {
        logger.warn(`Insufficient inventory for ${order.takerAsset}: ${order.salt.slice(0, 10)}...`);
        return;
      }

      // Execute the atomic swap via our resolver contract
      await this.fillOrder(order);
      
      logger.info(`Order executed successfully: ${order.salt.slice(0, 10)}...`);
    } catch (error) {
      logger.error(`Failed to execute order ${order.salt.slice(0, 10)}:`, error);
    }
  }

  private async fillOrder(order: FusionOrder): Promise<void> {
    logger.info(`Executing order via Resolver contract`, {
      userGives: `${order.makingAmount} of ${order.makerAsset}`,
      userGets: `${order.auctionDetails.currentAmount} of ${order.takerAsset}`,
      contract: this.resolverContractAddress
    });

    try {
      // Prepare order struct for contract call
      const orderStruct = [
        order.salt,
        order.makerAsset,      // What user gives us (e.g., USDC)
        order.takerAsset,      // What user wants (e.g., ETH)
        order.maker,           // User's address
        order.receiver,        // Where user gets tokens (usually same as maker)
        order.allowedSender,   // Who can fill (0x0 = anyone)
        order.makingAmount,    // How much user gives
        order.takingAmount,    // Max user wants to receive
        order.offsets,         // Packed offsets for interactions
        order.interactions     // Empty for simple orders
      ];

      // Call our resolver contract to fill the order
      const tx = await this.resolverContract.fillOrder(
        orderStruct,
        order.signature,
        "0x", // empty interaction
        0,    // makingAmount (0 = full fill)
        0     // takingAmount (0 = full fill)
      );

      logger.info(`Fill order transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      logger.info(`Order filled successfully`, {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      });

      // The atomic swap has now happened:
      // 1. User's tokens (makingAmount of makerAsset) → Our contract
      // 2. Our tokens (takingAmount of takerAsset) → User
      logger.info(`We received ${order.makingAmount} ${order.makerAsset} from user`);
      
    } catch (error) {
      logger.error(`Failed to fill order via contract:`, error);
      throw error;
    }
  }

  private async checkInventory(tokenAddress: string, requiredAmount: string): Promise<boolean> {
    try {
      logger.info(`Checking inventory for ${tokenAddress}: ${requiredAmount}`);
      
      // Check our resolver contract's token balance
      const balance = await this.resolverContract.getTokenBalance(tokenAddress);
      const hasEnough = BigInt(balance) >= BigInt(requiredAmount);
      
      logger.info(`Inventory check:`, {
        token: tokenAddress,
        required: requiredAmount,
        available: balance.toString(),
        hasEnough
      });
      
      return hasEnough;
    } catch (error) {
      logger.error('Error checking inventory:', error);
      return false;
    }
  }

  // Helper methods for inventory management
  async depositTokens(tokenAddress: string, amount: string): Promise<void> {
    try {
      logger.info(`Depositing ${amount} of ${tokenAddress} to resolver contract`);
      
      const tx = await this.resolverContract.depositToken(tokenAddress, amount);
      await tx.wait();
      
      logger.info(`Tokens deposited successfully: ${tx.hash}`);
    } catch (error) {
      logger.error('Error depositing tokens:', error);
      throw error;
    }
  }

  async withdrawTokens(tokenAddress: string, amount: string): Promise<void> {
    try {
      logger.info(`Withdrawing ${amount} of ${tokenAddress} from resolver contract`);
      
      const tx = await this.resolverContract.withdrawToken(tokenAddress, amount);
      await tx.wait();
      
      logger.info(`Tokens withdrawn successfully: ${tx.hash}`);
    } catch (error) {
      logger.error('Error withdrawing tokens:', error);
      throw error;
    }
  }

  async getInventoryBalances(tokens: string[]): Promise<Record<string, string>> {
    const balances: Record<string, string> = {};
    
    for (const token of tokens) {
      try {
        const balance = await this.resolverContract.getTokenBalance(token);
        balances[token] = balance.toString();
      } catch (error) {
        logger.error(`Error getting balance for ${token}:`, error);
        balances[token] = '0';
      }
    }
    
    return balances;
  }

  async stop(): Promise<void> {
    logger.info('Stopping Simple Fusion Resolver');
    this.isRunning = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      processedOrdersCount: this.processedOrders.size,
      resolverAddress: this.wallet.address,
      contractAddress: this.resolverContractAddress,
      chainId: this.chainId
    };
  }
} 