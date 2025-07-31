import { ethers } from 'ethers';
export declare class SimpleFusionResolver {
    private resolverContractAddress;
    private chainId;
    private provider;
    private wallet;
    private resolverContract;
    private isRunning;
    private processedOrders;
    private readonly RELAYER_API;
    constructor(provider: ethers.Provider, privateKey: string, resolverContractAddress: string, chainId?: number);
    start(): Promise<void>;
    private processNewOrders;
    private fetchPendingOrders;
    private executeOrder;
    private fillOrder;
    private checkInventory;
    depositTokens(tokenAddress: string, amount: string): Promise<void>;
    withdrawTokens(tokenAddress: string, amount: string): Promise<void>;
    getInventoryBalances(tokens: string[]): Promise<Record<string, string>>;
    stop(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        processedOrdersCount: number;
        resolverAddress: string;
        contractAddress: string;
        chainId: number;
    };
}
//# sourceMappingURL=SimpleFusionResolver.d.ts.map