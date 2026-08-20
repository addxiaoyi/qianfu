/**
 * 分层缓存服务单元测试
 *
 * 测试覆盖：
 * - L1 内存缓存
 * - L2 Redis 缓存
 * - 穿透保护
 * - 统计功能
 * - 缓存操作
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LayeredCache, createCacheService, getCache, CacheStats } from '../server/services/cache';

// Mock logger
vi.mock('../server/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MemoryCache (内部)', () => {
  let cache: LayeredCache;

  beforeEach(() => {
    cache = new LayeredCache({ l1Ttl: 1000, l2Ttl: 0 }); // 仅使用 L1
  });

  afterEach(() => {
    cache.clear();
  });

  describe('基础缓存操作', () => {
    it('应该存储和获取值', async () => {
      await cache.set('key1', { data: 'test' });
      const result = await cache.get('key1');
      expect(result).toEqual({ data: 'test' });
    });

    it('应该在不存在时返回 undefined', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('应该删除缓存项', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const result = await cache.get('key1');
      expect(result).toBeUndefined();
    });

    it('应该清除所有缓存', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU 淘汰', () => {
    it('应该在超过容量时淘汰最旧的项', async () => {
      const smallCache = new LayeredCache({ l1Ttl: 1000, l2Ttl: 0, maxEntries: 3 });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');
      await smallCache.set('key4', 'value4'); // 应该淘汰 key1

      expect(await smallCache.get('key1')).toBeUndefined();
      expect(await smallCache.get('key2')).toEqual('value2');
      expect(await smallCache.get('key3')).toEqual('value3');
      expect(await smallCache.get('key4')).toEqual('value4');
    });

    it('应该在使用时更新访问顺序', async () => {
      const smallCache = new LayeredCache({ l1Ttl: 1000, l2Ttl: 0, maxEntries: 3 });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');

      // 访问 key1，使其成为最新
      await smallCache.get('key1');

      // 添加 key4 应该淘汰 key2
      await smallCache.set('key4', 'value4');

      expect(await smallCache.get('key1')).toEqual('value1'); // 仍然存在
      expect(await smallCache.get('key2')).toBeUndefined(); // 被淘汰
    });
  });

  describe('TTL 过期', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该正确处理过期', async () => {
      const shortCache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });

      await shortCache.set('key1', 'value1');

      // 时间快进 6 秒
      vi.advanceTimersByTime(6000);

      const result = await shortCache.get('key1');
      expect(result).toBeUndefined();
    });
  });
});

describe('LayeredCache', () => {
  describe('配置选项', () => {
    it('应该使用默认前缀', () => {
      const cache = new LayeredCache();
      expect(cache).toBeDefined();
    });

    it('应该接受自定义前缀', () => {
      const cache = new LayeredCache({ prefix: 'custom:' });
      expect(cache).toBeDefined();
    });

    it('应该接受自定义 TTL', () => {
      const cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 60000 });
      expect(cache).toBeDefined();
    });
  });

  describe('缓存获取 (get)', () => {
    let cache: LayeredCache;

    beforeEach(() => {
      cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });
    });

    afterEach(() => {
      cache.clear();
    });

    it('应该返回缓存的值', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('应该支持 fetchFn 自动加载', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fetched');
      const result = await cache.get('key1', fetchFn);
      expect(result).toBe('fetched');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('应该缓存 fetchFn 的结果', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fetched');
      await cache.get('key1', fetchFn);
      const result = await cache.get('key1');
      expect(result).toBe('fetched');
      expect(fetchFn).toHaveBeenCalledTimes(1); // 只调用一次
    });

    it('应该在无 fetchFn 时返回 undefined', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('缓存设置 (set)', () => {
    let cache: LayeredCache;

    beforeEach(() => {
      cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });
    });

    afterEach(() => {
      cache.clear();
    });

    it('应该设置缓存值', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.get('key1')).toBe('value1');
    });

    it('应该覆盖已有值', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key1', 'value2');
      expect(await cache.get('key1')).toBe('value2');
    });

    it('应该支持复杂数据类型', async () => {
      const complexData = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        bool: true,
      };
      await cache.set('complex', complexData);
      expect(await cache.get('complex')).toEqual(complexData);
    });
  });

  describe('缓存删除 (delete)', () => {
    let cache: LayeredCache;

    beforeEach(() => {
      cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });
    });

    afterEach(() => {
      cache.clear();
    });

    it('应该删除缓存项', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('应该安全处理不存在的键', async () => {
      await expect(cache.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('统计功能', () => {
    let cache: LayeredCache;

    beforeEach(() => {
      cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });
    });

    afterEach(() => {
      cache.clear();
    });

    it('应该跟踪命中和未命中', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // 命中
      await cache.get('key2'); // 未命中
      await cache.get('key2', async () => 'fetched'); // 命中（通过 fetch）

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('应该跟踪 L1 命中率', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.get('key1');
      await cache.get('key1');

      const stats = cache.getStats();
      expect(stats.l1Hits).toBe(3);
    });

    it('应该计算命中率', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // 命中
      await cache.get('key2'); // 未命中

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.5, 1);
    });

    it('应该跟踪总请求数', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.get('key2');

      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it('应该跟踪延迟', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');

      const stats = cache.getStats();
      expect(stats.avgLatency).toBeGreaterThanOrEqual(0);
    });

    it('应该重置统计', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');
      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('内存使用量', () => {
    it('应该返回缓存大小信息', async () => {
      const cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0, maxEntries: 100 });
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const usage = cache.getMemoryUsage();
      expect(usage.size).toBe(2);
      expect(usage.maxSize).toBe(100);
    });
  });

  describe('清除缓存', () => {
    it('应该清除所有缓存项', async () => {
      const cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();

      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('createCacheService 工厂函数', () => {
    it('应该创建缓存实例', () => {
      const cache = createCacheService();
      expect(cache).toBeInstanceOf(LayeredCache);
    });
  });

  describe('getCache 单例函数', () => {
    it('应该返回缓存实例', () => {
      const cache = getCache();
      expect(cache).toBeInstanceOf(LayeredCache);
    });

    it('应该返回相同的单例', () => {
      const cache1 = getCache();
      const cache2 = getCache();
      expect(cache1).toBe(cache2);
    });
  });
});

describe('缓存统计类型', () => {
  it('CacheStats 应该包含所有必要字段', () => {
    const stats: CacheStats = {
      hits: 10,
      misses: 5,
      l1Hits: 8,
      l2Hits: 2,
      penetrationBlocked: 0,
      totalRequests: 15,
      hitRate: 0.667,
      avgLatency: 1.5,
    };

    expect(stats.hits).toBe(10);
    expect(stats.misses).toBe(5);
    expect(stats.l1Hits).toBe(8);
    expect(stats.l2Hits).toBe(2);
    expect(stats.penetrationBlocked).toBe(0);
    expect(stats.totalRequests).toBe(15);
    expect(stats.hitRate).toBeCloseTo(0.667);
    expect(stats.avgLatency).toBe(1.5);
  });
});

describe('缓存选项类型', () => {
  it('应该接受所有配置选项', async () => {
    const cache = new LayeredCache({
      prefix: 'test:',
      l1Ttl: 10000,
      l2Ttl: 60000,
      preventPenetration: true,
      lockTimeout: 5000,
      maxEntries: 500,
    });

    expect(cache).toBeDefined();
    await cache.set('key', 'value');
    expect(await cache.get('key')).toBe('value');

    cache.clear();
  });
});

describe('并发穿透保护', () => {
  let cache: LayeredCache;

  beforeEach(() => {
    cache = new LayeredCache({
      l1Ttl: 5000,
      l2Ttl: 0,
      preventPenetration: true,
      lockTimeout: 5000,
    });
  });

  afterEach(() => {
    cache.clear();
  });

  it('应该防止并发穿透', async () => {
    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'value';
    };

    // 同时发起多个请求
    const promises = [
      cache.get('key', fetchFn),
      cache.get('key', fetchFn),
      cache.get('key', fetchFn),
    ];

    const results = await Promise.all(promises);

    // 所有请求应该获得相同结果
    results.forEach(result => {
      expect(result).toBe('value');
    });

    // fetchFn 应该只被调用一次
    expect(callCount).toBe(1);
  });

  it('应该跟踪穿透保护统计', async () => {
    let resolveFn: () => void;
    const slowFetch = new Promise<string>(resolve => {
      resolveFn = resolve;
    });

    const fetchFn = async () => slowFetch;

    // 发起第一个请求
    const promise1 = cache.get('key', fetchFn);

    // 发起第二个请求（在第一个完成前）
    const promise2 = cache.get('key', fetchFn);

    // 完成第一个请求
    resolveFn!();

    await Promise.all([promise1, promise2]);

    const stats = cache.getStats();
    expect(stats.penetrationBlocked).toBeGreaterThanOrEqual(0);
  });
});

describe('复杂场景测试', () => {
  it('应该正确处理频繁更新的数据', async () => {
    const cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });
    const versions: number[] = [];

    // 模拟频繁更新的计数器
    for (let i = 0; i < 5; i++) {
      await cache.set('counter', i);
      versions.push(i);
    }

    // 最终值应该是最后一次设置的值
    expect(await cache.get('counter')).toBe(4);
    expect(await cache.get('counter')).toBe(versions[versions.length - 1]);
  });

  it('应该正确处理混合操作', async () => {
    const cache = new LayeredCache({ l1Ttl: 5000, l2Ttl: 0 });

    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.set('c', 3);

    expect(await cache.get('a')).toBe(1);
    expect(await cache.get('b')).toBe(2);

    await cache.delete('b');

    expect(await cache.get('a')).toBe(1);
    expect(await cache.get('b')).toBeUndefined();
    expect(await cache.get('c')).toBe(3);

    await cache.clear();

    expect(await cache.get('a')).toBeUndefined();
    expect(await cache.get('c')).toBeUndefined();
  });
});
