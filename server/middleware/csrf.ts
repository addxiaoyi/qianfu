import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { redisService } from '../services/redisService';
import { logger } from '../utils/logger';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_COOKIE = 'csrf_token';
const CSRF_SECRET_COOKIE = 'csrf_secret';

const CSRF_ATTACK_CACHE_PREFIX = 'csrf_attacks:';
const CSRF_ATTACK_CACHE_DURATION = 60; // 60 seconds

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function createSignedToken(token: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(token);
  return `${token}.${hmac.digest('hex')}`;
}

function verifySignedToken(tokenWithSig: string, secret: string): boolean {
  if (!tokenWithSig || !secret) return false;
  const parts = tokenWithSig.split('.');
  if (parts.length !== 2) return false;
  
  const [token, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(token).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

function getClientIdentifier(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `${ip}:${userAgent.substring(0, 50)}`;
}

function shouldBypassCSRF(): boolean {
  if (process.env.NODE_ENV === 'production' && process.env.CSRF_BYPASS === 'true') {
    logger.error('[CSRF] CSRF_BYPASS=true is not allowed in production');
    return false;
  }
  return process.env.NODE_ENV !== 'production' && process.env.CSRF_BYPASS === 'true';
}

function shouldSkipCSRF(req: Request): boolean {
  const bypassCSRF = process.env.CSRF_BYPASS_PATHS?.split(',') || [];
  const requestPath = req.path;

  if (requestPath === '/auth' || requestPath.startsWith('/auth/')) {
    return true;
  }
  
  for (const path of bypassCSRF) {
    if (requestPath.startsWith(path.trim())) {
      return true;
    }
  }
  
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }
  
  return false;
}

export const csrfProtection = async (req: Request, res: Response, next: NextFunction) => {
  if (shouldSkipCSRF(req)) {
    return next();
  }

  const clientId = getClientIdentifier(req);
  const cacheKey = `${CSRF_ATTACK_CACHE_PREFIX}${clientId}`;
  
  // Use Redis for attack tracking if enabled, otherwise skip rate limiting
  const attackCount = await redisService.get<number>(cacheKey) || 0;
  
  if (attackCount >= 5) {
    logger.warn(`[CSRF] Too many failures from ${clientId}. Blocking.`);
    return res.status(429).json({
      success: false,
      error: {
        message: 'Too many CSRF verification failures',
        code: 'CSRF_RATE_LIMIT'
      }
    });
  }

  const secret = req.cookies[CSRF_SECRET_COOKIE];
  const tokenFromHeader = req.headers[CSRF_TOKEN_HEADER] as string || req.headers['X-CSRF-Token'] as string;

  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[CSRF Debug] Path: ${req.path}, Method: ${req.method}`);
  }

  const fail = async () => {
    await redisService.set(cacheKey, attackCount + 1, CSRF_ATTACK_CACHE_DURATION);
    
    if (shouldBypassCSRF()) {
      logger.warn(`[CSRF] Verification failed - bypassing for development`);
      return next();
    }
    return res.status(403).json({
      success: false,
      error: {
        message: 'CSRF verification failed',
        code: 'CSRF_ERROR'
      }
    });
  };

  const isVerified = verifySignedToken(tokenFromHeader, secret);
  if (!isVerified) {
    return fail();
  }

  next();
};

export const cleanupCsrfCache = async (): Promise<number> => {
  try {
    const keys = await redisService.keys(`${CSRF_ATTACK_CACHE_PREFIX}*`);
    if (keys.length === 0) return 0;
    
    let count = 0;
    for (const key of keys) {
      await redisService.del(key);
      count++;
    }
    return count;
  } catch (error) {
    logger.error('[CSRF] Failed to cleanup CSRF cache:', error);
    return 0;
  }
};

export const generateCsrfTokens = (req: Request, res: Response, next: NextFunction) => {
  const secret = crypto.randomBytes(32).toString('hex');
  const token = generateToken();
  const signedToken = createSignedToken(token, secret);

  const isSecure = process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true';
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const cookieOptions: any = {
    httpOnly: true,
    secure: isSecure,
    sameSite: isDevelopment ? 'lax' : 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  };

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.domain = process.env.COOKIE_DOMAIN || undefined;
  }

  res.cookie(CSRF_SECRET_COOKIE, secret, cookieOptions);

  res.cookie(CSRF_TOKEN_COOKIE, signedToken, {
    httpOnly: false,
    secure: isSecure,
    sameSite: isDevelopment ? 'lax' : 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  });

  (req as Request & { csrfToken: string }).csrfToken = signedToken;
  next();
};

export const rotateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  const existingSecret = req.cookies[CSRF_SECRET_COOKIE];
  
  const newSecret = crypto.randomBytes(32).toString('hex');
  const newToken = generateToken();
  const newSignedToken = createSignedToken(newToken, newSecret);

  const isSecure = process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true';

  if (existingSecret) {
    res.clearCookie(CSRF_SECRET_COOKIE, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/'
    });
    
    res.clearCookie(CSRF_TOKEN_COOKIE, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'strict',
      path: '/'
    });
  }

  res.cookie(CSRF_SECRET_COOKIE, newSecret, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.cookie(CSRF_TOKEN_COOKIE, newSignedToken, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  });

  (req as Request & { csrfToken: string }).csrfToken = newSignedToken;
  next();
};

export const clearCsrfTokens = (res: Response) => {
  const isSecure = process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS === 'true';
  
  res.clearCookie(CSRF_SECRET_COOKIE, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/'
  });

  res.clearCookie(CSRF_TOKEN_COOKIE, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'strict',
    path: '/'
  });
};

export const validateCsrfOrigin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  const allowedOrigins = process.env.CSRF_ALLOWED_ORIGINS?.split(',') || [];
  
  if (allowedOrigins.length > 0 && origin) {
    const isAllowedOrigin = allowedOrigins.some(allowed => {
      const trimmed = allowed.trim();
      if (trimmed.endsWith('/')) {
        return origin.startsWith(trimmed);
      }
      return origin === trimmed || origin.startsWith(trimmed + '/');
    });
    
    if (!isAllowedOrigin) {
      logger.warn(`[CSRF] Origin validation failed - Origin: ${origin}, Allowed: ${allowedOrigins.join(', ')}`);
      return _res.status(403).json({
        success: false,
        error: {
          message: 'Invalid request origin',
          code: 'ORIGIN_FORBIDDEN'
        }
      });
    }
  }

  next();
};

export const createCsrfErrorHandler = () => {
  return (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('[CSRF] Error:', err.message);
    res.status(403).json({
      success: false,
      error: {
        message: 'CSRF validation error',
        code: 'CSRF_ERROR'
      }
    });
  };
};
