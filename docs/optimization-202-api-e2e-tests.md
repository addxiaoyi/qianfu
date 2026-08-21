# 优化项 202: 集成测试 - API端到端

## 概述

本文档描述了为项目实现的 API 端到端测试方案。该测试套件覆盖了核心 API 端点，包括合规 API、语义搜索 API 和 Metrics API。

## 测试文件结构

```
tests/e2e/
├── api-helpers.ts                    # 测试辅助工具和Mock数据
├── api-global-setup.ts               # 测试前环境准备
├── api-global-teardown.ts            # 测试后环境清理
├── test-orchestrator.ts              # 测试编排器
│
├── compliance-api.spec.ts             # 合规API E2E测试
├── semantic-search-api.spec.ts       # 语义搜索API E2E测试
└── metrics-api.spec.ts              # Metrics API E2E测试
```

## 测试覆盖

### 1. 合规 API 测试 (compliance-api.spec.ts)

| 模块 | 测试用例数 | 覆盖内容 |
|------|-----------|---------|
| 认证与授权 | 4 | 登录、Token验证、权限检查 |
| 合规报告 | 6 | 报告生成、时间范围、审计证据 |
| 控制目标管理 | 7 | CRUD操作、过滤、权限控制 |
| 安全事件管理 | 7 | 创建、更新、过滤、错误处理 |
| 访问控制记录 | 5 | 记录查询、添加、权限控制 |
| 变更管理 | 5 | 变更请求CRUD |
| 隐私保护 | 5 | 隐私请求、同意记录 |
| 备份与恢复 | 5 | 备份记录、恢复测试 |
| 数据资产管理 | 5 | 资产CRUD、分类过滤 |
| 错误处理 | 6 | 无效路径、超长输入、并发请求 |
| 性能基准 | 2 | 响应时间基准 |

**总计: 57 个测试用例**

### 2. 语义搜索 API 测试 (semantic-search-api.spec.ts)

| 模块 | 测试用例数 | 覆盖内容 |
|------|-----------|---------|
| 连接状态 | 2 | Weaviate连接检查 |
| 索引管理 | 6 | 类创建、查询、删除、统计 |
| 文档操作 | 8 | 文档CRUD、批量操作 |
| 搜索功能 | 5 | 语义搜索、混合搜索、相似性搜索 |
| 嵌入向量 | 3 | 单文本、批量嵌入生成 |
| 错误处理 | 4 | JSON错误、超长查询、空查询 |

**总计: 28 个测试用例**

### 3. Metrics API 测试 (metrics-api.spec.ts)

| 模块 | 测试用例数 | 覆盖内容 |
|------|-----------|---------|
| Prometheus指标 | 2 | 格式验证 |
| 资源监控 | 3 | CPU、内存、磁盘、告警阈值 |
| 简化资源数据 | 5 | 简化格式、数据验证 |
| 健康检查 | 2 | /health/metrics |
| 错误处理 | 2 | 无效路径、方法拒绝 |
| 性能基准 | 2 | 响应时间 |
| 数据一致性 | 2 | 完整/简化数据一致性 |

**总计: 18 个测试用例**

## 运行测试

### 运行所有 API 测试

```bash
# 使用专用配置
npx playwright test --config=playwright.api.config.ts

# 或指定测试文件
npx playwright test tests/e2e/compliance-api.spec.ts --config=playwright.api.config.ts
```

### 运行特定测试套件

```bash
# 只运行合规 API 测试
npx playwright test tests/e2e/compliance-api.spec.ts

# 只运行语义搜索测试
npx playwright test tests/e2e/semantic-search-api.spec.ts

# 只运行 Metrics 测试
npx playwright test tests/e2e/metrics-api.spec.ts
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| BASE_URL | http://localhost:3000 | 测试服务地址 |
| E2E_API | - | 启用API测试配置 |
| CI | - | CI环境标识 |

### 示例命令

```bash
# 本地运行
BASE_URL=http://localhost:3000 npx playwright test --config=playwright.api.config.ts

# CI 环境运行
CI=true npx playwright test --config=playwright.api.config.ts
```

## 测试特性

### 1. 认证与授权测试

- JWT Token 验证
- 角色权限检查 (admin/user)
- 未授权访问防护

### 2. 数据验证

- 必填字段验证
- 数据类型验证
- 分页数据验证

### 3. 错误处理

- 无效 JSON 处理
- 超长输入处理
- 特殊字符处理
- 并发请求处理

### 4. 性能基准

- API 响应时间监控
- 资源使用跟踪

### 5. 数据一致性

- 完整/简化数据格式一致性
- 时间戳有效性验证

## 测试配置

### playwright.api.config.ts

专门为 API 测试优化的配置:

- 禁用 UI 追踪 (trace: off)
- 禁用视频录制 (video: off)
- 只使用 Chromium 浏览器
- 更短的超时时间
- 优化的报告输出

## Mock 数据

测试使用 `api-helpers.ts` 中定义的 Mock 数据生成器:

- `mockData.compliance.*` - 合规模块测试数据
- `mockData.semantic.*` - 语义搜索测试数据
- `mockData.auth.*` - 认证测试数据

## 测试报告

测试结果输出到:

- HTML 报告: `coverage/api-playwright-report/`
- JSON 结果: `coverage/api-playwright-results.json`

## 维护说明

### 添加新测试

1. 在对应的 `*-api.spec.ts` 文件中添加测试
2. 使用 `mockData` 生成器创建测试数据
3. 遵循测试命名规范: `应该[操作][预期结果]`

### 更新 API 端点

1. 同步更新 `api-helpers.ts` 中的 API 路径
2. 更新对应的测试用例
3. 运行测试验证

### 故障排查

- 检查服务是否运行: `pnpm start`
- 检查端口是否正确: `BASE_URL`
- 查看详细日志: `npx playwright test --reporter=list`
