# OPTIMIZATION-493: Mutation Testing 变异测试

## 概述

变异测试是一种评估测试套件质量的先进技术，通过故意修改代码（注入"变异"）来验证测试能否检测到这些变更。

### 核心价值

| 指标 | 传统覆盖率 | 变异测试 |
|------|----------|---------|
| 测量内容 | 代码执行路径 | 测试检测能力 |
| 发现问题 | 死代码/未覆盖分支 | 弱测试/逻辑盲点 |
| 置信度 | 中等 | 高 |
| 计算成本 | 低 | 高 |

### 变异操作符示例

```typescript
// 原始代码
function calculatePrice(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

// 一元运算符变异 (NEG)
// return -quantity * unitPrice;

// 二元运算符变异 (ROR - Relational Operator Replacement)
// return quantity <= unitPrice;  (原本是 *)

// 逻辑边界变异 (LCR - Logical Connector Replacement)
// if (quantity > 0 && unitPrice > 0) 变成 ||
```

---

## 技术选型: Stryker Mutator

### 为什么选择 Stryker?

| 特性 | StrykerJS | Pitest (Java) | Mutmut (Python) |
|------|----------|---------------|-----------------|
| TypeScript 支持 | 原生 | 不支持 | 不支持 |
| Vitest 集成 | 良好 | N/A | N/A |
| 变异操作符 | 80+ | 50+ | 20+ |
| 性能 | 中等 | 优秀 | 优秀 |
| 社区活跃度 | 高 | 高 | 中 |

---

## 实施方案

### 1. 安装依赖

```bash
pnpm add -D @stryker-mutator/api @stryker-mutator/core @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker
```

### 2. 配置 Stryker

创建 `stryker.config.json`:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "mutate": [
    "server/**/*.ts",
    "!server/**/*.d.ts",
    "!server/routes/**",
    "!server/bootstrap/**"
  ],
  "testRunner": "vitest",
  "vitestConfigFile": "vitest.config.ts",
  "typescriptChecker": {
    "type": "typescript",
    "workspace": "."
  },
  "mutators": [
    {
      "name": "typescript",
      "excludedMutations": [
        "BooleanLiteral",
        "ArrowFunction",
        "StringLiteral"
      ]
    }
  ],
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  },
  "reporters": [
    "progress",
    "clear-text",
    "html",
    "dashboard"
  ],
  "htmlReporter": {
    "fileName": "reports/mutation/mutation-report.html"
  },
  "timeoutMS": 5000,
  "concurrency": 2,
  "dryRun": false
}
```

### 3. 集成到 package.json

```json
{
  "scripts": {
    "test:mutation": "stryker run",
    "test:mutation:watch": "stryker run --watch",
    "test:mutation:report": "stryker run && open reports/mutation/mutation-report.html"
  }
}
```

### 4. CI/CD 集成

创建 `.github/workflows/mutation-test.yml`:

```yaml
name: Mutation Testing

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  mutation-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run Mutation Tests
        run: pnpm test:mutation
        continue-on-error: true

      - name: Upload mutation report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mutation-report
          path: reports/mutation/

      - name: Comment mutation results
        uses: actions/github-script@v7
        if: github.event_name == 'pull_request'
        with:
          script: |
            const fs = require('fs');
            const summary = fs.readFileSync('reports/mutation/index.json', 'utf8');
            const data = JSON.parse(summary);
            
            const comment = `
            ## Mutation Testing Results
            
            | Metric | Value | Status |
            |--------|-------|--------|
            | Killed | ${data.totals.killed} | - |
            | Survived | ${data.totals.survived} | - |
            | Timeout | ${data.totals.timeout} | - |
            | No Coverage | ${data.totals.noCoverage} | - |
            | **Mutation Score** | **${data.totals.mutationScore.toFixed(2)}%** | ${data.totals.mutationScore >= 80 ? '✅' : '⚠️'} |
            
            ${data.totals.mutationScore < 80 ? '⚠️ Mutation score below threshold (80%)' : '✅ Good mutation coverage'}
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

---

## 核心变异操作符详解

### 1. 条件边界变异 (Conditional Boundary - CBX)

```typescript
// 原始
if (score >= 60) { pass(); }

