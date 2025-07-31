import { CrossChainOrder, ResolverDecision, TransactionResult } from '../types';
export declare class EscrowExecutor {
    private ethereumProvider;
    private ethereumSigner;
    private cosmosWallet;
    private cosmosClient;
    private escrowContracts;
    initialize(): Promise<void>;
    private initializeEthereumConnections;
    private initializeCosmosConnections;
    lockSourceEscrow(order: CrossChainOrder, decision: ResolverDecision): Promise<TransactionResult>;
    lockDestinationEscrow(order: CrossChainOrder, decision: ResolverDecision): Promise<TransactionResult>;
    private lockEvmEscrow;
    private lockCosmosEscrow;
    private approveToken;
    revealSecretAndClaim(order: CrossChainOrder, decision: ResolverDecision): Promise<void>;
    private claimFromEscrow;
    private claimFromEvmEscrow;
    private claimFromCosmosEscrow;
    isTransactionConfirmed(txHash: string, chain: 'source' | 'destination'): Promise<boolean>;
    cancelEscrows(order: CrossChainOrder): Promise<void>;
    private cancelEvmEscrow;
    private getEscrowAddress;
    getStats(): {
        ethereumAddress: string;
        escrowContracts: {
            ethereum: string;
            sepolia: string;
            bsc: string;
        };
    };
}
//# sourceMappingURL=EscrowExecutor.d.ts.map