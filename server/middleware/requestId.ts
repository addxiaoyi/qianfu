import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