// 变异后
if (score > 60) { pass(); }      // >= 变成 >
if (score <= 60) { pass(); }     // >= 变成 <=
if (score > 60) { pass(); }      // >= 变成 >
if (score < 60) { pass(); }      // >= 变成 <
```

### 2. 逻辑运算符变异 (Logical Operator - LOG)

```typescript
// 原始
if (isAdmin && hasPermission) { grant(); }

// 变异后
if (isAdmin || hasPermission) { grant(); }  // && 变成 ||
```

### 3. 赋值运算符变异 (Assignment Operator - AOR)

```typescript
// 原始
count += 1;

// 变异后
count -= 1;    // += 变成 -=
count *= 1;    // += 变成 *=
count /= 1;    // += 变成 /=
```

### 4. 返回值变异 (Return Value - RVR)

```typescript
// 原始
function isValid(value: number): boolean {
  return value > 0;
}

// 变异后
function isValid(value: number): boolean {
  return false;  // 总是返回 false
}
```

### 5. 空值变异 (Null Check - NC)

```typescript
// 原始
if (user !== null && user !== undefined) { ... }

// 变异后
if (user === null || user === undefined) { ... }  // 逻辑反转
```

---

## 针对项目特点的优化

### 1. 重点覆盖的业务逻辑

基于项目结构，建议优先对以下模块进行变异测试:

```json
{
  "mutate": [
    "server/middleware/**/*.ts",           // 中间件 - 安全验证
    "server/services/**/*.ts",              // 服务层 - 业务逻辑
    "server/lib/**/*.ts",                   // 工具库 - 核心函数
    "src/auth/**/*.ts",                     // 认证授权
    "src/lib/**/*.ts"                       // 前端核心逻辑
  ],
  "ignoreStatic": [
    "server/routes/**",                     // 路由层 - 集成测试覆盖
    "server/bootstrap/**",                  // 启动代码
    "**/*.test.ts",                         // 测试文件自身
    "**/types/**"                          // 类型定义
  ]
}
```

### 2. 关键测试用例增强

```typescript
// server/services/cache.test.ts - 增强版本
describe('CacheService', () => {
  describe('get/set operations', () => {
    // 基础功能
    it('should store and retrieve value', async () => {
      await cache.set('key', 'value');
      const result = await cache.get('key');
      expect(result).toBe('value');
    });

    // 变异测试重点: 验证边界条件
    it('should handle empty string value', async () => {
      await cache.set('key', '');
      const result = await cache.get('key');
      expect(result).toBe('');
    });

    it('should handle null value correctly', async () => {
      await cache.set('key', null);
      const result = await cache.get('key');
      expect(result).toBeNull();
    });

    it('should handle undefined value correctly', async () => {
      await cache.set('key', undefined);
      const result = await cache.get('key');
      expect(result).toBeUndefined();
    });

    // 数值边界测试 - 变异测试关键
    it('should handle zero correctly', async () => {
      await cache.set('counter', 0);
      const result = await cache.get('counter');
      expect(result).toBe(0);
    });

    it('should handle negative numbers', async () => {
      await cache.set('balance', -100);
      const result = await cache.get('balance');
      expect(result).toBe(-100);
    });

    // 复杂对象测试
    it('should handle nested objects', async () => {
      const obj = { user: { profile: { name: 'test' } } };
      await cache.set('user', obj);
      const result = await cache.get('user');
      expect(result).toEqual(obj);
    });

    // 数组测试
    it('should handle empty arrays', async () => {
      await cache.set('items', []);
      const result = await cache.get('items');
      expect(result).toEqual([]);
    });
  });

  describe('expiration', () => {
    // 时间边界测试
    it('should handle zero TTL', async () => {
      await cache.set('temp', 'data', { ttl: 0 });
      // 验证立即过期行为
    });

    it('should handle negative TTL', async () => {
      await cache.set('temp', 'data', { ttl: -1 });
      // 验证负数 TTL 处理
    });
  });
});
```

### 3. 权限测试增强

```typescript
// src/auth/permissions.test.ts - 变异测试优化版本
describe('Permission System', () => {
  describe('role hierarchy', () => {
    // 原始测试
    it('should grant admin all permissions', () => {
      expect(hasPermission('admin', 'delete:all')).toBe(true);
    });

    // 变异测试增强: 验证边界条件
    it('should deny when role is empty string', () => {
      expect(hasPermission('', 'read')).toBe(false);
    });

    it('should deny when role is undefined', () => {
      expect(hasPermission(undefined, 'read')).toBe(false);
    });

    it('should deny when action is empty string', () => {
      expect(hasPermission('admin', '')).toBe(false);
    });

    it('should deny when action is null', () => {
      expect(hasPermission('admin', null)).toBe(false);
    });

    // 字符串边界测试
    it('should handle case sensitivity correctly', () => {
      expect(hasPermission('Admin', 'read')).toBe(false);
      expect(hasPermission('ADMIN', 'read')).toBe(false);
    });

    it('should handle whitespace in role names', () => {
      expect(hasPermission(' admin', 'read')).toBe(false);
      expect(hasPermission('admin ', 'read')).toBe(false);
    });
  });

  describe('permission combinations', () => {
    // 逻辑运算符变异测试重点
    it('should handle AND logic correctly', () => {
      // 如果 hasPermission 用 && 连接多个条件
      // 变异测试会将其改为 ||
      expect(hasPermission('user', 'read') && hasPermission('user', 'write')).toBe(false);
    });

    it('should handle OR fallback correctly', () => {
      // 验证 || 逻辑的备选方案
    });
  });
});
```

---

## 性能优化策略

### 1. 选择性变异

```json
{
  "mutate": {
    "expressions": {
      "enabled": true,
      "skip": [
        "console.log",
        "console.error",
        "debugger"
      ]
    },
    "statements": {
      "enabled": true,
      "skip": [
        "throw new Error('Not implemented')"
      ]
    }
  }
}
```

### 2. 并行化配置

```json
{
  "concurrency": 4,
  "timeoutMS": 3000,
  "maxConcurrentTestRunners": 2
}
```

### 3. 增量测试

```json
{
  "incremental": true,
  "incrementalFile": ".stryker/incremental.json"
}
```

---

## 与现有测试的协同

### Vitest 覆盖率 vs 变异测试

| 测试类型 | 目的 | 阈值 | 工具 |
|---------|-----|------|-----|
| 单元测试 | 功能正确性 | 90% 覆盖率 | Vitest |
| 变异测试 | 测试质量 | 80% 得分 | Stryker |
| E2E 测试 | 端到端流程 | - | Playwright |

### 渐进式实施

```bash
# 阶段1: 仅对核心模块启用
stryker run --mutate "server/lib/**/*.ts"

