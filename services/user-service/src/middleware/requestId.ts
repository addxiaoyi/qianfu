/**
 * Request ID Middleware
 */

import { Request, RequestHandler, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      correlationId?: string;
      startTime: number;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: RequestHandler): void {
  // Use existing correlation ID from headers or generate new one
  req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  req.startTime = Date.now();

  // Add to response headers
  _res.setHeader('X-Request-ID', req.requestId);
  _res.setHeader('X-Correlation-ID', req.correlationId);

  next();
}
