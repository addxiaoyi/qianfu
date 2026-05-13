import { Request, Response, NextFunction } from 'express';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { redisService } from '../services/redisService';
import { logAction } from '../services/auditService';
import { logger } from '../utils/logger';

function getEnvFlag(name: string, def: boolean) {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === 'true';
}

function hmacHex(secret: string, data: string) {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function sha256Hex(data: string) {
  return createHash('sha256').update(data).digest('hex');
}

function parseWhitelist(): string[] {
  const raw = process.env.SIGNATURE_WHITELIST_PATHS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export async function verifySignature(req: Request, res: Response, next: NextFunction) {
  const enabled = getEnvFlag('SIGNATURE_ENABLED', false);
  if (!enabled) return next();

  const secret = process.env.SIGNATURE_SECRET || '';
  if (!secret) {
    logger.error('[Signature] Missing SIGNATURE_SECRET');
    return res.status(503).json({
      success: false,
      error: {
        message: 'Signature service unavailable',
        code: 'SIGNATURE_CONFIG_MISSING'
      }
    });
  }

  // Whitelist path skip
  const whitelist = parseWhitelist();
  if (whitelist.some(p => req.path.startsWith(p))) {
    return next();
  }

  const tsHeader = req.headers['x-timestamp'];
  const sigHeader = req.headers['x-signature'];
  const ts = typeof tsHeader === 'string' ? Number.parseInt(tsHeader, 10) : 0;
  const now = Math.floor(Date.now() / 1000);
  const skew = 300;

  const fail = async (statusCode: number, message: string, code: string, reason: string) => {
    try {
      const uid = (req as any).user?.id ?? null;
      const rid = (req as any).requestId ?? '';
      await logAction(uid, 'SIGNATURE_FAIL', reason, req as any, { request_id: rid, path: req.path });
    } catch {}
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        code,
      },
    });
  };

  if (!ts || Math.abs(now - ts) > skew) {
    return fail(401, 'Invalid timestamp', 'SIGNATURE_TIMESTAMP_INVALID', 'timestamp');
  }
  if (!sigHeader || typeof sigHeader !== 'string') {
    return fail(401, 'Missing signature', 'SIGNATURE_MISSING', 'missing');
  }

  const nonceEnabled = getEnvFlag('SIGNATURE_NONCE_ENABLED', false);
  let nonceValue = '';
  if (nonceEnabled) {
    const nonceHeader = req.headers['x-nonce'];
    nonceValue = typeof nonceHeader === 'string' ? nonceHeader : '';
    if (!nonceValue) {
      return fail(401, 'Missing nonce', 'SIGNATURE_NONCE_MISSING', 'nonce_missing');
    }
    try {
      const redisEnabled = process.env.REDIS_ENABLED === 'true' && redisService.getStatus();
      if (redisEnabled) {
        const key = `sig:nonce:${nonceValue}`;
        const existed = await redisService.get(key);
        if (existed) {
          return fail(401, 'Replay detected', 'SIGNATURE_REPLAY_DETECTED', 'replay');
        }
        await redisService.set(key, '1', 300);
      }
    } catch (nonceErr) {
      logger.warn('[Signature] Redis nonce check failed, allowing request', nonceErr);
    }
  }

  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url || '';
  const bodyStr = req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : '';
  const bodyHash = sha256Hex(bodyStr);
  const canonical = [method, url, String(ts), bodyHash].join('\n');
  const expected = hmacHex(secret, canonical);

  let match = false;
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const givenBuf = Buffer.from(sigHeader, 'hex');
    if (expectedBuf.length === givenBuf.length) {
      match = timingSafeEqual(expectedBuf, givenBuf);
    }
  } catch {
    match = false;
  }

  if (!match) {
    return fail(401, 'Signature mismatch', 'SIGNATURE_MISMATCH', 'mismatch');
  }
  next();
}
