import { ethers } from 'ethers';
import { chains, ChainId } from '../resolver/config';
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';

type ProviderType = ethers.Provider | CosmWasmClient

class Provider {
    private providerCache = new Map<ChainId, ProviderType>();

    public async getProvider(chainId: ChainId): Promise<ProviderType> {
        if (this.providerCache.has(chainId)) {
            return this.providerCache.get(chainId)!;
        }

        const chainConfig = chains[chainId];
        if (!chainConfig || !chainConfig.rpcUrl) {
            throw new Error(`Configuration for chain ${chainId} not found or RPC URL is missing.`);
        }

        const { type, rpcUrl } = chainConfig;
        let provider: ProviderType;

        switch (type) {
            case 'evm':
                provider = new ethers.JsonRpcProvider(rpcUrl);
                break;
            case 'cosmos':
                provider = await SigningCosmWasmClient.connect(rpcUrl);
                break;
            default:
                throw new Error(`Unsupported chain type`);
        }
        
        this.providerCache.set(chainId, provider);
        return provider;
    }
}

export const provider = new Provider();