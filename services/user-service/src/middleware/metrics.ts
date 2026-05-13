/**
 * Metrics Middleware
 */

import { Request, RequestHandler, Response } from 'express';
import client from 'prom-client';

const register = new client.Registry();

// Default metrics
client.collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

// HTTP request duration
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export function metricsMiddleware(req: Request, res: Response, next: RequestHandler): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = normalizePath(req.path);

    httpRequestsTotal.inc({
      method: req.method,
      path,
      status: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        path,
        status: res.statusCode,
      },
      duration
    );
  });

  next();
}

function normalizePath(path: string): string {
  // Normalize paths with IDs to prevent high cardinality
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export function getContentType(): string {
  return register.contentType;
}

export { register as metricsRegister };
