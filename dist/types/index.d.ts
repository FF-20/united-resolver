export interface CrossChainOrder {
    orderHash: string;
    maker: string;
    srcChainId: string | number;
    dstChainId: string | number;
    srcToken: string;
    dstToken: string;
    srcAmount: string;
    dstAmount: string;
    deadline: number;
    secretHash: string;
    signature: string;
    escrowFactory?: string;
    timeLocks?: TimeLocks;
    createdAt?: number;
    nonce?: string;
    status: OrderStatus;
    estimatedGasCost: string;
    profitability: number | null;
}
export interface TimeLocks {
    srcWithdrawal: number;
    srcPublicWithdrawal: number;
    srcCancellation: number;
    srcPublicCancellation: number;
    dstWithdrawal: number;
    dstPublicWithdrawal: number;
    dstCancellation: number;
}
export type OrderStatus = 'pending' | 'analyzing' | 'executing' | 'completed' | 'failed' | 'expired';
export interface ResolverDecision {
    orderHash: string;
    shouldFill: boolean;
    reason: string;
    expectedProfitUsd: number;
    profitMarginPercent: number;
    estimatedGasCost: number;
    srcTokenPrice?: TokenPrice;
    dstTokenPrice?: TokenPrice;
    liquidityStatus?: LiquidityStatus;
    optimalRoute?: string;
    analysisTimeMs: number;
    timestamp: number;
}
export interface TokenPrice {
    priceUsd: number;
    source: 'cache' | 'api' | 'fallback';
    timestamp?: number;
}
export interface GasEstimate {
    sourceGasUnits: number;
    sourceGasPrice: string;
    sourceGasUsd: number;
    destinationGasUnits: number;
    destinationGasPrice: string;
    destinationGasUsd: number;
    claimGasUnits: number;
    claimGasUsd: number;
    totalGasUsd: number;
}
export interface LiquidityStatus {
    hasSourceLiquidity: boolean;
    hasDestinationLiquidity: boolean;
    liquidityRatio: number;
    estimatedSlippage: number;
}
export interface TransactionResult {
    hash: string;
    chainId: string;
    blockNumber: number;
    gasUsed: string;
    status: 'pending' | 'confirmed' | 'failed';
}
export interface ResolverConfig {
    minProfitUsd: number;
    minProfitMargin: number;
    maxGasPrice: string;
    supportedChains: (string | number)[];
    escrowContracts: Record<string, string>;
    rpcEndpoints: Record<string, string>;
}
export interface ResolverStats {
    totalOrdersProcessed: number;
    successfulFills: number;
    failedFills: number;
    totalProfitUsd: number;
    averageExecutionTime: number;
    currentBalance: Record<string, string>;
}
export interface OrderSubmissionResponse {
    success: boolean;
    message: string;
    orderHash?: string;
    estimatedFillTime?: number;
}
export interface OrderStatusResponse {
    orderHash: string;
    status: OrderStatus;
    progress: {
        step: string;
        completed: boolean;
        timestamp: number;
    }[];
    estimatedCompletion?: number;
    transactionHashes?: {
        sourceEscrow?: string;
        destinationEscrow?: string;
        claim?: string;
    };
}
export interface ResolverHealthResponse {
    status: 'healthy' | 'degraded' | 'down';
    timestamp: number;
    resolver: {
        isRunning: boolean;
        processedOrdersCount: number;
        activeOrdersCount: number;
        activeOrders: string[];
    };
    balances?: Record<string, string>;
    errors?: string[];
}
//# sourceMappingURL=index.d.ts.map