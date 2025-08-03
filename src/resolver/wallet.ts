import { ethers } from 'ethers';
import { AccountData, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { chains, ChainId } from '../resolver/config';
import { provider } from './provider';

class Wallet {
    private walletCache = new Map<ChainId, ethers.Wallet | AccountData>();

    public async getWallet(chainId: ChainId): Promise<ethers.Wallet | AccountData> {
        if (this.walletCache.has(chainId)) {
            return this.walletCache.get(chainId)!;
        }

        const chainConfig = chains[chainId];
        if (!chainConfig || !chainConfig.rpcUrl) {
            throw new Error(`Configuration for chain ${chainId} not found or RPC URL is missing.`);
        }

        const { type, rpcUrl } = chainConfig;
        let wallet: ethers.Wallet | AccountData;

        switch (type) {
            case 'evm':
                const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
                if (!privateKey) {
                    throw new Error("SEPOLIA_PRIVATE_KEY environment variable not set.");
                }
                const _provider = await provider.getProvider(chainId);
                wallet = new ethers.Wallet(privateKey, _provider as ethers.Provider);
                break;
            case 'cosmos':
                const mnemonic = process.env.COSMOS_MNEMONIC;
                if (!mnemonic) {
                    throw new Error("COSMOS_MNEMONIC environment variable not set.");
                }

                // Get the prefix from your config file for the specific chain
                const prefix = (chainConfig as any).prefix;
                if (!prefix) {
                    throw new Error(`'prefix' not defined in config for chain ${chainId}`);
                }

                const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(
                    mnemonic, 
                    { prefix }
                );
                
                // Get the account data from the wallet
                const [account] = await cosmosWallet.getAccounts();
                wallet = account
                break;
            default:
                throw new Error(`Unsupported chain type`);
        }
        
        this.walletCache.set(chainId, wallet);
        return wallet;
    }
}

export const wallet = new Wallet();