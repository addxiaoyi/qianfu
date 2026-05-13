/**
 * Payment Service - Express Application
 */

import express, { Express, Request, Response } from 'express';
import { paymentRoutes } from './routes/payment.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { AppError } from '@qianfu/shared';

// ============================================================================
// 辅助函数
// ============================================================================

function _successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

function errorResponse(message: string, code: string, meta?: Record<string, unknown>) {
  return {
    success: false,
    error: {
      message,
      code,
      ...meta,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// 应用工厂
// ============================================================================

export function createApp(): Express {
  const app = express();

  // Trust proxy
  app.set('trust proxy', 1);

  // Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // ============================================================================
  // 健康检查
  // ============================================================================

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'payment-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    try {
      // 检查数据库连接
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();

      res.json({
        status: 'ready',
        checks: [{ name: 'database', status: true }],
      });
    } catch (error) {
      res.status(503).json({
        status: 'not_ready',
        checks: [{ name: 'database', status: false, error: String(error) }],
      });
    }
  });

  // ============================================================================
  // 路由
  // ============================================================================

  app.use('/api/payments', paymentRoutes);
  app.use('/api/webhooks', webhookRoutes);

  // ============================================================================
  // 404 处理
  // ============================================================================

  app.use((req: Request, res: Response) => {
    res.status(404).json(errorResponse('Not Found', 'NOT_FOUND'));
  });

  // ============================================================================
  // 错误处理
  // ============================================================================

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[PaymentService] Error: ${err.message}`, {
      error: err.message,
      stack: err.stack,
      path: req.path,
    });

    if (err instanceof AppError) {
      res.status(err.statusCode).json(
        errorResponse(err.message, err.code)
      );
      return;
    }

    res.status(500).json(
      errorResponse(
        process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        'INTERNAL_ERROR'
      )
    );
  });

  return app;
}

// Export for testing
export const app = createApp();
export default app;
