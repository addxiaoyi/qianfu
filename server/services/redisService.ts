import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import { metricsService } from './metricsService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class MemoryCache {
  private cache = new Map<string, { value: any; expiry: number }>();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: any, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  setIfNotExists(key: string, value: any, ttlSeconds: number): boolean {
    const existing = this.get(key);
    if (existing !== null && existing !== undefined) {
      return false;
    }
    this.set(key, value, ttlSeconds);
    return true;
  }

  del(key: string): void {
    this.cache.delete(key);
  }

  incr(key: string, ttlSeconds?: number): number {
    const current = this.get<number>(key) || 0;
    const next = current + 1;
    this.set(key, next, ttlSeconds || 3600);
    return next;
  }

  expire(key: string, ttlSeconds: number): void {
    const item = this.cache.get(key);
    if (item) {
      item.expiry = Date.now() + ttlSeconds * 1000;
    }
  }
}

class RedisService {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private memoryFallback = new MemoryCache();

  constructor() {
    if (process.env.REDIS_ENABLED === 'true') {
      this.init();
    }
  }

  private init() {
    try {
      this.client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('[Redis] Connected successfully');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error('[Redis] Connection error:', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } catch (error) {
      logger.error('[Redis] Initialization failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      return this.memoryFallback.get<T>(key);
    }
    try {
      const data = await this.client.get(key);
      if (data) {
        metricsService.recordRedisHit();
        return JSON.parse(data);
      } else {
        metricsService.recordRedisMiss();
        return null;
      }
    } catch (error) {
      logger.warn(`[Redis] Get failed for key ${key}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to memory cache on error for higher availability
      return this.memoryFallback.get<T>(key);
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    // Always write to memory cache as L1/Backup
    this.memoryFallback.set(key, value, ttlSeconds);

    if (!this.isConnected || !this.client) {
      return;
    }
    try {
      const data = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, data);
    } catch (error: any) {
      logger.warn(`[Redis] Set failed for key ${key}:`, error.message);
      // Memory cache is already updated
    }
  }

  async setIfNotExists(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    // Memory fallback can still provide best-effort replay protection.
    const memoryFirst = this.memoryFallback.setIfNotExists(key, value, ttlSeconds);

    if (!this.isConnected || !this.client) {
      return memoryFirst;
    }

    try {
      const data = JSON.stringify(value);
      const result = await this.client.set(key, data, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error: any) {
      logger.warn(`[Redis] setIfNotExists failed for key ${key}:`, error.message);
      return memoryFirst;
    }
  }

  async del(key: string): Promise<void> {
    this.memoryFallback.del(key);
    
    if (!this.isConnected || !this.client) {
      return;
    }
    try {
      await this.client.del(key);
    } catch (error: any) {
      logger.warn(`[Redis] Delete failed for key ${key}:`, error.message);
    }
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.isConnected || !this.client) {
      return this.memoryFallback.incr(key, ttlSeconds);
    }
    try {
      const result = await this.client.incr(key);
      if (ttlSeconds && result === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return result;
    } catch (error: any) {
      logger.warn(`[Redis] Incr failed for key ${key}:`, error.message);
      return this.memoryFallback.incr(key, ttlSeconds);
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.isConnected || !this.client) {
      this.memoryFallback.expire(key, ttlSeconds);
      return;
    }
    try {
      await this.client.expire(key, ttlSeconds);
    } catch (error: any) {
      logger.warn(`[Redis] Expire failed for key ${key}:`, error.message);
      this.memoryFallback.expire(key, ttlSeconds);
    }
  }

  async getTTL(key: string): Promise<number> {
    if (!this.isConnected || !this.client) return -2;
    try {
      return await this.client.ttl(key);
    } catch (error: any) {
      logger.warn(`[Redis] TTL failed for key ${key}:`, error.message);
      return -2;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected || !this.client) return [];
    try {
      return await this.client.keys(pattern);
    } catch (error: any) {
      logger.warn(`[Redis] Keys failed for pattern ${pattern}:`, error.message);
      return [];
    }
  }

  /**
   * Delete keys by pattern (using SCAN for performance)
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error: any) {
      logger.warn(`[Redis] Delete by pattern failed for ${pattern}:`, error.message);
    }
  }

  async flush(): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.flushall();
    } catch (error: any) {
      logger.warn('[Redis] Flush failed:', error.message);
    }
  }

  /**
   * Acquire a distributed lock using Redis (Redlock algorithm simplified)
   * @param key Unique lock key
   * @param ttlSeconds Lock timeout to prevent deadlocks
   * @returns Lock success
   */
  async acquireLock(key: string, ttlSeconds: number = 30): Promise<boolean> {
    if (!this.isConnected || !this.client) return true; // Fail-open if Redis is down
    try {
      const lockKey = `lock:${key}`;
      const result = await this.client.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error: any) {
      logger.error(`[Redis] Acquire lock failed for ${key}:`, error.message);
      // Return false to let business decide retry/error logic, 
      // instead of failing open which causes race conditions
      return false; 
    }
  }

  /**
   * Release a distributed lock
   * @param key Unique lock key
   */
  async releaseLock(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const lockKey = `lock:${key}`;
      await this.client.del(lockKey);
    } catch (error: any) {
      logger.warn(`[Redis] Release lock failed for ${key}:`, error.message);
    }
  }

  /**
   * Execute a function within a distributed lock
   * @param key Unique lock key
   * @param fn Function to execute
   * @param ttlSeconds Lock timeout
   * @returns Function result
   */
  async withLock<T>(key: string, fn: () => Promise<T>, ttlSeconds: number = 30): Promise<T> {
    const acquired = await this.acquireLock(key, ttlSeconds);
    if (!acquired) {
      throw new AppError('Concurrent operation in progress, please try again', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
    }
    try {
      return await fn();
    } finally {
      await this.releaseLock(key);
    }
  }

  getStatus(): boolean {
    return this.isConnected;
  }

  getClient(): Redis | null {
    return this.client;
  }

  async lpush(key: string, value: any): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const data = JSON.stringify(value);
      await this.client.lpush(key, data);
    } catch (error: any) {
      logger.warn(`[Redis] LPush failed for key ${key}:`, error.message);
    }
  }

  async rpop<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.rpop(key);
      return data ? JSON.parse(data) : null;
    } catch (error: any) {
      logger.warn(`[Redis] RPop failed for key ${key}:`, error.message);
      return null;
    }
  }

  async ping(): Promise<string> {
    if (!this.isConnected || !this.client) return 'memory';
    try {
      const result = await this.client.ping();
      return result === 'PONG' ? 'connected' : 'error';
    } catch (error: any) {
      logger.warn('[Redis] Ping failed:', error.message);
      return 'error';
    }
  }
}

export const redisService = new RedisService();
export default redisService;
