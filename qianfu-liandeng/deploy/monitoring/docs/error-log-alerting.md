# Error 日志自动告警 - 集成指南

## 功能概述

实现应用层 Error 日志自动告警，当应用产生错误日志时，自动触发 Prometheus 告警并通知相关人员。

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                         应用层                                   │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌──────────┐  │
│  │  auth   │     │  api    │     │security │     │ payment  │  │
│  │ logger  │     │ logger  │     │ logger  │     │  logger  │  │
│  └────┬────┘     └────┬────┘     └────┬────┘     └────┬─────┘  │
│       │               │               │               │        │
│       └───────────────┴───────┬───────┴───────────────┘        │
│                               │                                │
│                    ┌──────────▼──────────┐                     │
│                    │   metrics.ts        │                     │
│                    │  (Prometheus Counter)│                     │
│                    └──────────┬──────────┘                     │
│                               │                                │
│                    ┌──────────▼──────────┐                     │
│                    │   /metrics 端点     │                     │
│                    └──────────┬──────────┘                     │
└───────────────────────────────┼────────────────────────────────┘
                                │
                    ┌──────────▼──────────┐
                    │     Prometheus      │
                    │  (抓取 metrics)     │
                    │                     │
                    │  ┌────────────────┐ │
                    │  │application_log │ │
                    │  │    _alerts     │ │
                    │  │ (告警规则组)   │ │
                    │  └───────┬────────┘ │
                    └──────────┼──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Alertmanager     │
                    │  (告警路由分发)     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
       │   Email     │  │  DingTalk   │  │   WeChat    │
       └─────────────┘  └─────────────┘  └─────────────┘
```

## 新增文件

### 1. `server/lib/metrics.ts` - Prometheus 指标收集模块

**核心指标**：
- `app_error_log_total` - 按 category 和 level 分类的错误日志计数
- `app_warn_log_total` - 警告日志计数
- `app_http_requests_total` - HTTP 请求计数
- `app_http_request_duration_seconds` - 请求延迟直方图

### 2. `server/routes/metrics.ts` - Metrics 端点路由

暴露 `/metrics` 端点供 Prometheus 抓取。

### 3. `server/lib/logger.ts` - 增强版日志模块

集成 metrics 收集，自动记录错误/警告日志到 Prometheus。

## 告警规则

### 新增告警规则组：`application_log_alerts`

| 告警名称 | 触发条件 | 严重级别 | 说明 |
|---------|---------|---------|------|
| `HighAppErrorRateWarning` | 错误率 > 0.1/s | warning | 应用错误率较高 |
| `HighAppErrorRateCritical` | 错误率 > 0.5/s | critical | 应用错误率严重 |
| `HighAuthErrorRate` | 认证错误率 > 0.05/s | warning | 认证错误，可能被攻击 |
| `HighSecurityErrorRate` | 安全错误率 > 0.02/s | critical | 安全事件，需立即处理 |
| `HighPaymentErrorRate` | 支付错误率 > 0.01/s | critical | 支付异常 |
| `HighAPIErrorRate` | API 错误率 > 0.1/s | warning | API 异常 |
| `AppErrorLogBurst` | 1分钟内错误增加 > 10 | warning | 错误突增 |
| `NoErrorsForLongTime` | 24小时无错误 | warning | 指标采集异常 |

## 集成步骤

### 步骤 1: 安装依赖

```bash
npm install prom-client
```

### 步骤 2: 注册 Metrics 路由

在 Express 应用中注册 metrics 端点：

```typescript
import metricsRouter from './routes/metrics';
import { getMetricsRegistry } from './lib/metrics';

// 注册 metrics 端点
app.use('/', metricsRouter);
```

### 步骤 3: 配置 Prometheus 抓取

确保 `prometheus.yml` 中配置了 backend 的 metrics 端点：

```yaml
- job_name: 'backend'
  metrics_path: /metrics
  static_configs:
    - targets: ['backend:4000']
```

### 步骤 4: 加载告警规则

Prometheus 会自动加载 `deploy/monitoring/prometheus/rules/alerts.yml` 中的告警规则。

## 使用示例

### 后端代码集成

```typescript
import { logger, apiLogger, authLogger, paymentLogger } from './lib/logger';

// 普通日志
apiLogger.info('API request received', { path: '/api/users' });

// 认证日志
authLogger.error('Authentication failed', error, { ip: '1.2.3.4' });

// 支付日志
paymentLogger.error('Payment processing failed', error, {
  orderId: 'ORDER123',
  amount: 100
});
```

### 查看指标

```bash
# 访问 metrics 端点
curl http://localhost:4000/metrics

# 查看错误日志指标
curl -s http://localhost:4000/metrics | grep app_error
```

输出示例：
```
# HELP app_error_log_total Total number of error logs
# TYPE app_error_log_total counter
app_error_log_total{category="api",level="error"} 42
app_error_log_total{category="auth",level="error"} 15
app_error_log_total{category="payment",level="error"} 3
```

## 告警配置

### 调整告警阈值

在 `deploy/monitoring/.env.monitoring` 中修改：

```bash
# 应用错误日志率告警阈值
APP_ERROR_WARNING_RATE=0.1      # Warning: 0.1/s
APP_ERROR_CRITICAL_RATE=0.5     # Critical: 0.5/s

# 各类别错误率阈值
AUTH_ERROR_RATE=0.05
SECURITY_ERROR_RATE=0.02
PAYMENT_ERROR_RATE=0.01
API_ERROR_RATE=0.1
```

### 告警通知配置

配置 `alertmanager/templates/` 下的通知模板来自定义告警消息格式。

## 注意事项

1. **性能影响**: Counter 指标对性能影响极小，可忽略不计
2. **存储开销**: Prometheus 会长期存储这些指标，建议设置合适的保留时间
3. **标签基数**: 避免使用高基数标签（如用户ID），建议使用分类标签
4. **敏感信息**: logger.ts 已集成敏感信息过滤，不会记录密码等敏感数据

## Grafana 仪表盘

可在 Grafana 中创建以下仪表盘：

1. **错误趋势图**: `rate(app_error_log_total[5m])`
2. **分类错误占比**: `app_error_log_total by (category)`
3. **错误率热力图**: 使用 histogram 类型指标

## 相关文档

- [Prometheus Counter 文档](https://prometheus.io/docs/concepts/metric_types/#counter)
- [Prometheus Alerting 文档](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [Alertmanager 文档](https://prometheus.io/docs/alerting/latest/alertmanager/)
