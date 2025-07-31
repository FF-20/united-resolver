"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const ethers_1 = require("ethers");
const logger_1 = require("./utils/logger");
const SimpleFusionResolver_1 = require("./resolver/SimpleFusionResolver");
dotenv_1.default.config();
const logger = (0, logger_1.createLogger)('SimpleFusionMain');
async function startSimpleResolver() {
    try {
        // Initialize Express app for health checks
        const app = (0, express_1.default)();
        const port = process.env.PORT || 3001;
        // Middleware
        app.use((0, helmet_1.default)());
        app.use((0, cors_1.default)());
        app.use(express_1.default.json());
        // Initialize Ethereum provider
        const provider = new ethers_1.ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com');
        // Initialize resolver
        logger.info('Initializing Simple Fusion Resolver');
        const resolverContractAddress = process.env.RESOLVER_CONTRACT_ADDRESS;
        if (!resolverContractAddress) {
            throw new Error('RESOLVER_CONTRACT_ADDRESS environment variable is required');
        }
        const resolver = new SimpleFusionResolver_1.SimpleFusionResolver(provider, process.env.RESOLVER_PRIVATE_KEY || '', resolverContractAddress, 1 // Ethereum mainnet
        );
        // Setup API routes
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                resolver: resolver.getStatus()
            });
        });
        app.get('/status', (req, res) => {
            res.json(resolver.getStatus());
        });
        // Start server
        app.listen(port, () => {
            logger.info(`Simple Fusion Resolver API running on port ${port}`);
        });
        // Start resolver
        await resolver.start();
        logger.info('Simple Fusion Resolver is now monitoring for orders');
        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down resolver');
            await resolver.stop();
            process.exit(0);
        });
    }
    catch (error) {
        logger.error('Failed to start simple resolver:', error);
        process.exit(1);
    }
}
startSimpleResolver();
//# sourceMappingURL=simple-index.js.map