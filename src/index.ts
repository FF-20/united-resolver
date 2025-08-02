import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { createLogger } from './utils/logger';
import { Resolver } from './resolver/resolver';

dotenv.config();

const logger = createLogger('Main');

async function main() {
  try {
    const app = express();
    const port = process.env.PORT || 3002;

    app.use(helmet());
    app.use(cors());
    app.use(express.json());
    
    const contractAddress = process.env.RESOLVER_CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error('RESOLVER_CONTRACT_ADDRESS environment variable is required');
    }

    logger.info('Initializing resolver');
    
    const privateKeys = new Map <number | string, string> ([
      [11155111, process.env.SEPOLIA_PRIVATE_KEY!],
      ['pion-1', process.env.COSMOS_MNEMONIC!]
    ]);

    const resolver = new Resolver(
     privateKeys
    );

    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: Date.now(),
        resolver: resolver.getStatus()
      });
    });

    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });

    await resolver.start();
    logger.info('Resolver monitoring for orders');

    process.on('SIGINT', async () => {
      logger.info('Shutting down');
      await resolver.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main(); 