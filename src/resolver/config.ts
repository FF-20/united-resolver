export const chains = {
    // Sepolia (EVM)
    11155111: {
        type: 'evm' as const,
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
    },
    // Neutron (COSMOS) testnet
    'pion-1': {
        type: 'cosmos' as const,
        rpcUrl: process.env.COSMOS_RPC_URL, // e.g., 'https://rpc.cosmos.directory/cosmoshub'
        prefix: 'neutron' 
    }
    // Add other chains here
};

export type ChainId = keyof typeof chains;