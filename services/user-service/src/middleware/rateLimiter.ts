/**
 * Rate Limiter Middleware
 */

import { Request, Response, RequestHandler } from 'express';
import { RateLimitError } from '@qianfu/shared';
import { logger } from '../utils/logger.js';

interface RateLimitStore {
  get(key: string): number | undefined;
  set(key: string, value: number, ttl: number): void;
  delete(key: string): void;
}

// Simple in-memory store (use Redis in production)
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { value: number; expiry: number }>();

  get(key: string): number | undefined {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: number, ttl: number): void {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

export function createRateLimiter(config: RateLimitConfig): RequestHandler {
  const store = new MemoryStore();
  const { windowMs, max, keyGenerator } = config;

  return (req: Request, res: Response, next) => {
    const key = keyGenerator?.(req) || req.ip || 'unknown';
    const now = Date.now();

    // Get current count
    let count = store.get(key) || 0;
    count++;

    if (count > max) {
      logger.warn(`[RateLimit] Limit exceeded for ${key}`);
      throw new RateLimitError(Math.ceil(windowMs / 1000));
    }

    // Update store
    store.set(key, count, windowMs / 1000);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

    if (count > max * 0.8) {
      logger.info(`[RateLimit] Approaching limit for ${key}: ${count}/${max}`);
    }

    next();
  };
}

// Default rate limiter for API routes
export const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: (req) => `api:${req.ip}:${req.path}`,
});

// Stricter rate limiter for auth routes
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => `auth:${req.ip}`,
});

// Very strict rate limiter for login attempts
export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyGenerator: (req) => `login:${req.ip}`,
});
