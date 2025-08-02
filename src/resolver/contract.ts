import { ethers } from 'ethers';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { chains, ChainId } from './config';
import { wallet as walletManager } from './wallet'; // renamed to avoid conflict

type ContractType = ethers.Contract | SigningCosmWasmClient;

class Contract {
    private contractCache = new Map<ChainId, ContractType>();

    public async getContract(chainId: ChainId): Promise<ContractType> {
        if (this.contractCache.has(chainId)) {
            return this.contractCache.get(chainId)!;
        }

        const chainConfig = chains[chainId];
        if (!chainConfig || !chainConfig.rpcUrl) {
            throw new Error(`Configuration for chain ${chainId} not found.`);
        }
        
        // Get the appropriate wallet/signer for the chain
        const signer = await walletManager.getWallet(chainId);
        
        let client: ContractType;

        switch (chainConfig.type) {
            case 'evm':
                const evmConfig = chainConfig as any;
                if (!evmConfig.contractAddress || !evmConfig.abi) {
                    throw new Error(`'contractAddress' or 'abi' not defined in config for EVM chain ${chainId}`);
                }
                // For EVM, the contract client is an ethers.Contract instance
                client = new ethers.Contract(
                    evmConfig.contractAddress,
                    evmConfig.abi,
                    signer as ethers.Wallet // The EVM wallet is the signer
                );
                break;
            
            case 'cosmos':
                // For Cosmos, the contract client is a SigningCosmWasmClient
                client = await SigningCosmWasmClient.connectWithSigner(
                    chainConfig.rpcUrl,
                    signer as any // The Cosmos wallet is an OfflineSigner
                );
                break;

            default:
                throw new Error(`Unsupported chain type`);
        }

        this.contractCache.set(chainId, client);
        return client;
    }
}

export const contract = new Contract();