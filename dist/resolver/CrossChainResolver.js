"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossChainResolver = void 0;
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('CrossChainResolver');
class CrossChainResolver {
    orderMonitor;
    profitabilityAnalyzer;
    escrowExecutor;
    isRunning = false;
    processedOrders = new Set();
    activeOrders = new Map();
    constructor(orderMonitor, profitabilityAnalyzer, escrowExecutor) {
        this.orderMonitor = orderMonitor;
        this.profitabilityAnalyzer = profitabilityAnalyzer;
        this.escrowExecutor = escrowExecutor;
    }
    async initialize() {
        logger.info('🔧 Initializing resolver components...');
        await this.orderMonitor.initialize();
        await this.profitabilityAnalyzer.initialize();
        await this.escrowExecutor.initialize();
        logger.info('✅ All components initialized');
    }
    async startMonitoring() {
        if (this.isRunning) {
            logger.warn('⚠️ Resolver already running');
            return;
        }
        this.isRunning = true;
        logger.info('🔍 Starting order monitoring...');
        // Monitor for new orders every 2 seconds
        setInterval(async () => {
            if (!this.isRunning)
                return;
            try {
                await this.processNewOrders();
            }
            catch (error) {
                logger.error('❌ Error processing orders:', error);
            }
        }, 2000);
        // Check active orders every 5 seconds
        setInterval(async () => {
            if (!this.isRunning)
                return;
            try {
                await this.checkActiveOrders();
            }
            catch (error) {
                logger.error('❌ Error checking active orders:', error);
            }
        }, 5000);
    }
    async processNewOrders() {
        const orders = await this.orderMonitor.fetchPendingOrders();
        for (const order of orders) {
            if (this.processedOrders.has(order.orderHash)) {
                continue;
            }
            logger.info(`📝 New order detected: ${order.orderHash.slice(0, 10)}...`);
            await this.analyzeAndExecuteOrder(order);
            this.processedOrders.add(order.orderHash);
        }
    }
    async analyzeAndExecuteOrder(order) {
        try {
            logger.info(`🧮 Analyzing order ${order.orderHash.slice(0, 10)}...`);
            // Step 1: Analyze profitability
            const decision = await this.profitabilityAnalyzer.analyzeOrder(order);
            if (!decision.shouldFill) {
                logger.info(`❌ Order ${order.orderHash.slice(0, 10)} not profitable: ${decision.reason}`);
                return;
            }
            logger.info(`✅ Order ${order.orderHash.slice(0, 10)} is profitable:`, {
                expectedProfit: decision.expectedProfitUsd,
                profitMargin: decision.profitMarginPercent,
                estimatedGas: decision.estimatedGasCost,
                route: decision.optimalRoute
            });
            // Step 2: Execute atomic swap
            this.activeOrders.set(order.orderHash, order);
            await this.executeAtomicSwap(order, decision);
        }
        catch (error) {
            logger.error(`❌ Failed to process order ${order.orderHash.slice(0, 10)}:`, error);
        }
    }
    async executeAtomicSwap(order, decision) {
        const orderKey = order.orderHash.slice(0, 10);
        try {
            logger.info(`🔄 Starting atomic swap for order ${orderKey}...`);
            // Step 1: Lock user's tokens in source escrow
            logger.info(`🔒 Locking ${order.srcAmount} ${order.srcToken} in source escrow...`);
            const sourceEscrowTx = await this.escrowExecutor.lockSourceEscrow(order, decision);
            logger.info(`📤 Source escrow transaction: ${sourceEscrowTx.hash}`);
            // Step 2: Lock resolver's tokens in destination escrow  
            logger.info(`🔒 Locking ${order.dstAmount} ${order.dstToken} in destination escrow...`);
            const destEscrowTx = await this.escrowExecutor.lockDestinationEscrow(order, decision);
            logger.info(`📤 Destination escrow transaction: ${destEscrowTx.hash}`);
            // Step 3: Wait for confirmations
            logger.info(`⏳ Waiting for escrow confirmations...`);
            await this.waitForEscrowConfirmations(sourceEscrowTx.hash, destEscrowTx.hash);
            // Step 4: Reveal secret and claim funds
            logger.info(`🔓 Revealing secret and claiming funds...`);
            await this.escrowExecutor.revealSecretAndClaim(order, decision);
            logger.info(`✅ Atomic swap completed successfully for order ${orderKey}`);
            this.activeOrders.delete(order.orderHash);
        }
        catch (error) {
            logger.error(`❌ Atomic swap failed for order ${orderKey}:`, error);
            // Handle cleanup/cancellation
            await this.handleFailedSwap(order, error);
            this.activeOrders.delete(order.orderHash);
        }
    }
    async waitForEscrowConfirmations(sourceTxHash, destTxHash) {
        const timeout = 300000; // 5 minutes
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const sourceConfirmed = await this.escrowExecutor.isTransactionConfirmed(sourceTxHash, 'source');
            const destConfirmed = await this.escrowExecutor.isTransactionConfirmed(destTxHash, 'destination');
            if (sourceConfirmed && destConfirmed) {
                logger.info('✅ Both escrows confirmed');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
        throw new Error('Escrow confirmations timed out');
    }
    async handleFailedSwap(order, error) {
        logger.warn(`🚨 Handling failed swap for ${order.orderHash.slice(0, 10)}...`);
        try {
            // Cancel any pending escrows
            await this.escrowExecutor.cancelEscrows(order);
            // Log failure for analysis
            logger.info(`🗂️ Swap failure logged for order ${order.orderHash.slice(0, 10)}`);
        }
        catch (cleanupError) {
            logger.error('❌ Error during swap cleanup:', cleanupError);
        }
    }
    async checkActiveOrders() {
        const currentTime = Date.now();
        for (const [orderHash, order] of this.activeOrders) {
            // Check if order has expired
            if (currentTime > order.deadline) {
                logger.warn(`⏰ Order ${orderHash.slice(0, 10)} expired, cleaning up...`);
                await this.handleFailedSwap(order, new Error('Order expired'));
                this.activeOrders.delete(orderHash);
            }
        }
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            processedOrdersCount: this.processedOrders.size,
            activeOrdersCount: this.activeOrders.size,
            activeOrders: Array.from(this.activeOrders.keys()).map(hash => hash.slice(0, 10))
        };
    }
    async shutdown() {
        logger.info('🛑 Shutting down resolver...');
        this.isRunning = false;
        // Wait for active orders to complete or timeout
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();
        while (this.activeOrders.size > 0 && (Date.now() - startTime) < timeout) {
            logger.info(`⏳ Waiting for ${this.activeOrders.size} active orders to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        // Force cleanup remaining orders
        for (const [orderHash, order] of this.activeOrders) {
            logger.warn(`🚨 Force cleaning up order ${orderHash.slice(0, 10)}`);
            await this.handleFailedSwap(order, new Error('Resolver shutdown'));
        }
        logger.info('✅ Resolver shutdown complete');
    }
}
exports.CrossChainResolver = CrossChainResolver;
//# sourceMappingURL=CrossChainResolver.js.map