import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { createLogger } from './utils/logger';
import { SimpleFusionResolver } from './resolver/SimpleFusionResolver';

dotenv.config();

const logger = createLogger('SimpleFusionMain');

async function startSimpleResolver() {
  try {
    // Initialize Express app for health checks
    const app = express();
    const port = process.env.PORT || 3001;

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    // Initialize Ethereum provider
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com');
    
    // Initialize resolver
    logger.info('Initializing Simple Fusion Resolver');
    
    const resolverContractAddress = process.env.RESOLVER_CONTRACT_ADDRESS;
    if (!resolverContractAddress) {
      throw new Error('RESOLVER_CONTRACT_ADDRESS environment variable is required');
    }
    
    const resolver = new SimpleFusionResolver(
      provider,
      process.env.RESOLVER_PRIVATE_KEY || '',
      resolverContractAddress,
      1 // Ethereum mainnet
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

  } catch (error) {
    logger.error('Failed to start simple resolver:', error);
    process.exit(1);
  }
}

startSimpleResolver(); 