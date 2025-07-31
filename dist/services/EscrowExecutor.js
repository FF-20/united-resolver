"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowExecutor = void 0;
const ethers_1 = require("ethers");
const proto_signing_1 = require("@cosmjs/proto-signing");
const stargate_1 = require("@cosmjs/stargate");
const logger_1 = require("../utils/logger");
const logger = (0, logger_1.createLogger)('EscrowExecutor');
class EscrowExecutor {
    ethereumProvider;
    ethereumSigner;
    cosmosWallet;
    cosmosClient;
    // Escrow contract addresses
    escrowContracts = {
        ethereum: process.env.ETHEREUM_ESCROW_CONTRACT || '',
        sepolia: process.env.SEPOLIA_ESCROW_CONTRACT || '0x718B8f5c8C1A9bd20b8f3cB347b7CD661A7694B1',
        bsc: process.env.BSC_ESCROW_CONTRACT || '',
    };
    async initialize() {
        logger.info('🔧 Initializing escrow executor...');
        await this.initializeEthereumConnections();
        await this.initializeCosmosConnections();
        logger.info('✅ Escrow executor ready');
    }
    async initializeEthereumConnections() {
        // Initialize Ethereum provider and signer
        const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://api.zan.top/eth-sepolia';
        const privateKey = process.env.RESOLVER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('RESOLVER_PRIVATE_KEY not configured');
        }
        this.ethereumProvider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        this.ethereumSigner = new ethers_1.ethers.Wallet(privateKey, this.ethereumProvider);
        logger.info(`📡 Connected to Ethereum: ${await this.ethereumSigner.getAddress()}`);
    }
    async initializeCosmosConnections() {
        const mnemonic = process.env.COSMOS_MNEMONIC;
        if (!mnemonic) {
            throw new Error('COSMOS_MNEMONIC not configured');
        }
        // Initialize Cosmos wallet and client
        this.cosmosWallet = await proto_signing_1.DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
            prefix: 'cosmos'
        });
        this.cosmosClient = await stargate_1.SigningStargateClient.connectWithSigner(process.env.COSMOS_RPC_URL || 'https://rpc-cosmoshub.blockapsis.com', this.cosmosWallet);
        const accounts = await this.cosmosWallet.getAccounts();
        logger.info(`🌌 Connected to Cosmos: ${accounts[0].address}`);
    }
    async lockSourceEscrow(order, decision) {
        try {
            if (typeof order.srcChainId === 'string') {
                // Source is Cosmos chain
                return await this.lockCosmosEscrow(order, 'source');
            }
            else {
                // Source is EVM chain
                return await this.lockEvmEscrow(order, 'source');
            }
        }
        catch (error) {
            logger.error(`❌ Failed to lock source escrow:`, error);
            throw error;
        }
    }
    async lockDestinationEscrow(order, decision) {
        try {
            if (typeof order.dstChainId === 'string') {
                // Destination is Cosmos chain
                return await this.lockCosmosEscrow(order, 'destination');
            }
            else {
                // Destination is EVM chain
                return await this.lockEvmEscrow(order, 'destination');
            }
        }
        catch (error) {
            logger.error(`❌ Failed to lock destination escrow:`, error);
            throw error;
        }
    }
    async lockEvmEscrow(order, type) {
        const chainId = type === 'source' ? order.srcChainId : order.dstChainId;
        const amount = type === 'source' ? order.srcAmount : order.dstAmount;
        const token = type === 'source' ? order.srcToken : order.dstToken;
        logger.info(`🔒 Locking ${amount} ${token} in EVM escrow (chain ${chainId})`);
        // Get escrow contract address based on chain
        const escrowAddress = this.getEscrowAddress(chainId);
        // Escrow contract ABI (simplified)
        const escrowABI = [
            'function lockFunds(bytes32 secretHash, address tokenAddress, uint256 amount, uint256 timelock, address recipient) external payable',
            'function claimFunds(bytes32 secret) external',
            'function refund(bytes32 secretHash) external'
        ];
        const escrowContract = new ethers_1.ethers.Contract(escrowAddress, escrowABI, this.ethereumSigner);
        // Calculate timelock (current time + 2 hours)
        const timelock = Math.floor(Date.now() / 1000) + 7200;
        // If it's an ERC-20 token, we need to approve first
        if (token !== ethers_1.ethers.ZeroAddress) {
            await this.approveToken(token, escrowAddress, amount);
        }
        // Lock funds in escrow
        const tx = await escrowContract.lockFunds(order.secretHash, token, ethers_1.ethers.parseUnits(amount, 18), // Assuming 18 decimals
        timelock, type === 'source' ? await this.ethereumSigner.getAddress() : order.maker, {
            value: token === ethers_1.ethers.ZeroAddress ? ethers_1.ethers.parseUnits(amount, 18) : 0,
            gasLimit: 300000
        });
        logger.info(`📤 EVM escrow transaction submitted: ${tx.hash}`);
        return {
            hash: tx.hash,
            chainId: chainId.toString(),
            blockNumber: 0, // Will be set after confirmation
            gasUsed: '300000',
            status: 'pending'
        };
    }
    async lockCosmosEscrow(order, type) {
        const amount = type === 'source' ? order.srcAmount : order.dstAmount;
        const denom = type === 'source' ? order.srcToken : order.dstToken;
        logger.info(`🔒 Locking ${amount} ${denom} in Cosmos escrow`);
        const accounts = await this.cosmosWallet.getAccounts();
        const resolverAddress = accounts[0].address;
        // Create HTLC (Hash Time Locked Contract) message
        const msg = {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend', // Simplified for demo
            value: {
                fromAddress: resolverAddress,
                toAddress: 'cosmos1escrow...', // Escrow contract address
                amount: [{
                        denom: denom,
                        amount: ethers_1.ethers.parseUnits(amount, 6).toString() // Cosmos uses 6 decimals
                    }]
            }
        };
        const fee = {
            amount: [{ denom: 'uatom', amount: '5000' }],
            gas: '200000'
        };
        const result = await this.cosmosClient.signAndBroadcast(resolverAddress, [msg], fee, `Escrow lock for order ${order.orderHash.slice(0, 10)}`);
        if (result.code !== 0) {
            throw new Error(`Cosmos transaction failed: ${result.rawLog}`);
        }
        logger.info(`📤 Cosmos escrow transaction: ${result.transactionHash}`);
        return {
            hash: result.transactionHash,
            chainId: 'cosmoshub-4',
            blockNumber: result.height,
            gasUsed: result.gasUsed.toString(),
            status: 'confirmed'
        };
    }
    async approveToken(tokenAddress, spender, amount) {
        const tokenABI = [
            'function approve(address spender, uint256 amount) external returns (bool)',
            'function allowance(address owner, address spender) external view returns (uint256)'
        ];
        const tokenContract = new ethers_1.ethers.Contract(tokenAddress, tokenABI, this.ethereumSigner);
        // Check current allowance
        const currentAllowance = await tokenContract.allowance(await this.ethereumSigner.getAddress(), spender);
        const requiredAmount = ethers_1.ethers.parseUnits(amount, 18);
        if (currentAllowance < requiredAmount) {
            logger.info(`🔓 Approving ${tokenAddress} for escrow contract`);
            const approveTx = await tokenContract.approve(spender, requiredAmount, {
                gasLimit: 100000
            });
            await approveTx.wait();
            logger.info(`✅ Token approval confirmed: ${approveTx.hash}`);
        }
    }
    async revealSecretAndClaim(order, decision) {
        logger.info(`🔓 Revealing secret and claiming funds for ${order.orderHash.slice(0, 10)}...`);
        // In a real implementation, the secret would be generated during order creation
        // For now, we'll simulate this
        const secret = ethers_1.ethers.randomBytes(32);
        try {
            // Claim user's tokens from source escrow (resolver gets these)
            await this.claimFromEscrow(order, secret, 'source');
            // This will automatically allow user to claim from destination escrow
            // since the secret is now revealed on-chain
            logger.info(`✅ Secret revealed, atomic swap completed`);
        }
        catch (error) {
            logger.error(`❌ Failed to reveal secret and claim:`, error);
            throw error;
        }
    }
    async claimFromEscrow(order, secret, type) {
        const chainId = type === 'source' ? order.srcChainId : order.dstChainId;
        if (typeof chainId === 'string') {
            // Cosmos chain
            await this.claimFromCosmosEscrow(order, secret, type);
        }
        else {
            // EVM chain
            await this.claimFromEvmEscrow(order, secret, type);
        }
    }
    async claimFromEvmEscrow(order, secret, type) {
        const chainId = type === 'source' ? order.srcChainId : order.dstChainId;
        const escrowAddress = this.getEscrowAddress(chainId);
        const escrowABI = ['function claimFunds(bytes32 secret) external'];
        const escrowContract = new ethers_1.ethers.Contract(escrowAddress, escrowABI, this.ethereumSigner);
        const tx = await escrowContract.claimFunds(ethers_1.ethers.hexlify(secret), {
            gasLimit: 200000
        });
        await tx.wait();
        logger.info(`✅ Claimed from EVM escrow: ${tx.hash}`);
    }
    async claimFromCosmosEscrow(order, secret, type) {
        // Implementation for claiming from Cosmos HTLC
        logger.info(`✅ Claimed from Cosmos escrow (simulated)`);
    }
    async isTransactionConfirmed(txHash, chain) {
        try {
            if (chain === 'source' && typeof txHash === 'string' && txHash.startsWith('0x')) {
                // EVM transaction
                const receipt = await this.ethereumProvider.getTransactionReceipt(txHash);
                return receipt !== null && receipt.status === 1;
            }
            else {
                // Cosmos transaction - assume confirmed for demo
                return true;
            }
        }
        catch (error) {
            logger.warn(`⚠️ Could not check transaction status: ${txHash}`);
            return false;
        }
    }
    async cancelEscrows(order) {
        logger.warn(`🚨 Cancelling escrows for order ${order.orderHash.slice(0, 10)}`);
        try {
            // Cancel source escrow
            if (typeof order.srcChainId !== 'string') {
                await this.cancelEvmEscrow(order, 'source');
            }
            // Cancel destination escrow
            if (typeof order.dstChainId !== 'string') {
                await this.cancelEvmEscrow(order, 'destination');
            }
            logger.info(`✅ Escrows cancelled`);
        }
        catch (error) {
            logger.error(`❌ Failed to cancel escrows:`, error);
        }
    }
    async cancelEvmEscrow(order, type) {
        const chainId = type === 'source' ? order.srcChainId : order.dstChainId;
        const escrowAddress = this.getEscrowAddress(chainId);
        const escrowABI = ['function refund(bytes32 secretHash) external'];
        const escrowContract = new ethers_1.ethers.Contract(escrowAddress, escrowABI, this.ethereumSigner);
        try {
            const tx = await escrowContract.refund(order.secretHash, {
                gasLimit: 150000
            });
            await tx.wait();
            logger.info(`✅ Cancelled ${type} escrow: ${tx.hash}`);
        }
        catch (error) {
            logger.warn(`⚠️ Could not cancel ${type} escrow:`, error);
        }
    }
    getEscrowAddress(chainId) {
        const addresses = {
            1: this.escrowContracts.ethereum,
            11155111: this.escrowContracts.sepolia,
            56: this.escrowContracts.bsc
        };
        const address = addresses[chainId];
        if (!address) {
            throw new Error(`No escrow contract for chain ${chainId}`);
        }
        return address;
    }
    getStats() {
        return {
            ethereumAddress: this.ethereumSigner?.address,
            escrowContracts: this.escrowContracts
        };
    }
}
exports.EscrowExecutor = EscrowExecutor;
//# sourceMappingURL=EscrowExecutor.js.map