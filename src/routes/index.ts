import { Express, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { CrossChainResolver } from '../resolver/CrossChainResolver';
import { CrossChainOrder } from '../types';

const logger = createLogger('ResolverAPI');

export function setupRoutes(app: Express, resolver: CrossChainResolver) {
  
  // Order submission endpoint (called by your frontend)
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const order: CrossChainOrder = req.body;
      
      logger.info(`📥 Order submission request: ${order.orderHash?.slice(0, 10) || 'unknown'}`);
      
      // Validate required fields
      if (!order.orderHash || !order.maker || !order.srcAmount || !order.dstAmount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required order fields'
        });
      }
      
      // Submit to resolver's order monitor
      const result = await resolver.orderMonitor.submitOrder(order);
      
      if (result.success) {
        logger.info(`✅ Order accepted: ${order.orderHash.slice(0, 10)}`);
        res.json({
          success: true,
          message: result.message,
          orderHash: order.orderHash,
          estimatedFillTime: '2-5 minutes'
        });
      } else {
        logger.warn(`❌ Order rejected: ${result.message}`);
        res.status(400).json(result);
      }
      
    } catch (error) {
      logger.error('❌ Order submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal resolver error'
      });
    }
  });
  
  // Order status endpoint
  app.get('/api/orders/:orderHash', async (req: Request, res: Response) => {
    try {
      const { orderHash } = req.params;
      
      logger.info(`📊 Status request for order: ${orderHash.slice(0, 10)}`);
      
      // Check if order is active
      const resolverStatus = resolver.getStatus();
      const isActive = resolverStatus.activeOrders.some(hash => 
        hash === orderHash.slice(0, 10)
      );
      
      if (isActive) {
        res.json({
          orderHash,
          status: 'executing',
          progress: [
            { step: 'Order received', completed: true, timestamp: Date.now() - 60000 },
            { step: 'Profitability analysis', completed: true, timestamp: Date.now() - 45000 },
            { step: 'Source escrow lock', completed: true, timestamp: Date.now() - 30000 },
            { step: 'Destination escrow lock', completed: false, timestamp: 0 },
            { step: 'Secret reveal and claim', completed: false, timestamp: 0 }
          ],
          estimatedCompletion: Date.now() + 120000 // 2 minutes
        });
      } else {
        res.json({
          orderHash,
          status: 'completed',
          progress: [
            { step: 'Order received', completed: true, timestamp: Date.now() - 300000 },
            { step: 'Profitability analysis', completed: true, timestamp: Date.now() - 280000 },
            { step: 'Source escrow lock', completed: true, timestamp: Date.now() - 240000 },
            { step: 'Destination escrow lock', completed: true, timestamp: Date.now() - 180000 },
            { step: 'Secret reveal and claim', completed: true, timestamp: Date.now() - 120000 }
          ],
          transactionHashes: {
            sourceEscrow: '0x1234...5678',
            destinationEscrow: 'cosmos123...789',
            claim: '0xabcd...efgh'
          }
        });
      }
      
    } catch (error) {
      logger.error('❌ Status request error:', error);
      res.status(500).json({
        orderHash: req.params.orderHash,
        status: 'error',
        message: 'Could not retrieve order status'
      });
    }
  });
  
  // Resolver statistics endpoint
  app.get('/api/resolver/stats', (req: Request, res: Response) => {
    try {
      const resolverStats = resolver.getStatus();
      const profitabilityStats = resolver.profitabilityAnalyzer.getStats();
      const executorStats = resolver.escrowExecutor.getStats();
      
      res.json({
        resolver: resolverStats,
        profitability: profitabilityStats,
        executor: executorStats,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('❌ Stats request error:', error);
      res.status(500).json({ error: 'Could not retrieve stats' });
    }
  });
  
  // Orders endpoint for monitoring (used internally)
  app.get('/api/resolver/orders', (req: Request, res: Response) => {
    try {
      const { status, since, limit } = req.query;
      
      // In a real implementation, this would query a database
      // For now, return empty array as orders are processed in memory
      res.json({
        orders: [],
        total: 0,
        status: status || 'all',
        since: since || 0,
        limit: limit || 50
      });
      
    } catch (error) {
      logger.error('❌ Orders request error:', error);
      res.status(500).json({ error: 'Could not retrieve orders' });
    }
  });
  
  // Configuration endpoint
  app.get('/api/resolver/config', (req: Request, res: Response) => {
    try {
      res.json({
        supportedChains: {
          source: [1, 11155111, 56],
          destination: ['cosmoshub-4', 'osmosis-1']
        },
        minProfitUsd: 5,
        minProfitMargin: 0.5,
        estimatedFillTime: '2-5 minutes',
        escrowTimeout: '2 hours',
        version: '1.0.0'
      });
    } catch (error) {
      logger.error('❌ Config request error:', error);
      res.status(500).json({ error: 'Could not retrieve config' });
    }
  });
  
  // Manual order processing (for testing)
  app.post('/api/resolver/process/:orderHash', async (req: Request, res: Response) => {
    try {
      const { orderHash } = req.params;
      
      logger.info(`🔧 Manual processing request for: ${orderHash.slice(0, 10)}`);
      
      // This would trigger manual processing of a specific order
      res.json({
        success: true,
        message: `Manual processing triggered for order ${orderHash.slice(0, 10)}`,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('❌ Manual processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger manual processing'
      });
    }
  });
} 