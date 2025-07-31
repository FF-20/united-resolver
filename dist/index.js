"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./utils/logger");
const CrossChainResolver_1 = require("./resolver/CrossChainResolver");
const OrderMonitor_1 = require("./services/OrderMonitor");
const ProfitabilityAnalyzer_1 = require("./services/ProfitabilityAnalyzer");
const EscrowExecutor_1 = require("./services/EscrowExecutor");
const routes_1 = require("./routes");
dotenv_1.default.config();
const logger = (0, logger_1.createLogger)('ResolverMain');
async function startResolver() {
    try {
        // Initialize Express app
        const app = (0, express_1.default)();
        const port = process.env.PORT || 3001;
        // Middleware
        app.use((0, helmet_1.default)());
        app.use((0, cors_1.default)());
        app.use(express_1.default.json({ limit: '10mb' }));
        app.use(express_1.default.urlencoded({ extended: true }));
        // Initialize resolver components
        logger.info('🚀 Initializing Cross-Chain Resolver...');
        const profitabilityAnalyzer = new ProfitabilityAnalyzer_1.ProfitabilityAnalyzer();
        const escrowExecutor = new EscrowExecutor_1.EscrowExecutor();
        const orderMonitor = new OrderMonitor_1.OrderMonitor();
        const resolver = new CrossChainResolver_1.CrossChainResolver(orderMonitor, profitabilityAnalyzer, escrowExecutor);
        // Initialize all services
        await resolver.initialize();
        // Setup API routes
        (0, routes_1.setupRoutes)(app, resolver);
        // Health check
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                resolver: resolver.getStatus()
            });
        });
        // Start server
        app.listen(port, () => {
            logger.info(`🌉 Cross-Chain Resolver running on port ${port}`);
            logger.info(`📊 Monitoring orders: ${process.env.FRONTEND_URL}/api/orders`);
            logger.info(`⚡ Ready to resolve EVM ↔ Cosmos swaps`);
        });
        // Start order monitoring
        resolver.startMonitoring();
        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('🛑 Shutting down resolver...');
            await resolver.shutdown();
            process.exit(0);
        });
    }
    catch (error) {
        logger.error('❌ Failed to start resolver:', error);
        process.exit(1);
    }
}
startResolver();
//# sourceMappingURL=index.js.map