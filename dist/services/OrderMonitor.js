"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderMonitor = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('OrderMonitor');
class OrderMonitor {
    frontendUrl;
    lastCheckedTimestamp = 0;
    constructor() {
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    }
    async initialize() {
        logger.info(`📡 Initializing order monitor for ${this.frontendUrl}`);
        // Test connection to frontend
        try {
            await axios_1.default.get(`${this.frontendUrl}/health`, { timeout: 5000 });
            logger.info('✅ Connected to frontend API');
        }
        catch (error) {
            logger.warn('⚠️ Cannot connect to frontend API, will retry during monitoring');
        }
    }
    async fetchPendingOrders() {
        try {
            // Fetch orders created after last check
            const response = await axios_1.default.get(`${this.frontendUrl}/api/resolver/orders`, {
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
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                logger.error(`❌ Failed to fetch orders: ${error.response?.status} ${error.message}`);
            }
            else {
                logger.error('❌ Unexpected error fetching orders:', error);
            }
            return [];
        }
    }
    transformOrder(rawOrder) {
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
    async submitOrder(order) {
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
        }
        catch (error) {
            logger.error('❌ Invalid order submission:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Invalid order format'
            };
        }
    }
    validateOrder(order) {
        const required = [
            'orderHash', 'maker', 'srcChainId', 'dstChainId',
            'srcToken', 'dstToken', 'srcAmount', 'dstAmount',
            'deadline', 'secretHash', 'signature'
        ];
        for (const field of required) {
            if (!order[field]) {
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
exports.OrderMonitor = OrderMonitor;
//# sourceMappingURL=OrderMonitor.js.map