import { Response } from 'express';
import { redisService } from './redisService.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  staleWhileRevalidate?: boolean;
}

interface LRUCacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
}

class LRUCache<T> {
  private cache: Map<string, LRUCacheEntry<T>>;
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000, cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.lastAccessed = Date.now();
    entry.accessCount++;
    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl || this.defaultTTL),
      lastAccessed: Date.now(),
      accessCount: 0,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    let lowestAccessCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return;
      }

      if (entry.lastAccessed < oldestTime || 
          (entry.lastAccessed === oldestTime && entry.accessCount < lowestAccessCount)) {
        oldestTime = entry.lastAccessed;
        lowestAccessCount = entry.accessCount;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  size(): number {
    return this.cache.size;
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

class TTLCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs: number;
  private maxSize: number;

  constructor(cleanupIntervalMs: number = 60000, maxSize: number = 10000) {
    this.cache = new Map();
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.maxSize = maxSize;
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number = 300000): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
      hits: 0,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return;
      }

      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  size(): number {
    return this.cache.size;
  }

  getEntryStats(key: string): { hits: number; age: number; isExpired: boolean } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return {
      hits: entry.hits,
      age: Date.now() - entry.createdAt,
      isExpired: Date.now() > entry.expiresAt,
    };
  }

  getStats(): { size: number; maxSize: number; entries: { key: string; hits: number; age: number }[] } {
    const entries = [];
    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        hits: entry.hits,
        age: Date.now() - entry.createdAt,
      });
    }
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries,
    };
  }

  *entries(): IterableIterator<[string, T]> {
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() <= entry.expiresAt) {
        yield [key, entry.value];
      }
    }
  }
}

const memoryCache = new TTLCache(60000, 5000);
const lruCache = new LRUCache(500, 300000, 60000);
const serverCache = new LRUCache(1000, 60000, 30000);
const authCache = new LRUCache(100, 300000, 60000);

function cacheGet<T>(key: string, cache: TTLCache<T> | LRUCache<T> = memoryCache as TTLCache<T>): T | null {
  return cache.get(key);
}

function cacheSet<T>(key: string, value: T, ttlMs: number = 300000, cache: TTLCache<T> | LRUCache<T> = memoryCache as TTLCache<T>): void {
  if (cache instanceof TTLCache) {
    cache.set(key, value, ttlMs);
  } else {
    cache.set(key, value, ttlMs);
  }
}

function cacheDelete(key: string, cache: TTLCache<unknown> | LRUCache<unknown> = memoryCache): boolean {
  return cache.delete(key);
}

function cacheClear(cache: TTLCache<unknown> | LRUCache<unknown> = memoryCache): void {
  cache.clear();
}

async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300000, staleWhileRevalidate = false } = options;

  // Check memory cache first for fastest response
  const cached = cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Primary: Redis retrieval
  const redisCached = await redisService.get<T>(key);
  if (redisCached !== null) {
    // Populate memory cache for next time
    cacheSet(key, redisCached, ttl);
    return redisCached;
  }

  return fetcher()
    .then(async (value) => {
      // 3. Set Memory & Redis
      cacheSet(key, value, ttl);
      await redisService.set(key, value, Math.floor(ttl / 1000));
      return value;
    })
    .catch(async (error) => {
      if (staleWhileRevalidate) {
        const stale = (await redisService.get<T>(key)) || cacheGet<T>(key);
        if (stale !== null) {
          return stale;
        }
      }
      throw error;
    });
}

function memoize<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: CacheOptions = {}
): (...args: unknown[]) => Promise<T> {
  const { ttl = 300000, maxSize } = options;

  return (...args: unknown[]): Promise<T> => {
    const key = JSON.stringify(args);
    return withCache(key, () => fn(...args), { ttl, maxSize });
  };
}

function createMemoizedFunction<T, A extends unknown[]>(
  fn: (...args: A) => T,
  getKey: (...args: A) => string,
  ttlMs: number = 300000
): (...args: A) => T | null {
  const cache = new TTLCache<T>(60000, 1000);

  return (...args: A): T | null => {
    const key = getKey(...args);
    const cached = cache.get(key);
    if (cached !== null) {
      return cached;
    }

    const result = fn(...args);
    if (result instanceof Promise) {
      result.then((value) => cache.set(key, value, ttlMs)).catch(() => {});
      return null;
    }

    cache.set(key, result, ttlMs);
    return result;
  };
}

function setCacheHeaders(res: Response, maxAge: number = 31536000): void {
  (res as any).setHeader('Cache-Control', `public, max-age=${maxAge}, immutable`);
  (res as any).setHeader('ETag', `"${Date.now().toString(36)}"`);
}

function setNoCacheHeaders(res: Response): void {
  (res as any).setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  (res as any).setHeader('Pragma', 'no-cache');
  (res as any).setHeader('Expires', '0');
}

function setPrivateCacheHeaders(res: Response, maxAge: number = 0): void {
  (res as any).setHeader('Cache-Control', `private, max-age=${maxAge}`);
}

async function tryGetFromCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; staleTime?: number } = {}
): Promise<T> {
  const { ttl = 300000, staleTime = 60000 } = options;

  const cached = cacheGet<T>(key);
  if (cached !== null) {
    const entryStats = memoryCache.getEntryStats(key);
    if (entryStats && !entryStats.isExpired) {
      if (entryStats.age < staleTime) {
        return cached;
      }
    }
  }

  return withCache(key, fetcher, { ttl });
}

function invalidateCache(pattern: string | RegExp): number {
  let invalidated = 0;

  if (typeof pattern === 'string') {
    if (memoryCache.delete(pattern)) invalidated++;
    if (lruCache.delete(pattern)) invalidated++;
    if (serverCache.delete(pattern)) invalidated++;
    if (authCache.delete(pattern)) invalidated++;
  } else {
    const keys: string[] = [];
    for (const key of (memoryCache as unknown as Map<string, unknown>).keys()) {
      if (pattern.test(key)) keys.push(key);
    }
    for (const key of keys) {
      if (memoryCache.delete(key)) invalidated++;
    }
  }

  return invalidated;
}

function getCacheStats(): {
  memoryCache: { size: number; maxSize: number };
  lruCache: { size: number; maxSize: number };
  serverCache: { size: number; maxSize: number };
  authCache: { size: number; maxSize: number };
} {
  return {
    memoryCache: { size: memoryCache.size(), maxSize: (memoryCache as any).maxSize || 5000 },
    lruCache: lruCache.getStats(),
    serverCache: serverCache.getStats(),
    authCache: authCache.getStats(),
  };
}

function cleanupAllCaches(): { memory: number; lru: number; server: number; auth: number } {
  return {
    memory: memoryCache.cleanup(),
    lru: lruCache.cleanup(),
    server: serverCache.cleanup(),
    auth: authCache.cleanup(),
  };
}

export {
  TTLCache,
  LRUCache,
  memoryCache,
  lruCache,
  serverCache,
  authCache,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheClear,
  withCache,
  memoize,
  createMemoizedFunction,
  setCacheHeaders,
  setNoCacheHeaders,
  setPrivateCacheHeaders,
  tryGetFromCache,
  invalidateCache,
  getCacheStats,
  cleanupAllCaches,
};

export type { CacheOptions, CacheEntry, LRUCacheEntry };
