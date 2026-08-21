# 属性测试 (Property-Based Testing) 指南

## 概述

属性测试是一种不同于传统单元测试的测试方法。它通过以下方式验证代码的正确性：

| 特征 | 单元测试 | 属性测试 |
|------|----------|----------|
| 测试方式 | 指定输入 → 验证输出 | 指定不变量 → 随机生成输入 → 验证不变量 |
| 覆盖范围 | 手动选择的用例 | 自动生成的大量随机用例 |
| 发现能力 | 依赖测试者经验 | 能发现意想不到的边缘情况 |

## 安装

本项目使用 `fast-check` 作为属性测试框架：

```bash
npm install --save-dev fast-check --legacy-peer-deps
```

## 快速开始

### 基本语法

```typescript
import * as fc from 'fast-check';

it('加法交换律', () => {
  fc.assert(
    fc.property(
      fc.integer(),  // 生成器1
      fc.integer(),  // 生成器2
      (a, b) => {
        // 验证不变量
        expect(a + b).toBe(b + a);
      }
    ),
    { numRuns: 1000 }  // 运行1000次
  );
});
```

### 常用生成器

```typescript
// 基础类型
fc.integer()                    // 任意整数
fc.float()                      // 任意浮点数
fc.boolean()                    // 布尔值
fc.string()                     // 任意字符串
fc.char()                      // 单个字符

// 带约束
fc.integer({ min: 1, max: 100 })           // 1-100 的整数
fc.string({ minLength: 5, maxLength: 20 }) // 5-20 字符的字符串
fc.array(fc.integer(), { minLength: 1, maxLength: 10 }) // 整数数组

// 特定格式
fc.emailAddress()               // 邮箱地址
fc.webUrl()                    // URL
fc.uuidV(4)                    // UUID v4
fc.jsonObject()                // JSON 对象
fc.date()                      // 日期

// 组合
fc.oneof(fc.integer(), fc.string())        // 任选一
fc.tuple(fc.string(), fc.integer())         // 元组
fc.record({ name: fc.string(), age: fc.integer() }) // 记录对象
fc.dictionary(fc.string(), fc.integer())   // 字典
```

### 异步属性测试

```typescript
it('异步缓存测试', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string(),
      fc.integer(),
      async (key, value) => {
        const cache = new Cache();
        await cache.set(key, value);
        const result = await cache.get(key);
        expect(result).toBe(value);
      }
    ),
    { numRuns: 100 }
  );
});
```

## 项目中的属性测试

### 测试文件位置

```
tests/unit/property/
├── fast-check-examples.test.ts    # fast-check 使用示例
├── cache.property.test.ts         # 缓存服务属性测试
└── logger.property.test.ts        # 日志服务属性测试
```

### 运行属性测试

```bash
# 运行所有属性测试
npm test -- tests/unit/property

# 运行特定的属性测试文件
npm test -- tests/unit/property/cache.property.test.ts

# 带覆盖率运行
npm test -- tests/unit/property --coverage
```

## 属性测试策略

### 1. 数学不变量

```typescript
// 加法交换律
expect(a + b).toBe(b + a);

// 乘法结合律
expect(a * (b * c)).toBe((a * b) * c);

// 字符串长度
expect((a + b).length).toBe(a.length + b.length);
```

### 2. 结构不变量

```typescript
// 数组排序后长度不变
expect(sorted.length).toBe(arr.length);

// JSON 序列化/反序列化保持一致
expect(JSON.parse(JSON.stringify(obj))).toEqual(obj);
```

### 3. 逆向属性

```typescript
// 如果 hash(x) = y，则 hash(hash(x)) = hash(y)
// 即: hash 应用两次后应该更"混乱"
const h1 = hash(input);
const h2 = hash(h1);
expect(entropy(h2)).toBeGreaterThan(entropy(h1));
```

### 4. 状态转换不变量

```typescript
// 缓存: 设置后获取应返回相同值
await cache.set(key, value);
expect(await cache.get(key)).toBe(value);

// 缓存: 删除后获取应返回 undefined
await cache.delete(key);
expect(await cache.get(key)).toBeUndefined();
```

## 常见问题

### Q: 属性测试失败时如何调试？

A: 使用 `fc.configureGlobal` 设置 seed 来复现：

```typescript
fc.configureGlobal({
  seed: 12345,  // 使用失败时的 seed
});
```

### Q: 如何缩小测试范围？

A: 使用 `fc.filter` 或 `fc.suchThat`：

```typescript
fc.property(
  fc.integer().filter(n => n !== 0),  // 过滤掉 0
  (n) => { /* ... */ }
);
```

### Q: 测试太慢怎么办？

A: 调整 `numRuns` 或使用快速生成器：

```typescript
// 减少运行次数
{ numRuns: 100 }

// 使用更快的生成器
fc.integer()  // 比 fc.integer({ min: -1000000, max: 1000000 }) 快
```

### Q: 如何跳过特定用例？

A: 使用 `fc.skip`：

```typescript
fc.assert(
  fc.property(fc.integer(), (n) => {
    if (n === 0) fc.skip();  // 跳过 n=0
    expect(n * n).toBeGreaterThan(0);
  })
);
```

## 最佳实践

1. **从简单的不变量开始**: 先测试显而易见的性质
2. **组合生成器**: 使用 `fc.tuple`、`fc.record` 构建复杂输入
3. **设置合理的 `numRuns`**: 通常 100-1000 次足够发现大多数问题
4. **注意边界情况**: 使用约束生成器测试边界
5. **与其他测试方法结合**: 属性测试 + 单元测试 + 集成测试

## 参考资源

- [fast-check 官方文档](https://fast-check.github.io/)
- [Property-Based Testing Book](https://pragprog.com/book/bhprop/property-based-testing-with-proptest)
- [What is Property-Based Testing?](https://blog.properties.dev/what-is-property-based-testing/)
