import { CrossChainOrder } from '../types';
export declare class OrderMonitor {
    private frontendUrl;
    private lastCheckedTimestamp;
    constructor();
    initialize(): Promise<void>;
    fetchPendingOrders(): Promise<CrossChainOrder[]>;
    private transformOrder;
    submitOrder(order: CrossChainOrder): Promise<{
        success: boolean;
        message: string;
    }>;
    private validateOrder;
    getStats(): {
        lastChecked: number;
        frontendUrl: string;
    };
}
//# sourceMappingURL=OrderMonitor.d.ts.map