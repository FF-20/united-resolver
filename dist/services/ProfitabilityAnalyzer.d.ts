import { CrossChainOrder, ResolverDecision } from '../types';
export declare class ProfitabilityAnalyzer {
    private priceCache;
    private gasCache;
    private readonly CACHE_TTL;
    private readonly MIN_PROFIT_USD;
    private readonly MIN_PROFIT_MARGIN;
    initialize(): Promise<void>;
    analyzeOrder(order: CrossChainOrder): Promise<ResolverDecision>;
    private getTokenPrice;
    private fetchTokenPrice;
    private fetchCosmosTokenPrice;
    private estimateGasCosts;
    private estimateChainGasCost;
    private checkLiquidityAvailability;
    private shouldFillOrder;
    private getRejectReason;
    private selectOptimalRoute;
    private warmupPriceCache;
    getStats(): {
        priceCacheSize: number;
        gasCacheSize: number;
        minProfitUsd: number;
        minProfitMargin: number;
    };
}
//# sourceMappingURL=ProfitabilityAnalyzer.d.ts.map