# 阶段2: 扩展到服务层
stryker run --mutate "server/{lib,services}/**/*.ts"

# 阶段3: 完整覆盖
stryker run
```

---

## 预期收益

### 质量提升指标

| 指标 | 实施前 | 实施后目标 |
|-----|-------|-----------|
| 测试套件检测能力 | 未知 | >80% |
| 弱测试发现数 | 0 | 预期 5-15 个 |
| 死代码/冗余逻辑 | 未知 | 预期 3-8 处 |
| 逻辑盲点 | 未知 | 预期 2-5 个 |

### 发现的问题类型

1. **永远通过的测试** - 断言不足
2. **永远失败的测试** - 错误假设
3. **冗余逻辑** - 未被测试覆盖的代码路径
4. **边界条件缺失** - 空值、零值、极端值未测试

---

## 维护指南

### 定期审查

```bash
# 每月生成变异测试报告
pnpm test:mutation:report

# 分析 surviving mutants
cat reports/mutation/index.json | jq '.results[] | select(.status=="survived")'
```

### 阈值调整

根据项目成熟度调整阈值:

- **初始阶段**: 50% (允许部分 surviving mutants)
- **稳定阶段**: 70% (强制改进)
- **成熟阶段**: 80% (质量门槛)

---

## 相关文档

- [Stryker 官方文档](https://stryker-mutator.io/docs/)
- [Vitest 集成指南](https://stryker-mutator.io/docs/stryker-js/vitest-runner)
- [变异测试最佳实践](https://stryker-mutator.io/docs/General/BestPractices/)
