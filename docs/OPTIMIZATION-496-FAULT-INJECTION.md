# 优化项 496: Fault Injection - 故障注入

## 概述

故障注入（Fault Injection）是一种测试系统容错能力的技术，通过人为引入各种故障（延迟、错误、超时等）来验证系统在异常情况下的行为。

## 功能特性

### 支持的故障类型

| 故障类型 | 描述 | 典型场景 |
|---------|------|---------|
| `delay` | 模拟网络延迟 | 测试超时处理 |
| `error` | 返回错误响应 | 测试错误处理逻辑 |
| `500` | 服务器内部错误 | 测试 5xx 错误处理 |
| `502` | 网关错误 | 测试上游服务异常 |
| `503` | 服务不可用 | 测试降级逻辑 |
| `504` | 网关超时 | 测试超时降级 |
| `timeout` | 模拟请求超时 | 测试超时机制 |
| `abort` | 中断连接 | 测试连接中断处理 |
| `network-error` | 网络错误 | 测试网络异常处理 |
| `corrupt` | 返回损坏数据 | 测试数据校验 |
| `slow-response` | 慢响应 | 测试慢查询处理 |

### 核心功能

- 按路由/方法配置故障
- 概率控制（支持百分比）
- 多种故障类型组合
- 故障 ID 追踪
- 详细日志记录
- 响应头标记
- 预定义混沌工程场景

## 快速开始

### 基础使用

```typescript
import { createFaultInjection } from './server/middleware';

// 创建中间件
const faultMiddleware = createFaultInjection({
  enabled: true,
  routes: [{
    path: '/api/users*',
    faults: ['delay', 'error'],
    probability: 0.1,  // 10% 概率触发
  }],
});

// 应用到 Express
app.use(faultMiddleware);
```

### 启用/禁用

```typescript
import { enableFaultInjection, disableFaultInjection } from './server/middleware';

enableFaultInjection();  // 启用
disableFaultInjection(); // 禁用
```

### 添加路由配置

```typescript
import { addFaultRoute, removeFaultRoute } from './server/middleware';

addFaultRoute({
  path: '/api/orders*',
  faults: ['503'],
  probability: 1,
  faultConfig: {
    '503': { type: '503', retryAfter: 60 },
  },
});

removeFaultRoute('/api/orders*');
```

## 完整配置示例

```typescript
import { createFaultInjection } from './server/middleware';

app.use(createFaultInjection({
  // 全局启用
  enabled: true,

  // 启用日志
  logEnabled: true,

  // 标记响应头
  markResponse: true,
  headerName: 'X-Fault-Injection',

  // 默认配置
  defaultProbability: 1.0,    // 100% 触发
  defaultDelay: 1000,         // 默认延迟 1 秒
  defaultErrorCode: 500,      // 默认错误码
  defaultErrorMessage: 'Fault injection error',

  // 路由配置
  routes: [
    {
      path: '/api/users*',
      methods: ['GET', 'POST'],
      faults: ['delay', '500', '503'],
      probability: 0.1,
    },
    {
      path: '/api/orders*',
      faults: ['abort'],
      probability: 0.05,
    },
  ],

  // 排除的路径
  excludePaths: [
    /^\/health$/,
    /^\/metrics$/,
  ],

  // 排除的方法
  excludeMethods: ['OPTIONS'],
}));
```

## 故障类型详解

### 延迟故障 (delay)

```typescript
{
  path: '/api/*',
  faults: ['delay'],
  faultConfig: {
    delay: {
      type: 'delay',
      range: [1000, 5000],  // 1-5 秒随机延迟
      // 或使用 fixed
      // fixed: 2000,       // 固定 2 秒延迟
    },
  },
}
```

### 错误故障 (error)

```typescript
{
  path: '/api/*',
  faults: ['error'],
  faultConfig: {
    error: {
      type: 'error',
      statusCode: 500,
      message: 'Custom error message',
      code: 'CUSTOM_CODE',
      body: { errorDetails: 'More info' },
    },
  },
}
```

### 503 服务不可用

```typescript
{
  path: '/api/*',
  faults: ['503'],
  faultConfig: {
    '503': {
      type: '503',
      retryAfter: 60,        // 60 秒后重试
      message: 'Service maintenance',
    },
  },
}
```

### 超时故障 (timeout)

```typescript
{
  path: '/api/*',
  faults: ['timeout'],
  faultConfig: {
    timeout: {
      type: 'timeout',
      duration: 1000,  // 1 秒超时
    },
  },
}
```

### 数据损坏 (corrupt)

```typescript
{
  path: '/api/*',
  faults: ['corrupt'],
  faultConfig: {
    corrupt: {
      type: 'corrupt',
      ratio: 0.2,       // 20% 字符损坏
      mode: 'random',   // random | null | truncate
    },
  },
}
```

### 慢响应 (slow-response)

```typescript
{
  path: '/api/*',
  faults: ['slow-response'],
  faultConfig: {
    'slow-response': {
      type: 'slow-response',
      chunkDelay: 2000,  // 每个 chunk 延迟 2 秒
      chunkSize: 512,   // chunk 大小 512 字节
    },
  },
}
```

