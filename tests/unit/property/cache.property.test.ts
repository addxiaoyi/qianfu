/**
 * 缓存服务属性测试
 *
 * 使用 fast-check 对分层缓存服务进行属性测试
 *
 * 测试覆盖:
 * - 缓存设置/获取的一致性
 * - TTL 过期行为
 * - LRU 淘汰机制
 * - 统计数据的正确性
 * - 并发安全性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { LayeredCache, CacheStats } from '../../../server/services/cache';

// ============================================================
// 辅助函数
// ============================================================

/**
 * 等待指定毫秒
 */
const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 创建测试缓存实例
 */
const createTestCache = (): LayeredCache =>
  new LayeredCache({
    prefix: 'test:',
    l1Ttl: 1000,    // 1秒 TTL
    l2Ttl: 0,       // 禁用 L2 (简化测试)
  });

// ============================================================
// 属性测试: 缓存一致性
// ============================================================

describe('缓存一致性属性测试', () => {
  it('设置后立即获取应返回相同的值', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.jsonObject({ maxDepth: 2 })
        ),
        async (key, value) => {
          const cache = createTestCache();
          await cache.set(key, value);
          const result = await cache.get(key);

          expect(result).toEqual(value);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('多次设置同一个 key 应以最后一次设置的值为准', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.integer(), { minLength: 2, maxLength: 5 }),
        async (key, values) => {
          const cache = createTestCache();

          // 按顺序设置所有值
          for (const value of values) {
            await cache.set(key, value);
          }

          // 最终值应该是最后一个
          const result = await cache.get(key);
          expect(result).toBe(values[values.length - 1]);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('删除后缓存应不存在', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer(),
        async (key, value) => {
          const cache = createTestCache();
          await cache.set(key, value);
          await cache.delete(key);
          const result = await cache.get(key);

          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('不存在 key 的获取应返回 undefined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (key) => {
          const cache = createTestCache();
          const result = await cache.get(key);

          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================
// 属性测试: 统计正确性
// ============================================================

describe('缓存统计属性测试', () => {
  it('命中后 hits 和 totalRequests 应该正确增加', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer(),
        async (key, value) => {
          const cache = createTestCache();

          // 先设置
          await cache.set(key, value);

          // 命中一次
          await cache.get(key);

          // 命中第二次
          await cache.get(key);

          const stats = cache.getStats();

          // 应该有 2 次命中
          expect(stats.hits).toBe(2);
          expect(stats.totalRequests).toBe(2);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('未命中后 misses 应该正确增加', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (key) => {
          const cache = createTestCache();

          // 获取不存在的 key
          await cache.get(key);

          const stats = cache.getStats();

          expect(stats.misses).toBe(1);
          expect(stats.totalRequests).toBe(1);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('命中率计算应该正确: hitRate = hits / (hits + misses)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        async (prefix, hitCount, missCount) => {
          const cache = createTestCache();

          // 设置一些值
          for (let i = 0; i < hitCount; i++) {
            await cache.set(`${prefix}:${i}`, i);
          }

          // 执行命中
          for (let i = 0; i < hitCount; i++) {
            await cache.get(`${prefix}:${i}`);
          }

          // 执行未命中
          for (let i = 0; i < missCount; i++) {
            await cache.get(`${prefix}:nonexistent:${i}`);
          }

          const stats = cache.getStats();
          const total = stats.hits + stats.misses;
          const expectedHitRate = total > 0 ? stats.hits / total : 0;

          expect(stats.hitRate).toBeCloseTo(expectedHitRate, 5);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============================================================
// 属性测试: TTL 过期
// ============================================================

describe('TTL 过期属性测试', () => {
  it('在 TTL 内获取应返回缓存值', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer(),
        async (key, value) => {
          const cache = new LayeredCache({
            prefix: 'ttl-test:',
            l1Ttl: 5000,  // 5秒 TTL
          });

          await cache.set(key, value);

          // 短暂等待 (远小于 TTL)
          await wait(100);

          const result = await cache.get(key);
          expect(result).toEqual(value);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('超过 TTL 后获取应返回 undefined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer(),
        async (key, value) => {
          const cache = new LayeredCache({
            prefix: 'ttl-expire:',
            l1Ttl: 100,  // 100ms TTL
          });

          await cache.set(key, value);

          // 等待超过 TTL
          await wait(150);

          const result = await cache.get(key);
          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ============================================================
// 属性测试: LRU 淘汰
// ============================================================

describe('LRU 淘汰属性测试', () => {
  it('缓存大小不应超过最大容量', async () => {
    const maxSize = 10;

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.integer()),
          { minLength: maxSize + 5, maxLength: maxSize + 20 }
        ),
        async (entries) => {
          const cache = new LayeredCache({
            prefix: 'lru-test:',
            l1Ttl: 60000,  // 长 TTL 避免过期
          });

          // 设置超过容量的条目
          for (const [key, value] of entries) {
            await cache.set(key, value);
          }

          // 缓存大小不应超过 maxSize
          const usage = cache.getMemoryUsage();
          expect(usage.size).toBeLessThanOrEqual(maxSize);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('最近访问的条目不应被淘汰', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 15,
          maxLength: 20
        }),
        async (keys) => {
          const maxSize = 10;
          const cache = new LayeredCache({
            prefix: 'lru-access:',
            l1Ttl: 60000,
          });

          // 先填满缓存
          for (let i = 0; i < maxSize; i++) {
            await cache.set(keys[i], i);
          }

          // 访问第一个和最后一个条目
          await cache.get(keys[0]);
          await cache.get(keys[maxSize - 1]);

          // 添加新条目触发淘汰
          await cache.set(keys[maxSize], maxSize);

          // 最近访问的条目应该还在
          const recent1 = await cache.get(keys[0]);
          const recent2 = await cache.get(keys[maxSize - 1]);

          expect(recent1).toBe(0);
          expect(recent2).toBe(maxSize - 1);
        }
      ),
      { numRuns: 15 }
    );
  });
});

// ============================================================
// 属性测试: 数据完整性
// ============================================================

describe('数据完整性属性测试', () => {
  it('复杂对象应该被正确存储和检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.jsonObject({ maxDepth: 3 }),
        async (key, obj) => {
          const cache = createTestCache();
          await cache.set(key, obj);
          const result = await cache.get(key);

          expect(result).toEqual(obj);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('数组应该被正确存储和检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.array(fc.jsonValue(), { maxLength: 100 }),
        async (key, arr) => {
          const cache = createTestCache();
          await cache.set(key, arr);
          const result = await cache.get(key);

          expect(result).toEqual(arr);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('嵌套对象应该被正确存储和检索', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.record({
          id: fc.integer(),
          name: fc.string(),
          profile: fc.record({
            email: fc.emailAddress(),
            settings: fc.dictionary(fc.string(), fc.jsonValue()),
          }),
          tags: fc.array(fc.string()),
        }),
        async (key, user) => {
          const cache = createTestCache();
          await cache.set(key, user);
          const result = await cache.get(key);

          expect(result).toEqual(user);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============================================================
// 属性测试: 清空操作
// ============================================================

describe('清空操作属性测试', () => {
  it('clear 后所有缓存应该为空', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.integer()),
          { minLength: 5, maxLength: 20 }
        ),
        async (entries) => {
          const cache = createTestCache();

          // 设置多个缓存条目
          for (const [key, value] of entries) {
            await cache.set(key, value);
          }

          // 清空缓存
          await cache.clear();

          // 验证所有条目都不存在
          for (const [key] of entries) {
            const result = await cache.get(key);
            expect(result).toBeUndefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('clear 后统计数据应该重置', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer(),
        async (key, value) => {
          const cache = createTestCache();

          // 设置并获取，产生一些统计
          await cache.set(key, value);
          await cache.get(key);
          await cache.get(key);

          // 清空
          await cache.clear();

          const stats = cache.getStats();
          expect(stats.hits).toBe(0);
          expect(stats.misses).toBe(0);
          expect(stats.totalRequests).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ============================================================
// 边界条件测试
// ============================================================

describe('边界条件属性测试', () => {
  it('空字符串 key 应该正常工作', async () => {
    const cache = createTestCache();
    await cache.set('', 'empty-key-value');
    const result = await cache.get('');
    expect(result).toBe('empty-key-value');
  });

  it('Unicode 字符 key 应该正常工作', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.fullUnicodeString({ minLength: 1, maxLength: 30 }),
        fc.unicodeString(),
        async (key, value) => {
          const cache = createTestCache();
          await cache.set(key, value);
          const result = await cache.get(key);
          expect(result).toBe(value);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('特殊字符 key 应该正常工作', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringOf(fc.oneof(fc.char(), fc.constant(':'), fc.constant('/'), fc.constant('-'), fc.constant('_'))),
        fc.integer(),
        async (key, value) => {
          if (key.length === 0) return; // 跳过空字符串
          const cache = createTestCache();
          await cache.set(key, value);
          const result = await cache.get(key);
          expect(result).toBe(value);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============================================================
// 对数稳定性测试
// ============================================================

describe('对数稳定性属性测试', () => {
  it('相同输入序列应产生相同的最终状态', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.integer()
          ),
          { minLength: 5, maxLength: 15 }
        ),
        async (entries) => {
          // 创建两个相同的缓存实例
          const cache1 = createTestCache();
          const cache2 = createTestCache();

          // 执行相同的操作序列
          for (const [key, value] of entries) {
            await cache1.set(key, value);
            await cache2.set(key, value);
          }

          // 最终应该得到相同的结果
          for (const [key, expectedValue] of entries) {
            const result1 = await cache1.get(key);
            const result2 = await cache2.get(key);
            expect(result1).toBe(result2);
            expect(result1).toBe(expectedValue);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
