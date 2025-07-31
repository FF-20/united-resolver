"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfitabilityAnalyzer = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('ProfitabilityAnalyzer');
class ProfitabilityAnalyzer {
    priceCache = new Map();
    gasCache = new Map();
    CACHE_TTL = 30000; // 30 seconds
    MIN_PROFIT_USD = 5; // Minimum $5 profit
    MIN_PROFIT_MARGIN = 0.5; // Minimum 0.5% margin
    async initialize() {
        logger.info('💰 Initializing profitability analyzer...');
        // Pre-fetch common token prices
        await this.warmupPriceCache();
        logger.info('✅ Profitability analyzer ready');
    }
    async analyzeOrder(order) {
        const startTime = Date.now();
        try {
            logger.info(`🔍 Analyzing order ${order.orderHash.slice(0, 10)}...`);
            // Step 1: Get token prices
            const [srcPrice, dstPrice] = await Promise.all([
                this.getTokenPrice(order.srcToken, order.srcChainId),
                this.getTokenPrice(order.dstToken, order.dstChainId)
            ]);
            // Step 2: Calculate USD values
            const srcAmountUsd = parseFloat(order.srcAmount) * srcPrice.priceUsd;
            const dstAmountUsd = parseFloat(order.dstAmount) * dstPrice.priceUsd;
            // Step 3: Estimate gas costs
            const gasEstimate = await this.estimateGasCosts(order);
            const totalGasCostUsd = gasEstimate.sourceGasUsd + gasEstimate.destinationGasUsd;
            // Step 4: Calculate profit
            const grossProfitUsd = srcAmountUsd - dstAmountUsd;
            const netProfitUsd = grossProfitUsd - totalGasCostUsd;
            const profitMarginPercent = (netProfitUsd / srcAmountUsd) * 100;
            // Step 5: Check liquidity availability
            const liquidityCheck = await this.checkLiquidityAvailability(order);
            // Step 6: Make decision
            const shouldFill = this.shouldFillOrder({
                netProfitUsd,
                profitMarginPercent,
                liquidityCheck,
                order
            });
            const analysisTime = Date.now() - startTime;
            const decision = {
                orderHash: order.orderHash,
                shouldFill,
                reason: shouldFill ? 'Profitable order' : this.getRejectReason(netProfitUsd, profitMarginPercent, liquidityCheck),
                expectedProfitUsd: netProfitUsd,
                profitMarginPercent,
                estimatedGasCost: totalGasCostUsd,
                srcTokenPrice: srcPrice,
                dstTokenPrice: dstPrice,
                liquidityStatus: liquidityCheck,
                optimalRoute: this.selectOptimalRoute(order),
                analysisTimeMs: analysisTime,
                timestamp: Date.now()
            };
            logger.info(`📊 Analysis complete for ${order.orderHash.slice(0, 10)}:`, {
                shouldFill,
                netProfitUsd: netProfitUsd.toFixed(2),
                profitMarginPercent: profitMarginPercent.toFixed(2),
                gasEstimateUsd: totalGasCostUsd.toFixed(2),
                analysisTimeMs: analysisTime
            });
            return decision;
        }
        catch (error) {
            logger.error(`❌ Analysis failed for ${order.orderHash.slice(0, 10)}:`, error);
            return {
                orderHash: order.orderHash,
                shouldFill: false,
                reason: `Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                expectedProfitUsd: 0,
                profitMarginPercent: 0,
                estimatedGasCost: 0,
                analysisTimeMs: Date.now() - startTime,
                timestamp: Date.now()
            };
        }
    }
    async getTokenPrice(tokenAddress, chainId) {
        const cacheKey = `${chainId}-${tokenAddress}`;
        const cached = this.priceCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            return { priceUsd: cached.price, source: 'cache' };
        }
        try {
            const price = await this.fetchTokenPrice(tokenAddress, chainId);
            this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
            return { priceUsd: price, source: 'api' };
        }
        catch (error) {
            logger.warn(`⚠️ Failed to fetch price for ${tokenAddress}, using fallback`);
            return { priceUsd: 1, source: 'fallback' }; // Fallback to $1
        }
    }
    async fetchTokenPrice(tokenAddress, chainId) {
        // Handle Cosmos tokens
        if (typeof chainId === 'string') {
            return this.fetchCosmosTokenPrice(tokenAddress);
        }
        // Handle EVM tokens via CoinGecko
        const coinGeckoIds = {
            '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'ethereum', // WETH
            '0xA0b86a33E6C30ff8f73C4F65F5642D8AE4b3cB9D': 'ethereum', // Your WETH
            '0x7b79995e5f793a07bc00c21412e50ecae098e7f9': 'ethereum', // Sepolia WETH
            '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': 'usd-coin', // BSC USDC
        };
        const coinId = coinGeckoIds[tokenAddress];
        if (!coinId) {
            throw new Error(`Unknown token: ${tokenAddress}`);
        }
        const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { timeout: 5000 });
        return response.data[coinId]?.usd || 1;
    }
    async fetchCosmosTokenPrice(denom) {
        // Handle common Cosmos tokens
        const cosmosTokens = {
            'uatom': 'cosmos',
            'uosmo': 'osmosis',
            'ujuno': 'juno-network'
        };
        const coinId = cosmosTokens[denom];
        if (!coinId) {
            logger.warn(`Unknown Cosmos token: ${denom}`);
            return 1; // Fallback
        }
        const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { timeout: 5000 });
        return response.data[coinId]?.usd || 1;
    }
    async estimateGasCosts(order) {
        const cacheKey = `gas-${order.srcChainId}-${order.dstChainId}`;
        const cached = this.gasCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            return cached.estimate;
        }
        try {
            const sourceGas = await this.estimateChainGasCost(order.srcChainId, 'escrow_lock');
            const destGas = await this.estimateChainGasCost(order.dstChainId, 'escrow_lock');
            const claimGas = await this.estimateChainGasCost(order.srcChainId, 'escrow_claim');
            const estimate = {
                sourceGasUnits: sourceGas.gasUnits,
                sourceGasPrice: sourceGas.gasPrice,
                sourceGasUsd: sourceGas.gasCostUsd,
                destinationGasUnits: destGas.gasUnits,
                destinationGasPrice: destGas.gasPrice,
                destinationGasUsd: destGas.gasCostUsd,
                claimGasUnits: claimGas.gasUnits,
                claimGasUsd: claimGas.gasCostUsd,
                totalGasUsd: sourceGas.gasCostUsd + destGas.gasCostUsd + claimGas.gasCostUsd
            };
            this.gasCache.set(cacheKey, { estimate, timestamp: Date.now() });
            return estimate;
        }
        catch (error) {
            logger.warn('⚠️ Gas estimation failed, using defaults');
            // Fallback gas estimates
            return {
                sourceGasUnits: 200000,
                sourceGasPrice: '20000000000', // 20 gwei
                sourceGasUsd: 3,
                destinationGasUnits: 100000,
                destinationGasPrice: '0.025', // Cosmos gas
                destinationGasUsd: 0.5,
                claimGasUnits: 150000,
                claimGasUsd: 2,
                totalGasUsd: 5.5
            };
        }
    }
    async estimateChainGasCost(chainId, operation) {
        // This would integrate with actual RPC endpoints
        // For now, return reasonable estimates
        if (typeof chainId === 'string') {
            // Cosmos chain
            return {
                gasUnits: 100000,
                gasPrice: '0.025uatom',
                gasCostUsd: 0.5
            };
        }
        else {
            // EVM chain
            return {
                gasUnits: operation === 'escrow_claim' ? 150000 : 200000,
                gasPrice: '20000000000', // 20 gwei
                gasCostUsd: operation === 'escrow_claim' ? 2 : 3
            };
        }
    }
    async checkLiquidityAvailability(order) {
        // Check if resolver has enough liquidity for the destination token
        // This would query the resolver's wallet balances
        return {
            hasSourceLiquidity: true,
            hasDestinationLiquidity: true,
            liquidityRatio: 1.2, // 120% of required amount
            estimatedSlippage: 0.1 // 0.1%
        };
    }
    shouldFillOrder(params) {
        const { netProfitUsd, profitMarginPercent, liquidityCheck } = params;
        // Check minimum profit thresholds
        if (netProfitUsd < this.MIN_PROFIT_USD) {
            return false;
        }
        if (profitMarginPercent < this.MIN_PROFIT_MARGIN) {
            return false;
        }
        // Check liquidity availability
        if (!liquidityCheck.hasSourceLiquidity || !liquidityCheck.hasDestinationLiquidity) {
            return false;
        }
        return true;
    }
    getRejectReason(netProfitUsd, profitMarginPercent, liquidityCheck) {
        if (netProfitUsd < this.MIN_PROFIT_USD) {
            return `Insufficient profit: $${netProfitUsd.toFixed(2)} < $${this.MIN_PROFIT_USD}`;
        }
        if (profitMarginPercent < this.MIN_PROFIT_MARGIN) {
            return `Low margin: ${profitMarginPercent.toFixed(2)}% < ${this.MIN_PROFIT_MARGIN}%`;
        }
        if (!liquidityCheck.hasDestinationLiquidity) {
            return 'Insufficient destination liquidity';
        }
        return 'Unknown rejection reason';
    }
    selectOptimalRoute(order) {
        // For cross-chain, the route is the bridge protocol
        const routes = ['gravity', 'axelar', 'wormhole'];
        // Simple selection based on chain pair
        if (order.srcChainId === 1 && order.dstChainId === 'cosmoshub-4') {
            return 'gravity';
        }
        return 'axelar'; // Default
    }
    async warmupPriceCache() {
        const commonTokens = [
            { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', chainId: 1 }, // WETH
            { address: 'uatom', chainId: 'cosmoshub-4' }, // ATOM
            { address: 'uosmo', chainId: 'osmosis-1' } // OSMO
        ];
        await Promise.all(commonTokens.map(token => this.getTokenPrice(token.address, token.chainId).catch(() => { })));
    }
    getStats() {
        return {
            priceCacheSize: this.priceCache.size,
            gasCacheSize: this.gasCache.size,
            minProfitUsd: this.MIN_PROFIT_USD,
            minProfitMargin: this.MIN_PROFIT_MARGIN
        };
    }
}
exports.ProfitabilityAnalyzer = ProfitabilityAnalyzer;
//# sourceMappingURL=ProfitabilityAnalyzer.js.map