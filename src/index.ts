import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger';
import { CrossChainResolver } from './resolver/CrossChainResolver';
import { OrderMonitor } from './services/OrderMonitor';
import { ProfitabilityAnalyzer } from './services/ProfitabilityAnalyzer';
import { EscrowExecutor } from './services/EscrowExecutor';
import { setupRoutes } from './routes';

dotenv.config();

const logger = createLogger('ResolverMain');

async function startResolver() {
  try {
    // Initialize Express app
    const app = express();
    const port = process.env.PORT || 3001;

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Initialize resolver components
    logger.info('🚀 Initializing Cross-Chain Resolver...');
    
    const profitabilityAnalyzer = new ProfitabilityAnalyzer();
    const escrowExecutor = new EscrowExecutor();
    const orderMonitor = new OrderMonitor();
    
    const resolver = new CrossChainResolver(
      orderMonitor,
      profitabilityAnalyzer, 
      escrowExecutor
    );

    // Initialize all services
    await resolver.initialize();
    
    // Setup API routes
    setupRoutes(app, resolver);

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

  } catch (error) {
    logger.error('❌ Failed to start resolver:', error);
    process.exit(1);
  }
}

startResolver(); 