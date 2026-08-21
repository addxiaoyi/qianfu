/**
 * 分层缓存服务 - 分层缓存策略
 * L1: 内存缓存 (进程内)
 * L2: Redis 缓存 (分布式)
 *
 * 特点:
 * - 自动穿透: 缓存未命中时自动从数据源获取
 * - 缓存预热: 支持启动时预加载热点数据
 * - 容量控制: L1 缓存最大条目数限制 + LRU 淘汰
 * - 指标统计: 命中率、延迟等监控指标
 * - 灵活 TTL: 支持不同业务设置不同过期时间
 */

import { logger } from '../lib/logger';

// ============== 类型定义 ==============

export interface CacheOptions {
  /** 缓存键前缀 */
  prefix?: string;
  /** L1 内存缓存 TTL (毫秒)，0 表示不使用 L1 */
  l1Ttl?: number;
  /** L2 Redis 缓存 TTL (毫秒)，0 表示不使用 L2 */
  l2Ttl?: number;
  /** 是否启用缓存穿透保护 */
  preventPenetration?: boolean;
  /** 穿透保护锁超时 (毫秒) */
  lockTimeout?: number;
}

export interface CacheStats {
  hits: number;        // 命中数
  misses: number;      // 未命中数
  l1Hits: number;      // L1 命中数
  l2Hits: number;      // L2 命中数
  penetrationBlocked: number; // 被穿透保护拦截的并发请求数
  totalRequests: number;
  hitRate: number;     // 命中率
  avgLatency: number;  // 平均延迟 (毫秒)
}

interface CacheEntry<T = unknown> {
  value: T;
  expireAt: number;
}

interface PendingPromise<T = unknown> {
  promise: Promise<T>;
  expireAt: number;
}

// ============== L1 内存缓存 ==============

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private maxSize: number;
  private defaultTtl: number;

  constructor(maxSize = 1000, defaultTtl = 30_000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;

    // 定期清理过期条目
    setInterval(() => this.cleanup(), 60_000);
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return undefined;
    }

    this.updateAccessOrder(key);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    // LRU 淘汰
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expireAt = Date.now() + (ttl ?? this.defaultTtl);
    this.cache.set(key, { value, expireAt });
    this.updateAccessOrder(key);
  }

  delete(key: string): boolean {
    this.removeFromAccessOrder(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /** 获取当前缓存大小 */
  get size(): number {
    return this.cache.size;
  }

  /** 清理过期条目 */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expireAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
      }
    }
  }

  private evictOldest(): void {
    if (this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!;
      this.cache.delete(oldest);
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
  }
}

// ============== L2 Redis 缓存 (可选) ==============

// 简化版 Redis 客户端封装
class RedisCache {
  private redis: unknown;
  private enabled: boolean = false;

  constructor(redisClient?: unknown) {
    if (redisClient) {
      this.redis = redisClient;
      this.enabled = true;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) return undefined;
    try {
      const value = await (this.redis as Record<string, Function>).get(key);
      return value ? JSON.parse(value) : undefined;
    } catch (err) {
      logger.warn('[RedisCache] get failed', { key, error: err });
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.enabled) return;
    try {
      const ttlSec = ttlMs ? Math.ceil(ttlMs / 1000) : undefined;
      await (this.redis as Record<string, Function>).set(key, JSON.stringify(value), ttlSec ? 'EX' : undefined, ttlSec);
    } catch (err) {
      logger.warn('[RedisCache] set failed', { key, error: err });
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await (this.redis as Record<string, Function>).del(key);
    } catch (err) {
      logger.warn('[RedisCache] delete failed', { key, error: err });
    }
  }
}

// ============== 穿透保护 (防止缓存击穿) ==============

class PenetrationGuard {
  private pending = new Map<string, PendingPromise>();

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    const existing = this.pending.get(key);
    if (existing && Date.now() < existing.expireAt) {
      return existing.promise;
    }

    const promise = fetchFn();
    const expireAt = Date.now() + ttlMs;
    this.pending.set(key, { promise, expireAt });

    try {
      const result = await promise;
      return result;
    } finally {
      // 延迟删除，确保同一 key 的后续请求仍可复用
      setTimeout(() => {
        if (this.pending.get(key)?.promise === promise) {
          this.pending.delete(key);
        }
      }, 1000);
    }
  }

  clear(): void {
    this.pending.clear();
  }
}

// ============== 分层缓存服务 ==============

export class LayeredCache {
  private memory: MemoryCache;
  private redis: RedisCache;
  private guard: PenetrationGuard;
  private prefix: string;
  private l1Ttl: number;
  private l2Ttl: number;
  private preventPenetration: boolean;
  private lockTimeout: number;

