# 负载测试指南

> 优化项 203: 性能测试 - 负载测试

## 概述

本项目提供了一套完整的负载测试解决方案，支持多种负载测试工具和场景。

## 支持的工具

| 工具 | 特点 | 适用场景 |
|------|------|----------|
| **Vitest (Supertest)** | 内置，无需额外依赖 | 快速验证，CI 集成 |
| **Autocannon** | Node.js 实现，高性能 | 详细性能分析，HTTP 基准 |
| **K6** | 现代化，脚本丰富 | 真实场景模拟，CI/CD |

## 快速开始

### 1. Vitest 负载测试

```bash
# 运行负载测试
npm run test:load

# 监视模式
npm run test:load:watch

# 使用 autocannon 进行真实 HTTP 测试
npm run test:load:autocannon
```

### 2. K6 负载测试

首先安装 K6:

```bash
# macOS
brew install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows (使用 chocolatey)
choco install k6
```

运行测试:

```bash
# 本地运行
npm run test:load:k6

# 或直接使用 k6
k6 run scripts/load-test/k6-scenarios.js
```

### 3. CI 负载测试

```bash
# 冒烟测试 (快速验证)
npm run test:load:ci smoke

# 轻负载测试
npm run test:load:ci light

# 中等负载测试
npm run test:load:ci medium

# 压力测试
npm run test:load:ci stress

# 所有测试
npm run test:load:ci all

# 更新基准数据
npm run test:load:ci smoke --update-baseline
```

## 测试场景

### Vitest 测试场景

| 测试组 | 描述 | 阈值 |
|--------|------|------|
| 基础性能测试 | 低/中/高并发测试 | RPS > 50, P95 < 200ms |
| 复杂端点测试 | 复杂数据处理端点 | RPS > 20, P95 < 500ms |
| 持续负载测试 | 30s/60s 持续负载 | 稳定性 + 错误率 < 3% |
| 突发流量测试 | HTTP Pipelining + 高并发 | 峰值处理能力验证 |
| 安全中间件测试 | 中间件性能开销 | 开销 < 100% |

### Autocannon 测试场景

| 场景 | 连接数 | 时长 | 描述 |
|------|--------|------|------|
| simple-get | 10 | 10s | 简单 GET 请求 |
| medium-concurrency | 50 | 10s | 中等并发 |
| high-concurrency | 100 | 10s | 高并发 |
| sustained-load | 30 | 60s | 持续负载 |
| burst-traffic | 200 | 5s | 突发流量 |

### K6 测试场景

K6 支持渐进式负载测试:

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // 0 -> 10 用户
    { duration: '1m', target: 10 },    // 保持 10 用户
    { duration: '30s', target: 0 },    // 下降
  ],
};
```

## 性能阈值

### 默认阈值

| 指标 | 简单端点 | 复杂端点 | 高并发 |
|------|----------|----------|--------|
| 最小 RPS | 50 | 20 | 30 |
| 最大 P95 | 200ms | 500ms | 1000ms |
| 最大 P99 | 500ms | 1000ms | 2000ms |
| 最大错误率 | 1% | 2% | 5% |

### 自定义阈值

通过环境变量配置:

```bash
export MIN_RPS=100
export MAX_P95_LATENCY=300
export MAX_ERROR_RATE=2
```

## 报告生成

### 生成测试报告

```bash
npm run test:load:report
```

报告将保存在 `reports/load-test/` 目录:

```
reports/load-test/
├── summary/
│   ├── report.json    # JSON 格式报告
│   └── report.md      # Markdown 格式报告
├── history/
│   └── baseline.json  # 基准数据
└── current.json       # 当前测试结果
```

### 报告内容

报告包含以下内容:

- 测试汇总 (通过/失败数)
- 各场景详细指标
- 与基准的对比分析
- 性能趋势分析
- 回归检测结果

## CI/CD 集成

### GitHub Actions

项目包含预配置的 GitHub Actions 工作流 (`.github/workflows/load-test.yml`):

```yaml
# 手动触发
on:
  workflow_dispatch:
    inputs:
      test_mode:
        type: choice
        options:
          - smoke
          - light
          - medium
          - stress

# 自动触发
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
```

### 性能回归检测

CI 测试会自动与基准数据比较:

- RPS 下降超过 10% → 失败
- P95 延迟上升超过 20% → 失败
- 错误率显著增加 → 失败

## 最佳实践

### 1. 测试环境

- 使用与生产环境相似的配置
- 隔离网络环境
- 关闭不必要的服务

### 2. 测试时机

- 定期运行冒烟测试
- 发布前运行完整测试
- 监控生产环境的性能趋势

### 3. 阈值设置

- 根据业务需求调整阈值
- 考虑不同时间的性能波动
- 定期更新基准数据

### 4. 分析结果

- 关注 P95/P99 而非平均值
- 分析错误模式和原因
- 对比不同版本的性能变化

## 故障排查

### 常见问题

#### 1. 测试服务器未启动

```
Error: connect ECONNREFUSED
```

确保测试目标服务器正在运行:

```bash
# 启动服务器
npm run dev

# 或指定端口
TEST_BASE_URL=http://localhost:3000 npm run test:load
```

#### 2. 端口占用

```
Error: listen EADDRINUSE :::3001
```

杀死占用端口的进程:

```bash
# macOS/Linux
lsof -i :3001
kill -9 <PID>

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

#### 3. 性能不稳定

- 确保测试环境稳定
- 增加预热时间
- 运行多次取平均值

## 参考资料

- [Autocannon 文档](https://github.com/mcollina/autocannon)
- [K6 文档](https://k6.io/docs/)
- [Vitest 文档](https://vitest.dev/)
- [HTTP 负载测试最佳实践](https://k6.io/docs/testing-guidelines/best-practices/)

## License

MIT
