import { Request, Response, NextFunction, Request as ExpressRequest } from 'express';
import { AuthRequest } from './auth';
import { validatePort5555Access, getPort5555AccessInfo, PORT_5555_CONFIG } from '../config/port5555';
import { AppError, ErrorCode } from '../utils/errors';
import { logAction } from '../services/auditService';
import { logger } from '../utils/logger';

import { redisService } from '../services/redisService';

const PORT5555_RATELIMIT_PREFIX = 'port5555:ratelimit:';

// Port 5555 access control middleware
export const port5555Auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if the request is targeting port 5555
    const isPort5555Request = req.headers['x-port-5555'] === 'true' || 
                              req.path.startsWith('/api/port5555') ||
                              req.originalUrl.includes(':5555');
    
    if (!isPort5555Request) {
      return next();
    }

    // Verify user identity
    if (!req.user) {
      logger.debug('[Port5555Auth] No user found in request');
      throw new AppError('Login required to access port 5555', 401, ErrorCode.UNAUTHORIZED);
    }

    const user = req.user;
    logger.debug(`[Port5555Auth] User: ${user.username}, Role: ${user.role}`);
    
    const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
    logger.debug(`[Port5555Auth] Permissions: ${JSON.stringify(userPermissions)}`);
    
    // Verify access permissions
    const hasAccess = validatePort5555Access(user.role as any, userPermissions);
    logger.debug(`[Port5555Auth] Has access: ${hasAccess}`);
    
    if (!hasAccess) {
      // Record access denial
      await logAction(user.id, 'PORT5555_ACCESS_DENIED', 'port5555', req as ExpressRequest, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        accessInfo: getPort5555AccessInfo(user.role as any, userPermissions)
      });
      
      throw new AppError('Insufficient permissions to access port 5555 management functions', 403, ErrorCode.FORBIDDEN);
    }

    // Record access success
    await logAction(user.id, 'PORT5555_ACCESS_GRANTED', 'port5555', req as ExpressRequest, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });

    // Add port 5555 access info to request object
    req.port5555Access = {
      hasAccess: true,
      userRole: user.role as any,
      userPermissions,
      accessTime: new Date()
    };

    next();
  } catch (error) {
    next(error);
  }
};

// Port 5555 session management middleware
export const port5555Session = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isPort5555Request = req.headers['x-port-5555'] === 'true' || 
                              req.path.startsWith('/api/port5555');
    
    if (!isPort5555Request) {
      return next();
    }

    // Check if session has expired
    const sessionStart = req.session?.port5555SessionStart;
    if (sessionStart) {
      const sessionAge = Date.now() - (typeof sessionStart === 'string' ? new Date(sessionStart).getTime() : sessionStart);
      if (sessionAge > PORT_5555_CONFIG.ACCESS_CONTROL.SESSION_TIMEOUT) {
        // Record access denial
        await logAction(req.user?.id || 0, 'PORT5555_SESSION_EXPIRED', 'port5555', req as ExpressRequest, {
          ipAddress: req.ip,
          sessionAge
        });
        
        throw new AppError('Session expired, please log in again', 401, ErrorCode.UNAUTHORIZED);
      }
    }

    // Update session time
    if (req.session) {
      req.session.port5555SessionStart = req.session.port5555SessionStart || Date.now();
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Port 5555 rate limiting middleware
export const port5555RateLimit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isPort5555Request = req.headers['x-port-5555'] === 'true' || 
                              req.path.startsWith('/api/port5555');
    
    if (!isPort5555Request) {
      return next();
    }

    const key = `${PORT5555_RATELIMIT_PREFIX}${req.user?.id || req.ip}`;
    const windowMs = PORT_5555_CONFIG.ACCESS_CONTROL.RATE_LIMIT.windowMs;
    const windowSec = Math.ceil(windowMs / 1000);
    
    const count = await redisService.incr(key, windowSec);
    const ttl = await redisService.getTTL(key); // Assuming redisService has getTTL, if not I might need to implement it or use a different approach
    const resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
    
    if (count > PORT_5555_CONFIG.ACCESS_CONTROL.RATE_LIMIT.max) {
      // Record rate limit violation
      await logAction(req.user?.id || 0, 'PORT5555_RATE_LIMIT_EXCEEDED', 'port5555', req as ExpressRequest, {
        ipAddress: req.ip,
        requestCount: count,
        limit: PORT_5555_CONFIG.ACCESS_CONTROL.RATE_LIMIT.max
      });
      
      throw new AppError(
        PORT_5555_CONFIG.ACCESS_CONTROL.RATE_LIMIT.message, 
        429, 
        ErrorCode.TOO_MANY_REQUESTS
      );
    }

    // Set response headers
    res.set({
      'X-RateLimit-Limit': PORT_5555_CONFIG.ACCESS_CONTROL.RATE_LIMIT.max.toString(),
      'X-RateLimit-Remaining': Math.max(0, PORT_5555_CONFIG.ACCESS_CONTROL.RATE_LIMIT.max - count).toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString()
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Port 5555 security headers middleware
export const port5555SecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  const isPort5555Request = req.headers['x-port-5555'] === 'true' || 
                            req.path.startsWith('/api/port5555');
  
  if (!isPort5555Request) {
    return next();
  }

  // Set security headers
  if (PORT_5555_CONFIG.SECURITY.FORCE_HTTPS) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  if (PORT_5555_CONFIG.SECURITY.ENABLE_CSP) {
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  }
  
  if (PORT_5555_CONFIG.SECURITY.ENABLE_XSS_PROTECTION) {
    res.set('X-XSS-Protection', '1; mode=block');
  }
  
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');

  next();
};

// Extend Express request type
declare global {
  namespace Express {
    interface Request {
      port5555Access?: {
        hasAccess: boolean;
        userRole: string;
        userPermissions: string[];
        accessTime: Date;
      };
    }
  }
}