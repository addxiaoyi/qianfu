/**
 * 属性测试 (Property-Based Testing) 示例与配置
 *
 * 使用 fast-check 进行属性测试
 *
 * 属性测试 vs 传统单元测试:
 * - 单元测试: 指定输入 -> 验证输出 (示例: expect(add(2, 3)).toBe(5))
 * - 属性测试: 指定不变量 -> 随机生成大量输入 -> 验证不变量始终成立
 *
 * 优势:
 * - 发现边缘情况和边界bug
 * - 减少编写测试用例的工作量
 * - 更强的信心保证
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================
// 示例 1: 简单函数的属性测试
// ============================================================

/**
 * 属性: 加法运算
 * - 交换律: a + b = b + a
 * - 单位元: a + 0 = a
 * - 正负抵消: a + (-a) = 0
 */
describe('数学运算属性测试', () => {
  it('加法交换律: a + b 始终等于 b + a', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000000, max: 1000000 }),
        fc.integer({ min: -1000000, max: 1000000 }),
        (a, b) => {
          expect(a + b).toBe(b + a);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('加法单位元: 任何数加0等于自身', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000000, max: 1000000 }),
        (a) => {
          expect(a + 0).toBe(a);
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('乘法分配律: a * (b + c) = a * b + a * c', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        (a, b, c) => {
          // 使用 Object.is 处理 +0 和 -0 的情况
          const left = a * (b + c);
          const right = a * b + a * c;
          expect(Object.is(left, right)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ============================================================
// 示例 2: 字符串操作的属性测试
// ============================================================

describe('字符串操作属性测试', () => {
  it('字符串反转两次等于原字符串', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        (str) => {
          const reversed = str.split('').reverse().join('');
          const doubleReversed = reversed.split('').reverse().join('');
          expect(doubleReversed).toBe(str);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('字符串拼接长度等于长度之和', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 50 }),
        (a, b) => {
          const concatenated = a + b;
          expect(concatenated.length).toBe(a.length + b.length);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('字符串包含检查具有自反性', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (str) => {
          // 过滤掉空字符串和空白字符串
          if (str.length === 0) return;
          expect(str.includes(str)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ============================================================
// 示例 3: 数组操作的属性测试
// ============================================================

describe('数组操作属性测试', () => {
  it('数组成员顺序反转后长度不变', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
        (arr) => {
          const reversed = [...arr].reverse();
          expect(reversed.length).toBe(arr.length);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('数组 filter 后长度不超过原数组', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
        fc.func(fc.boolean()),
        (arr, predicate) => {
          const filtered = arr.filter(predicate);
          expect(filtered.length).toBeLessThanOrEqual(arr.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('数组合并后长度等于长度之和', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        (a, b) => {
          const merged = [...a, ...b];
          expect(merged.length).toBe(a.length + b.length);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('数组 map 后长度不变', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
        fc.func(fc.integer()),
        (arr, mapper) => {
          const mapped = arr.map(mapper);
          expect(mapped.length).toBe(arr.length);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ============================================================
// 示例 4: JSON 序列化属性测试
// ============================================================

describe('JSON 序列化属性测试', () => {
  it('JSON parse 后再 stringify 保持有效 JSON 结构', () => {
    fc.assert(
      fc.property(
        fc.jsonObject({ maxDepth: 5 }),
        (obj) => {
          const serialized = JSON.stringify(obj);
          const parsed = JSON.parse(serialized);
          expect(parsed).toEqual(obj);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('JSON stringify 不改变原始值', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.float(),
          fc.boolean(),
          fc.constant(null)
        ),
        (value) => {
          const serialized = JSON.stringify(value);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual(value);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ============================================================
// 示例 5: 邮箱验证属性测试
// ============================================================

describe('邮箱格式属性测试', () => {
  // 简单的邮箱格式验证
  const isValidEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  it('包含 @ 和 . 且 @ 在 . 之前是有效邮箱的必要条件', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (email) => {
          // 如果有 @ 符号，它必须在第一个点之前
          const atIndex = email.indexOf('@');
          const dotIndex = email.indexOf('.');
          const hasValidStructure = (atIndex > 0 && dotIndex > atIndex + 1) ||
            (!email.includes('@') && !email.includes('.'));

          // 如果格式有效，正则应该接受它
          if (hasValidStructure && !email.includes(' ') && email.length > 5) {
            expect(isValidEmail(email)).toBe(true);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('有效邮箱格式一致性', () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        (email) => {
          expect(isValidEmail(email)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// 示例 6: 排序算法属性测试
// ============================================================

describe('排序算法属性测试', () => {
  it('排序后数组长度不变', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
        (arr) => {
          const sorted = [...arr].sort((a, b) => a - b);
          expect(sorted.length).toBe(arr.length);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('排序后数组是升序的', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 1, maxLength: 100 }),
        (arr) => {
          const sorted = [...arr].sort((a, b) => a - b);
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1]);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  it('排序后数组包含原数组所有元素 (多重重排列)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        (arr) => {
          const sorted = [...arr].sort((a, b) => a - b);
          const sortedCounts = sorted.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
          }, {} as Record<number, number>);
          const originalCounts = arr.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
          }, {} as Record<number, number>);
          expect(sortedCounts).toEqual(originalCounts);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ============================================================
// 示例 7: UUID/ID 生成属性测试
// ============================================================

describe('ID 生成属性测试', () => {
  const isValidUUID = (uuid: string): boolean => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  };

  it('UUID 格式始终有效', () => {
    fc.assert(
      fc.property(
        fc.uuidV(4),
        (uuid) => {
          expect(isValidUUID(uuid)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('生成的 UUID 长度恒定为 36', () => {
    fc.assert(
      fc.property(
        fc.uuidV(4),
        (uuid) => {
          expect(uuid.length).toBe(36);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// 示例 8: 日期操作属性测试
// ============================================================

describe('日期操作属性测试', () => {
  it('日期加一天后大于原日期', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01'), max: new Date('2100-12-31') }),
        (date) => {
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          expect(nextDay.getTime()).toBeGreaterThan(date.getTime());
        }
      ),
      { numRuns: 200 }
    );
  });

  it('日期转 ISO 字符串始终包含日期信息', () => {
    fc.assert(
      fc.property(
        fc.date(),
        (date) => {
          const isoString = date.toISOString();
          expect(isoString).toContain('-');
          expect(isoString).toContain('T');
          expect(isoString.length).toBe(24); // YYYY-MM-DDTHH:mm:ss.sssZ
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ============================================================
// 示例 9: 缓存行为属性测试
// ============================================================

describe('缓存行为属性测试', () => {
  // 模拟简单缓存
  const createCache = <T>() => {
    const store = new Map<string, { value: T; expiresAt: number }>();

    return {
      get: (key: string): T | undefined => {
        const entry = store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
          store.delete(key);
          return undefined;
        }
        return entry.value;
      },
      set: (key: string, value: T, ttl: number) => {
        store.set(key, { value, expiresAt: Date.now() + ttl });
      },
      size: () => store.size,
    };
  };

  it('缓存设置后可以获取相同值', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ maxLength: 100 }),
        (fc as any).context(),
        (key, value, ctx) => {
          const cache = createCache<string>();
          cache.set(key, value, 60000); // 1分钟 TTL
          const cached = cache.get(key);
          expect(cached).toBe(value);
          ctx.log(`Cache hit for key: ${key}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('不存在的键返回 undefined', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (key) => {
          const cache = createCache<string>();
          const result = cache.get(key);
          expect(result).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// 示例 10: 速率限制器属性测试
// ============================================================

describe('速率限制器属性测试', () => {
  // 简单滑动窗口速率限制器
  const createRateLimiter = (maxRequests: number, windowMs: number) => {
    const timestamps: number[] = [];

    return {
      tryAcquire: (): boolean => {
        const now = Date.now();
        // 清理过期时间戳
        while (timestamps.length > 0 && now - timestamps[0] > windowMs) {
          timestamps.shift();
        }
        if (timestamps.length < maxRequests) {
          timestamps.push(now);
          return true;
        }
        return false;
      },
      getCount: () => timestamps.length,
    };
  };

  it('未超过限制时允许请求', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (limit) => {
          const limiter = createRateLimiter(limit, 60000);
          for (let i = 0; i < limit; i++) {
            expect(limiter.tryAcquire()).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('超过限制后拒绝请求', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (limit) => {
          const limiter = createRateLimiter(limit, 60000);
          // 先用完所有配额
          for (let i = 0; i < limit; i++) {
            limiter.tryAcquire();
          }
          // 下一个请求应该被拒绝
          expect(limiter.tryAcquire()).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================
// 集成到 Vitest
// ============================================================

describe('fast-check 与 Vitest 集成', () => {
  it('使用 expect 直接断言 (推荐方式)', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        (a, b) => {
          // Vitest 的 expect 可以直接在属性测试中使用
          expect(a * b).toBe(b * a);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('使用自定义断言函数', () => {
    const commutative = <T>(a: T, b: T, op: (x: T, y: T) => T) => {
      return op(a, b) === op(b, a);
    };

    fc.assert(
      fc.property(
        fc.integer(),
        fc.integer(),
        (a, b) => commutative(a, b, (x, y) => x * y)
      ),
      { numRuns: 100 }
    );
  });

  it('使用 fc.skip 跳过慢速测试', () => {
    // fc.skip 用于跳过某些测试用例
    fc.assert(
      fc.property(
        fc.integer(),
        (n) => {
          if (n === 0) return; // 跳过 n=0 的情况
          expect(n * n).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
