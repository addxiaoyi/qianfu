/**
 * User Service - Express Application
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ErrorCode } from '@qianfu/shared';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy (for rate limiting behind load balancer)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(cookieParser());

  // Infrastructure
  app.use(requestIdMiddleware);
  app.use(metricsMiddleware);

  // Rate limiting
  app.use('/api', rateLimiter);

  // Routes
  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: 'Not Found',
        code: ErrorCode.NOT_FOUND,
      },
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

// Export for testing
export const app = createApp();
export default app;
