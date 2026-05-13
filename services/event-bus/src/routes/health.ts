/**
 * Health Check Routes
 * Provides health and readiness endpoints for monitoring
 */

import { Router, Request, Response } from 'express';
import { ConnectionState } from '../connection.js';
import { SubscriptionManager } from '../subscriptions.js';

export interface HealthRoutesOptions {
  getConnectionState: () => ConnectionState;
  getConnectionStats: () => {
    state: ConnectionState;
    retryCount: number;
    isShuttingDown: boolean;
  };
  getSubscriptionManager: () => SubscriptionManager;
}

export function createHealthRoutes(options: HealthRoutesOptions): Router {
  const router = Router();

  // Basic health check
  router.get('/health', (_req: Request, res: Response) => {
    const state = options.getConnectionState();
    const isHealthy = state === ConnectionState.CONNECTED;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'event-bus',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness check
  router.get('/ready', (_req: Request, res: Response) => {
    const state = options.getConnectionState();
    const connStats = options.getConnectionStats();
    const subStats = options.getSubscriptionManager().getStats();

    const isReady =
      state === ConnectionState.CONNECTED &&
      !connStats.isShuttingDown;

    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      connection: {
        state,
        retryCount: connStats.retryCount,
      },
      subscriptions: {
        count: subStats.totalSubscriptions,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health with metrics
  router.get('/health/detailed', (_req: Request, res: Response) => {
    const state = options.getConnectionState();
    const connStats = options.getConnectionStats();
    const subStats = options.getSubscriptionManager().getStats();

    res.json({
      status: state === ConnectionState.CONNECTED ? 'healthy' : 'degraded',
      service: 'event-bus',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      connection: {
        state,
        retryCount: connStats.retryCount,
        isShuttingDown: connStats.isShuttingDown,
      },
      subscriptions: {
        total: subStats.totalSubscriptions,
        totalMessages: subStats.totalMessages,
        totalErrors: subStats.totalErrors,
        details: subStats.subscriptions.map((s) => ({
          id: s.id,
          queue: s.queue,
          messageCount: s.messageCount,
          errorCount: s.errorCount,
        })),
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  });

  return router;
}

export default createHealthRoutes;
