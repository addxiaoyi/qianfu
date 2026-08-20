# 优化项 205: 自动化测试 - CI集成

**自动化测试 - CI集成**

本项目使用 Vitest 作为测试框架，配合 GitHub Actions 实现：
1. 单元测试 - 核心业务逻辑
2. 集成测试 - API 路由和中间件
3. 覆盖率报告 - Codecov 集成
4. 自动化部署 - 测试通过后自动部署

## 一、测试策略

### 1.1 测试金字塔

```
        /\
       /  \
      / E2E \         <- 端到端测试 (Playwright)
     /--------\
    / 集成测试  \       <- API、中间件、数据库交互
   /------------\
  /   单元测试   \     <- 业务逻辑、工具函数、验证
 /----------------\
```

### 1.2 测试覆盖范围

| 层级 | 覆盖内容 | 目标覆盖率 |
|------|----------|-----------|
| 单元测试 | lib/*, middleware/*, services/* | 80%+ |
| 集成测试 | routes/*, 核心流程 | 60%+ |
| E2E测试 | 关键用户流程 | 核心路径 |

---

## 二、技术选型

| 工具 | 用途 | 优势 |
|------|------|------|
| Vitest | 单元/集成测试 | 极速启动、Vite 原生支持 |
| @vitest/coverage-v8 | 覆盖率报告 | V8 引擎高性能 |
| Playwright | E2E测试 | 跨浏览器、现代化 |
| GitHub Actions | CI/CD | 官方集成、免费额度 |

---

## 三、实施清单

- [x] 1. vitest.config.ts - 测试框架配置
- [x] 2. package.test.json - 测试依赖配置
- [x] 3. tests/unit/ - 单元测试目录
  - [x] server/lib/logger.test.ts - 日志服务测试
  - [x] server/lib/metrics.test.ts - 指标服务测试
  - [x] server/config/env.test.ts - 环境配置测试
  - [x] server/middleware/security/security-center.test.ts - 安全中间件测试
  - [x] server/services/cache.test.ts - 缓存服务测试
- [x] 4. tests/integration/ - 集成测试目录
  - [x] server/routes/compliance.test.ts - 合规API测试
- [x] 5. tests/e2e/ - E2E测试目录
  - [x] auth.spec.ts - 认证流程测试
  - [x] search.spec.ts - 搜索功能测试
  - [x] global-setup.ts / global-teardown.ts - E2E环境配置
- [x] 6. playwright.config.ts - E2E测试配置
- [x] 7. .github/workflows/ci.yml - GitHub Actions CI工作流
- [x] 8. tests/utils/ - 测试工具库
- [x] 9. tests/setup.ts - 全局测试设置

---

## 四、覆盖率要求

根据等保2.0和SOC2合规要求，关键模块必须达到：

```yaml
# 覆盖率阈值
server/middleware/security/: 90%
server/lib/logger.ts: 80%
server/services/: 75%
server/routes/: 60%
```

---

## 五、CI 流程

```yaml
触发条件:
  - push 到 main 分支
  - pull request 到 main 分支
  - 手动触发 (workflow_dispatch)

执行步骤:
  1. 环境准备 (Node.js 18+)
  2. 依赖安装 (pnpm install --frozen-lockfile)
  3. 类型检查 (pnpm typecheck)
  4. Lint 检查 (pnpm lint)
  5. 单元测试 (pnpm test:unit)
  6. 集成测试 (pnpm test:integration)
  7. E2E测试 (pnpm test:e2e)
  8. 覆盖率上传 (Codecov)
  9. 部署 (可选)
```

---

## 六、执行命令

```bash
# 安装测试依赖
pnpm install -f package.test.json

# 运行所有测试
pnpm test

# 仅运行单元测试
pnpm test:unit

# 仅运行集成测试
pnpm test:integration

# 仅运行 E2E 测试
pnpm test:e2e

# 监听模式（开发时使用）
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage

# 打开测试 UI
pnpm test:ui
```

---

## 七、CI 配置要求

需要在 GitHub Secrets 中配置以下密钥：

| 密钥名 | 说明 |
|--------|------|
| `CODECOV_TOKEN` | Codecov 上传令牌 |
| `SNYK_TOKEN` | Snyk 安全扫描令牌（可选） |
| `DEPLOY_HOST` | 部署服务器地址 |
| `DEPLOY_USER` | 部署服务器用户名 |
| `DEPLOY_KEY` | SSH 私钥 |

---

## 八、相关文档

- `server/middleware/security/` - 安全中间件（含等保2.0实现）
- `server/middleware/security/compliance-core.ts` - 合规核心
- `server/lib/logger.ts` - 日志服务
- `docs/OPTIMIZATION-120-DENGBAO-COMPLIANCE.md` - 等保合规

---

## 九、更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-07-06 | 1.0 | 初始版本，Vitest + GitHub Actions CI |
