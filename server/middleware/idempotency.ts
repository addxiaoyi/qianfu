import { createHash } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { redisService } from '../services/redisService';
import { buildErrorEnvelope } from '../contracts/responseEnvelope';
import { ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

interface DuplicateGuardOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
  includeBody?: boolean;
}

interface IdempotencyOptions {
  ttlSeconds?: number;
  lockTtlSeconds?: number;
  keyPrefix?: string;
  requireHeader?: boolean;
}

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

function getRequesterScope(req: Request): string {
  const userId = (req as any).user?.id;
  if (userId) return `u:${userId}`;
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

function buildRequestDigest(req: Request, includeBody: boolean): string {
  const payload = includeBody ? JSON.stringify(req.body ?? {}) : '';
  const base = `${req.method}|${req.baseUrl}${req.path}|${getRequesterScope(req)}|${payload}`;
  return createHash('sha256').update(base).digest('hex');
}

function isWriteMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export function createDuplicateRequestGuard(options: DuplicateGuardOptions = {}): RequestHandler {
  const ttlSeconds = options.ttlSeconds ?? 8;
  const keyPrefix = options.keyPrefix ?? 'dup:req';
  const includeBody = options.includeBody ?? true;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isWriteMethod(req.method)) return next();

    try {
      const digest = buildRequestDigest(req, includeBody);
      const key = `${keyPrefix}:${digest}`;
      const count = await redisService.incr(key, ttlSeconds);

      if (count <= 1) {
        return next();
      }

      logger.warn('[DuplicateGuard] blocked duplicate request', {
        requestId: req.requestId,
        method: req.method,
        path: `${req.baseUrl}${req.path}`,
        scope: getRequesterScope(req),
      });

      return res.status(409).json(
        buildErrorEnvelope({
          message: 'Duplicate request detected, please wait and retry.',
          code: 'DUPLICATE_REQUEST',
          statusCode: 409,
          requestId: req.requestId,
        }),
      );
    } catch (error) {
      logger.warn('[DuplicateGuard] degraded: redis unavailable, skipping duplicate check', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return next();
    }
  };
}

function getIdempotencyKey(req: Request): string | undefined {
  const header = req.header('Idempotency-Key') || req.header('idempotency-key');
  const value = header?.trim();
  if (!value) return undefined;
  return value;
}

function isValidIdempotencyKey(value: string): boolean {
  if (value.length < 8 || value.length > 128) return false;
  return /^[A-Za-z0-9:_-]+$/.test(value);
}

export function createIdempotencyMiddleware(options: IdempotencyOptions = {}): RequestHandler {
  const ttlSeconds = options.ttlSeconds ?? 24 * 60 * 60;
  const lockTtlSeconds = options.lockTtlSeconds ?? 30;
  const keyPrefix = options.keyPrefix ?? 'idem';
  const requireHeader = options.requireHeader ?? false;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isWriteMethod(req.method)) return next();

    const idemKey = getIdempotencyKey(req);
    if (!idemKey) {
      if (!requireHeader) return next();
      return res.status(400).json(
        buildErrorEnvelope({
          message: 'Idempotency-Key header is required for this endpoint.',
          code: ErrorCode.VALIDATION_ERROR,
          statusCode: 400,
          requestId: req.requestId,
        }),
      );
    }

    if (!isValidIdempotencyKey(idemKey)) {
      return res.status(400).json(
        buildErrorEnvelope({
          message: 'Invalid Idempotency-Key format.',
          code: ErrorCode.VALIDATION_ERROR,
          statusCode: 400,
          requestId: req.requestId,
        }),
      );
    }

    const scope = getRequesterScope(req);
    const route = `${req.method}:${req.baseUrl}${req.path}`;
    const responseKey = `${keyPrefix}:resp:${scope}:${route}:${idemKey}`;
    const lockKey = `${keyPrefix}:lock:${scope}:${route}:${idemKey}`;

    try {
      const cached = await redisService.get<CachedResponse>(responseKey);
      if (cached) {
        res.setHeader('X-Idempotent-Replay', '1');
        return res.status(cached.statusCode || 200).json(cached.body);
      }

      const acquired = await redisService.acquireLock(lockKey, lockTtlSeconds);
      if (!acquired) {
        return res.status(409).json(
          buildErrorEnvelope({
            message: 'A request with the same Idempotency-Key is already in progress.',
            code: 'IDEMPOTENCY_IN_PROGRESS',
            statusCode: 409,
            requestId: req.requestId,
          }),
        );
      }

      const originalJson = res.json.bind(res);
      let capturedBody: unknown;
      res.json = ((body: unknown) => {
        capturedBody = body;
        return originalJson(body);
      }) as Response['json'];

      let released = false;
      const releaseLock = async () => {
        if (released) return;
        released = true;
        await redisService.releaseLock(lockKey);
      };

      res.on('finish', () => {
        void (async () => {
          try {
            if (
              typeof capturedBody !== 'undefined' &&
              res.statusCode >= 200 &&
              res.statusCode < 400
            ) {
              await redisService.set(
                responseKey,
                { statusCode: res.statusCode, body: capturedBody } satisfies CachedResponse,
                ttlSeconds,
              );
            }
          } finally {
            await releaseLock();
          }
        })();
      });

      res.on('close', () => {
        void releaseLock();
      });

      return next();
    } catch (error) {
      logger.warn('[Idempotency] degraded: fallback to normal request flow', {
        requestId: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return next();
    }
  };
}
