# Mutation Coverage 优化指南

## 概述

Mutation Coverage（变异测试覆盖率）是一种高级测试质量指标，通过对代码进行语义变异（如将 `>` 改为 `<`，将 `+` 改为 `-` 等），然后验证测试套件是否能检测到这些变异，从而衡量测试的有效性。

## 快速开始

### 安装依赖

```bash
# 在项目根目录执行（使用 test workspace）
pnpm install
```

### 运行 Mutation Coverage

```bash
# 完整 mutation 测试
pnpm --filter qianfu-liandeng test:mutation

# CI 模式（更高并发）
pnpm --filter qianfu-liandeng test:mutation:ci

# 生成并打开报告
pnpm --filter qianfu-liandeng test:mutation:report
```

## 配置说明

### `stryker.config.json`

| 配置项 | 说明 | 推荐值 |
|--------|------|--------|
| `testRunner` | 测试运行器 | `vitest` |
| `coverageAnalysis` | 覆盖分析模式 | `all` |
| `concurrency` | 并发进程数 | `2-4` |
| `timeoutMS` | 单个测试超时 | `10000` |
| `thresholds.mutationScore.high` | 目标覆盖率 | `80%+` |

### 突变运算符

项目使用 TypeScript 优化的突变运算符，排除以下类型：
- `BooleanLiteral` - 布尔字面量
- `ArrowFunction` - 箭头函数

### 覆盖范围

当前配置覆盖以下核心模块：
- `server/lib/**/*.ts` - 核心库
- `server/services/**/*.ts` - 服务层
- `server/middleware/**/*.ts` - 中间件
- `server/config/**/*.ts` - 配置模块

排除范围：
- 路由层 (`server/routes/**`) - 通常由集成测试覆盖
- 启动脚本 (`server/bootstrap/**`)
- 测试文件 (`**/*.test.ts`, `**/*.spec.ts`)

## 报告解读

### 突变评分 (Mutation Score)

| 分数范围 | 状态 | 说明 |
|----------|------|------|
| 90%+ | 优秀 | 测试套件能检测绝大多数变异 |
| 80-90% | 良好 | 有少量变异未被检测 |
| 70-80% | 需改进 | 存在明显的测试盲区 |
| <70% | 不合格 | 需要大幅增强测试 |

### 报告术语

- **Killed**: 测试成功检测并拒绝了变异
- **Survived**: 变异存活，测试未能检测到问题
- **Timeout**: 测试超时，需要优化
- **No Coverage**: 变异代码未被任何测试覆盖
- **Compile Error**: 变异导致编译错误

## 最佳实践

### 1. 增量优化

不要一次性追求完美覆盖率，采用渐进式优化：

```bash
# 先分析未被覆盖的模块
npx stryker run --mutate server/services/cache.ts
```

### 2. 关注 Survived 变异

Survived 变异是最需要关注的点：

```bash
# 查看 Survived 变异详情
cat coverage/mutation/mutation-report.json | jq '.results[].survived'
```

### 3. 添加针对性测试

针对每个 Survived 变异添加测试：

```typescript
// 示例：为 Cache 服务的边界条件添加测试
describe('Cache Edge Cases', () => {
  it('应正确处理空字符串键', async () => {
    const cache = new LayeredCache();
    await cache.set('', 'value');
    expect(await cache.get('')).toBe('value');
  });
});
```

### 4. 调整阈值

根据项目阶段调整阈值：

```javascript
// CI/CD 中使用严格阈值
thresholds: {
  mutationScore: {
    break: 70,  // 低于此值 CI 失败
    low: 80,    // 低于此值发出警告
    high: 85,   // 高于此值通过
  },
}
```

## 常见问题

### Q: Mutation 测试运行很慢怎么办？

A: 可以采用以下策略：
1. 使用 `--concurrency 4` 提高并发
2. 先针对单个文件测试
3. 在 CI 中仅运行关键模块

### Q: 某些 Survived 变异是否需要忽略？

A: 可以使用 Stryker 的忽略注释：

```typescript
/* istanbul ignore next */
function legacyFunction() {
  // stryker-disable-next-line
  return oldLogic;
}
```

### Q: 如何集成到 CI/CD？

A: 添加以下配置到 GitHub Actions：

```yaml
- name: Mutation Coverage
  run: pnpm test:mutation:ci
  env:
    STRYKER_DASHBOARD_API_KEY: ${{ secrets.STRYKER_DASHBOARD_API_KEY }}
```

## 与传统覆盖率的关系

| 指标 | 说明 | 阈值 |
|------|------|------|
| Line Coverage | 代码行覆盖 | 90% |
| Branch Coverage | 分支覆盖 | 90% |
| Mutation Score | 变异覆盖率 | 80%+ |

**重要**: 高行覆盖率不等于高质量测试。Mutation Coverage 能发现测试中的盲区。

## 参考资料

- [Stryker Mutator 官方文档](https://stryker-mutator.io/docs/)
- [Mutation Testing 概念](https://en.wikipedia.org/wiki/Mutation_testing)
