import { OrderMonitor } from '../services/OrderMonitor';
import { ProfitabilityAnalyzer } from '../services/ProfitabilityAnalyzer';
import { EscrowExecutor } from '../services/EscrowExecutor';
export declare class CrossChainResolver {
    private orderMonitor;
    private profitabilityAnalyzer;
    private escrowExecutor;
    private isRunning;
    private processedOrders;
    private activeOrders;
    constructor(orderMonitor: OrderMonitor, profitabilityAnalyzer: ProfitabilityAnalyzer, escrowExecutor: EscrowExecutor);
    initialize(): Promise<void>;
    startMonitoring(): Promise<void>;
    private processNewOrders;
    private analyzeAndExecuteOrder;
    private executeAtomicSwap;
    private waitForEscrowConfirmations;
    private handleFailedSwap;
    private checkActiveOrders;
    getStatus(): {
        isRunning: boolean;
        processedOrdersCount: number;
        activeOrdersCount: number;
        activeOrders: string[];
    };
    shutdown(): Promise<void>;
}
//# sourceMappingURL=CrossChainResolver.d.ts.map