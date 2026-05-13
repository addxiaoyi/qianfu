/**
 * Health Check Routes
 */

import { Router, Request, Response } from 'express';
import { isDatabaseHealthy } from '../config/database.js';
import { isRabbitMQHealthy } from '../config/rabbitmq.js';
import { getMetrics, getContentType } from '../middleware/metrics.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Basic health check
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Detailed health check
router.get('/health', async (_req: Request, res: Response) => {
  const checks = {
    database: await isDatabaseHealthy(),
    rabbitmq: await isRabbitMQHealthy(),
  };

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    service: 'user-service',
    version: process.env.VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  });
});

// Readiness check
router.get('/ready', async (_req: Request, res: Response) => {
  const dbHealthy = await isDatabaseHealthy();
  
  if (dbHealthy) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready', reason: 'database not connected' });
  }
});

// Liveness check
router.get('/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

// Metrics endpoint
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', getContentType());
    res.send(await getMetrics());
  } catch (error) {
    logger.error('[Health] Metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

export { router as healthRoutes };
