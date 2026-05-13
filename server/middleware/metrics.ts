import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService';

/**
 * Middleware to record HTTP request metrics for Prometheus
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // In seconds
    const route = req.route ? req.route.path : req.path;
    const status = res.statusCode.toString();
    const method = req.method;

    // Only record actual routes, skip health checks or metrics endpoint itself
    if (!route.includes('/prometheus') && !route.includes('/health')) {
      metricsService.recordHttpRequest(method, route, status, duration);
    }
  });

  next();
};