## 预定义场景

### 高延迟场景

```typescript
import { createFaultInjection, FaultScenarios } from './server/middleware';

app.use(createFaultInjection(FaultScenarios.highLatency()));
```

### 随机错误场景 (10%)

```typescript
app.use(createFaultInjection(FaultScenarios.randomErrors()));
```

### 服务宕机场景

```typescript
app.use(createFaultInjection(FaultScenarios.serviceDown()));
```

### 超时场景

```typescript
app.use(createFaultInjection(FaultScenarios.timeouts()));
```

### 混沌工程场景

```typescript
// 包含延迟、错误、503、超时等多种故障
app.use(createFaultInjection(FaultScenarios.chaosEngineering()));
```

## API 接口

### 管理接口

```typescript
// 启用故障注入
enableFaultInjection();

// 禁用故障注入
disableFaultInjection();

// 添加路由配置
addFaultRoute({
  path: '/api/test*',
  faults: ['500'],
  probability: 1,
});

// 移除路由配置
removeFaultRoute('/api/test*');

// 获取当前配置
const config = getFaultInjectionConfig();

// 更新配置
updateFaultInjectionConfig({
  defaultDelay: 2000,
  logEnabled: false,
});
```

## 响应格式

### 故障响应

```json
{
  "success": false,
  "error": "Service temporarily unavailable",
  "code": "SERVICE_UNAVAILABLE",
  "faultId": "FI-m1abc123-xyz789",
  "injected": true
}
```

### 响应头

```
X-Fault-Injection: 503
X-Fault-Injection-Id: FI-m1abc123-xyz789
Retry-After: 60
```

## 使用场景

### 1. 开发阶段

```typescript
// 开发环境自动注入故障
if (process.env.NODE_ENV === 'development') {
  app.use(createFaultInjection({
    enabled: true,
    routes: [{
      path: '/api/*',
      faults: ['delay'],
      probability: 0.5,
      faultConfig: {
        delay: { type: 'delay', range: [500, 2000] },
      },
    }],
  }));
}
```

### 2. 测试阶段

```typescript
// 测试容错能力
describe('Order API', () => {
  beforeAll(() => {
    // 模拟订单服务故障
    enableFaultInjection();
    addFaultRoute({
      path: '/api/orders*',
      faults: ['503'],
      probability: 1,
    });
  });

  afterAll(() => {
    disableFaultInjection();
  });

  it('should handle order service failure', async () => {
    const response = await request(app).get('/api/orders');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
  });
});
```

### 3. 生产环境监控

```typescript
// 通过环境变量控制
app.use(createFaultInjection({
  enabled: process.env.FAULT_INJECTION_ENABLED === 'true',
  defaultProbability: parseFloat(process.env.FAULT_INJECTION_PROBABILITY || '0'),
  routes: parseRoutes(process.env.FAULT_INJECTION_ROUTES),
}));
```

## 最佳实践

### 1. 渐进式引入

```typescript
// 第一阶段：只注入延迟
app.use(createFaultInjection({
  enabled: true,
  routes: [{ path: '/api/*', faults: ['delay'], probability: 0.1 }],
}));

// 第二阶段：添加错误注入
app.use(createFaultInjection({
  enabled: true,
  routes: [
    { path: '/api/*', faults: ['delay'], probability: 0.1 },
    { path: '/api/*', faults: ['500'], probability: 0.05 },
  ],
}));

// 第三阶段：完整混沌
app.use(createFaultInjection(FaultScenarios.chaosEngineering()));
```

### 2. 隔离敏感路径

```typescript
app.use(createFaultInjection({
  enabled: true,
  routes: [{ path: '/api/*', faults: ['delay', 'error'] }],
  excludePaths: [
    /^\/api\/admin/,    // 排除管理接口
    /^\/api\/critical/, // 排除关键接口
  ],
}));
```

### 3. 监控和告警

```typescript
app.use(createFaultInjection({
  enabled: true,
  logEnabled: true,
  routes: [{ path: '/api/*', faults: ['500'], probability: 0.01 }],
}));

// 配合告警系统
if (faultCount > threshold) {
  alert('High fault injection rate detected');
}
```

## 注意事项

1. **生产环境谨慎使用**：确保通过环境变量控制，默认关闭
2. **隔离关键路径**：排除健康检查、监控等接口
3. **控制影响范围**：从低概率、小范围开始
4. **监控和回滚**：准备快速禁用机制
5. **文档记录**：记录注入的故障场景和时间

## 性能影响

- 延迟故障会增加响应时间
- 错误注入性能影响最小
- 统计收集会有轻微开销
- 建议生产环境关闭日志 (`logEnabled: false`)

## 相关文档

- [超时管理](OPTIMIZATION-42-REQUEST-TIMEOUT.md)
- [安全中心](OPTIMIZATION-119-SOC2-COMPLIANCE.md)
- [缓存策略](OPTIMIZATION-45-CACHE-STRATEGY.md)
