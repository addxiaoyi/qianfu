import type { Application, Request, Response, NextFunction } from 'express';
import { globalLimiter, serversLimiter, ddosBurstLimiter } from '../middleware/rateLimiter';

export function registerRateLimiters(app: Application) {
  app.use('/api', ddosBurstLimiter);
  app.use('/api/public/servers', serversLimiter);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const isPublicRoute =
      req.path.startsWith('/api/public/servers') ||
      req.path.startsWith('/api/csrf-token') ||
      req.path.startsWith('/api/v1/csrf-token') ||
      req.path.startsWith('/api/auth/csrf-token') ||
      req.path.startsWith('/api/v1/auth/csrf-token') ||
      req.path.startsWith('/auth');

    if (isPublicRoute) return next();
    return globalLimiter(req, res, next);
  });
}
