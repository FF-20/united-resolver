import axios from 'axios';
import { createLogger } from '../utils/logger';
import { CrossChainOrder } from '../types';

const logger = createLogger('OrderMonitor');

export class OrderMonitor {
  private frontendUrl: string;
  private lastCheckedTimestamp = 0;

  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  async initialize(): Promise<void> {
    logger.info(`📡 Initializing order monitor for ${this.frontendUrl}`);
    
    // Test connection to frontend
    try {
      await axios.get(`${this.frontendUrl}/health`, { timeout: 5000 });
      logger.info('✅ Connected to frontend API');
    } catch (error) {
      logger.warn('⚠️ Cannot connect to frontend API, will retry during monitoring');
    }
  }

  async fetchPendingOrders(): Promise<CrossChainOrder[]> {
    try {
      // Fetch orders created after last check
      const response = await axios.get(`${this.frontendUrl}/api/resolver/orders`, {
        params: {
          status: 'pending',
          since: this.lastCheckedTimestamp,
          limit: 50
        },
        timeout: 10000
      });

      const orders = response.data.orders || [];
      
      if (orders.length > 0) {
        logger.info(`📥 Fetched ${orders.length} pending orders`);
        this.lastCheckedTimestamp = Date.now();
      }

      return orders.map(this.transformOrder);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`❌ Failed to fetch orders: ${error.response?.status} ${error.message}`);
      } else {
        logger.error('❌ Unexpected error fetching orders:', error);
      }
      return [];
    }
  }

  private transformOrder(rawOrder: any): CrossChainOrder {
    return {
      orderHash: rawOrder.orderHash,
      maker: rawOrder.maker,
      srcChainId: rawOrder.srcChainId,
      dstChainId: rawOrder.dstChainId,
      srcToken: rawOrder.srcToken,
      dstToken: rawOrder.dstToken,
      srcAmount: rawOrder.srcAmount,
      dstAmount: rawOrder.dstAmount,
      deadline: rawOrder.deadline,
      secretHash: rawOrder.secretHash,
      signature: rawOrder.signature,
      escrowFactory: rawOrder.escrowFactory,
      timeLocks: rawOrder.timeLocks,
      createdAt: rawOrder.createdAt,
      nonce: rawOrder.nonce,
      // Add resolver-specific fields
      status: 'pending',
      estimatedGasCost: '0',
      profitability: null
    };
  }

  // Method for frontend to submit new orders
  async submitOrder(order: CrossChainOrder): Promise<{ success: boolean; message: string }> {
    try {
      // Validate order structure
      this.validateOrder(order);
      
      logger.info(`📝 New order submitted: ${order.orderHash.slice(0, 10)}...`);
      logger.info(`🔄 Route: ${order.srcChainId} → ${order.dstChainId}`);
      logger.info(`💰 Amount: ${order.srcAmount} ${order.srcToken} → ${order.dstAmount} ${order.dstToken}`);
      
      return { 
        success: true, 
        message: `Order ${order.orderHash.slice(0, 10)} queued for processing` 
      };
    } catch (error) {
      logger.error('❌ Invalid order submission:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Invalid order format' 
      };
    }
  }

  private validateOrder(order: CrossChainOrder): void {
    const required = [
      'orderHash', 'maker', 'srcChainId', 'dstChainId', 
      'srcToken', 'dstToken', 'srcAmount', 'dstAmount', 
      'deadline', 'secretHash', 'signature'
    ];
    
    for (const field of required) {
      if (!order[field as keyof CrossChainOrder]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate deadline
    if (order.deadline <= Date.now()) {
      throw new Error('Order deadline has already passed');
    }
    
    // Validate amounts
    if (parseFloat(order.srcAmount) <= 0 || parseFloat(order.dstAmount) <= 0) {
      throw new Error('Invalid order amounts');
    }
    
    // Validate chain IDs
    const supportedChains = [1, 11155111, 56, 137, 'cosmoshub-4', 'osmosis-1'];
    if (!supportedChains.includes(order.srcChainId) || !supportedChains.includes(order.dstChainId)) {
      throw new Error('Unsupported chain ID');
    }
  }

  // Get order statistics
  getStats() {
    return {
      lastChecked: this.lastCheckedTimestamp,
      frontendUrl: this.frontendUrl
    };
  }
} 