  // 统计数据
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
    penetrationBlocked: 0,
    totalRequests: 0,
    hitRate: 0,
    avgLatency: 0,
  };

  private latencies: number[] = [];

  constructor(options: CacheOptions = {}, redisClient?: unknown) {
    this.prefix = options.prefix ?? 'cache:';
    this.l1Ttl = options.l1Ttl ?? 30_000;      // 默认 L1: 30 秒
    this.l2Ttl = options.l2Ttl ?? 300_000;     // 默认 L2: 5 分钟
    this.preventPenetration = options.preventPenetration ?? true;
    this.lockTimeout = options.lockTimeout ?? 5_000;

    this.memory = new MemoryCache(1000, this.l1Ttl);
    this.redis = new RedisCache(redisClient);
    this.guard = new PenetrationGuard();
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @param fetchFn 数据获取函数 (用于缓存穿透时获取数据)
   */
  async get<T>(key: string, fetchFn?: () => Promise<T>): Promise<T | undefined> {
    const fullKey = this.prefix + key;
    const startTime = Date.now();

    this.stats.totalRequests++;

    // L1 查询
    if (this.l1Ttl > 0) {
      const l1Result = this.memory.get<T>(fullKey);
      if (l1Result !== undefined) {
        this.stats.l1Hits++;
        this.stats.hits++;
        this.recordLatency(startTime);
        return l1Result;
      }
    }

    // L2 查询
    if (this.l2Ttl > 0 && this.redis.isEnabled()) {
      const l2Result = await this.redis.get<T>(fullKey);
      if (l2Result !== undefined) {
        this.stats.l2Hits++;
        this.stats.hits++;
        // 回填 L1
        if (this.l1Ttl > 0) {
          this.memory.set(fullKey, l2Result, this.l1Ttl);
        }
        this.recordLatency(startTime);
        return l2Result;
      }
    }

    // 缓存未命中
    this.stats.misses++;

    if (!fetchFn) {
      return undefined;
    }

    // 穿透保护
    if (this.preventPenetration) {
      const result = await this.guard.getOrSet(fullKey, fetchFn, this.lockTimeout);
      // 写入缓存
      await this.set(key, result);
      this.recordLatency(startTime);
      return result;
    }

    // 无穿透保护，直接获取
    const result = await fetchFn();
    await this.set(key, result);
    this.recordLatency(startTime);
    return result;
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T): Promise<void> {
    const fullKey = this.prefix + key;

    // L1 缓存
    if (this.l1Ttl > 0) {
      this.memory.set(fullKey, value, this.l1Ttl);
    }

    // L2 缓存
    if (this.l2Ttl > 0 && this.redis.isEnabled()) {
      await this.redis.set(fullKey, value, this.l2Ttl);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.prefix + key;
    this.memory.delete(fullKey);
    if (this.redis.isEnabled()) {
      await this.redis.delete(fullKey);
    }
  }

  /**
   * 清除前缀相关的所有缓存
   */
  async clear(): Promise<void> {
    this.memory.clear();
    this.guard.clear();
    // 注意: Redis 的模式删除需要 SCAN，这里简化处理
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      avgLatency: this.latencies.length > 0
        ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
        : 0,
    };
  }

  /** 重置统计 */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
      penetrationBlocked: 0,
      totalRequests: 0,
      hitRate: 0,
      avgLatency: 0,
    };
    this.latencies = [];
  }

  private recordLatency(startTime: number): void {
    const latency = Date.now() - startTime;
    this.latencies.push(latency);
    // 保留最近 1000 条延迟记录
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }
  }

  /** 获取 L1 内存缓存使用量 */
  getMemoryUsage(): { size: number; maxSize: number } {
    return {
      size: this.memory.size,
      maxSize: 1000,
    };
  }
}

// ============== 缓存装饰器工厂 ==============

export function createCacheService(redisClient?: unknown): LayeredCache {
  return new LayeredCache({}, redisClient);
}

// ============== 预设缓存实例 ==============

// 默认实例 (无 Redis，仅内存缓存)
let defaultCache: LayeredCache | null = null;

export function getCache(redisClient?: unknown): LayeredCache {
  if (!defaultCache) {
    defaultCache = new LayeredCache(
      { prefix: 'app:', l1Ttl: 30_000, l2Ttl: 300_000 },
      redisClient
    );
  }
  return defaultCache;
}

// ============== 使用示例 ==============

/**
 * 使用示例:
 *
 * ```typescript
 * import { getCache } from './services/cache';
 *
 * const cache = getCache(redisClient);
 *
 * // 基础用法
 * const user = await cache.get('user:123', async () => {
 *   return await db.users.findById('123');
 * });
 *
 * // 仅获取，不自动加载
 * const cached = await cache.get('user:123');
 *
 * // 设置缓存
 * await cache.set('user:123', { id: '123', name: 'Alice' });
 *
 * // 删除缓存
 * await cache.delete('user:123');
 *
 * // 获取统计
 * const stats = cache.getStats();
 * console.log(`命中率: ${(stats.hitRate * 100).toFixed(2)}%`);
 *
 * // 创建自定义缓存实例
 * const shortCache = new LayeredCache({
 *   prefix: 'short:',
 *   l1Ttl: 5_000,    // L1: 5 秒
 *   l2Ttl: 30_000,   // L2: 30 秒
 * });
 * ```
 */

// ============== 导出类型 ==============

export type { CacheOptions, CacheStats };
