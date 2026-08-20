# 集成优化方案

> 生成时间: 2026/07/07
> 分析范围: dist-server/server/services/

---

## 一、错误处理改进

### 1.1 问题诊断

| 服务 | 当前状态 | 风险等级 |
|------|----------|----------|
| **syncService.js** | try-catch 分散，CMS 错误静默忽略 | 中 |
| **emailService.js** | 错误处理不完整，部分只记录不抛出 | 中 |
| **paymentHandler.js** | 事件监听无重试，死信无持久化 | 高 |
| **moderationService.js** | 有 fail-closed 但缺少重试队列 | 中 |
| **dbOptimizer.js** | 索引错误吞掉，不影响业务但无告警 | 低 |

### 1.2 优化建议

#### 建议 A: 统一错误分类与传播策略

```javascript
// errors.js 新增
export const ErrorRecoveryStrategy = {
  RETRY_IMMEDIATE: 'retry_immediate',      // 网络抖动
  RETRY_EXPONENTIAL: 'retry_exponential',  // 服务不可用
  DEAD_LETTER: 'dead_letter',              // 需要人工介入
  FALLBACK: 'fallback'                      // 使用降级方案
};

export function classifyError(error) {
  // 网络错误 → RETRY
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return { strategy: ErrorRecoveryStrategy.RETRY_EXPONENTIAL, maxRetries: 3 };
  }
  // 4xx 客户端错误 → 不重试
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return { strategy: ErrorRecoveryStrategy.DEAD_LETTER };
  }
  // 5xx 服务端错误 → 重试
  if (error.response?.status >= 500) {
    return { strategy: ErrorRecoveryStrategy.RETRY_EXPONENTIAL, maxRetries: 3 };
  }
  // 超时 → 重试
  if (error.code === 'TIMEOUT') {
    return { strategy: ErrorRecoveryStrategy.RETRY_EXPONENTIAL, maxRetries: 2 };
  }
  return { strategy: ErrorRecoveryStrategy.DEAD_LETTER };
}
```

#### 建议 B: syncService CMS 同步改进

```javascript
// syncService.js 改进
export const syncServerToCMS = async (server, retries = 2) => {
  if (!cmsClient) return;
  
  const retryDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000);
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // ... 现有逻辑
      await cmsClient.post('/api/servers', { /* ... */ });
      logger.info(`[Sync] Successfully synced server ${server.name} to CMS`);
      return;
    } catch (err) {
      const { strategy } = classifyError(err);
      
      if (strategy === ErrorRecoveryStrategy.DEAD_LETTER) {
        // 422/400 等业务错误不重试
        logger.error(`[Sync] CMS sync dead-letter for server ${server.name}:`, {
          status: err.response?.status,
          error: err.message
        });
        // 持久化到 dead-letter queue
        await saveToDeadLetterQueue('cms_server_sync', server, err);
        return;
      }
      
      if (attempt < retries) {
        logger.warn(`[Sync] CMS sync retry ${attempt + 1}/${retries} for ${server.name}`);
        await sleep(retryDelay(attempt));
        continue;
      }
      
      logger.error(`[Sync] CMS sync exhausted retries for ${server.name}`);
      await saveToDeadLetterQueue('cms_server_sync', server, err);
    }
  }
};

// 死信队列持久化
async function saveToDeadLetterQueue(type, payload, error) {
  try {
    await prisma.deadLetterQueue.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        error: error.message,
        retry_count: 0,
        next_retry_at: new Date(Date.now() + 15 * 60 * 1000) // 15分钟后重试
      }
    });
  } catch (e) {
    logger.error('[Sync] Failed to save dead-letter:', e.message);
  }
}
```

#### 建议 C: paymentHandler 事件重试机制

```javascript
// paymentHandler.js 改进
const PAYMENT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
};

eventService.on(EVENTS.PAYMENT_SUCCESS, async (payment) => {
  const { id: paymentId, user_id: userId } = payment;
  let lastError;
  
  for (let attempt = 0; attempt <= PAYMENT_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      await processPaymentSideEffects(payment);
      logger.info(`[PaymentHandler] Side effects completed for ${paymentId}`);
      return;
    } catch (error) {
      lastError = error;
      logger.warn(`[PaymentHandler] Retry ${attempt + 1}/${PAYMENT_RETRY_CONFIG.maxRetries} for ${paymentId}`);
      
      if (attempt < PAYMENT_RETRY_CONFIG.maxRetries) {
        const delay = Math.min(
          PAYMENT_RETRY_CONFIG.baseDelayMs * Math.pow(PAYMENT_RETRY_CONFIG.backoffMultiplier, attempt),
          PAYMENT_RETRY_CONFIG.maxDelayMs
        );
        await sleep(delay);
      }
    }
  }
  
  // 所有重试失败，持久化待处理
  await persistPaymentFailure(paymentId, lastError);
  logger.error(`[PaymentHandler] Payment ${paymentId} side effects failed after ${PAYMENT_RETRY_CONFIG.maxRetries} retries`);
});

async function persistPaymentFailure(paymentId, error) {
  await prisma.paymentFailureLog.create({
    data: {
      payment_id: paymentId,
      error_message: error.message,
      failed_at: new Date(),
      status: 'PENDING_RETRY'
    }
  });
}
```

---

## 二、连接管理优化

### 2.1 当前问题分析

| 服务 | 连接方式 | 问题 |
|------|----------|------|
| **Redis** | ioredis 单例 | ✅ 已有重连 + MemoryCache 降级 |
| **CMS** | axios 每次创建 | ❌ 无连接池，超时硬编码 |
| **Email** | nodemailer 每次创建 transporter | ⚠️ 可复用 |
| **Moderation API** | axios 无连接管理 | ❌ 无指数退避 |

### 2.2 优化方案

#### 建议 A: CMS 客户端连接池化

```javascript
// 新建 services/httpClient.js
import axios from 'axios';

class HttpClientPool {
  constructor() {
    this.clients = new Map();
  }
  
  getClient(config) {
    const key = `${config.baseURL}-${config.timeout}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, axios.create({
        ...config,
        // 通用配置
        maxRedirects: 3,
        validateStatus: (status) => status < 500,
        // 连接池配置
        httpAgent: new (require('http').Agent)({ 
          maxSockets: 25,
          maxFreeSockets: 10,
          timeout: 60000 
        }),
        httpsAgent: new (require('https').Agent)({
          maxSockets: 25,
          maxFreeSockets: 10,
          timeout: 60000
        })
      }));
    }
    return this.clients.get(key);
  }
  
  clear() {
    this.clients.forEach(client => client.close?.());
    this.clients.clear();
  }
}

export const httpClientPool = new HttpClientPool();

// 使用示例
export function createCmsClient() {
  return httpClientPool.getClient({
    baseURL: CMS_URL,
    timeout: 10000, // 提升超时
    headers: { 'Authorization': `users API-Key ${CMS_API_KEY}` }
  });
}
```

#### 建议 B: Email Transporter 复用

```javascript
// emailService.js 改进
let cachedTransporter = null;
let transporterConfig = null;

function getTransporter(runtime) {
  const configKey = JSON.stringify({
    kind: runtime.transport.kind,
    host: runtime.transport.host,
    port: runtime.transport.port
  });
  
  if (transporterConfig !== configKey || !cachedTransporter) {
    cachedTransporter = createTransporter(runtime);
    transporterConfig = configKey;
  }
  return cachedTransporter;
}

// 定期验证连接
setInterval(async () => {
  if (cachedTransporter) {
    try {
      await cachedTransporter.verify();
      logger.debug('[EmailService] Transporter connection verified');
    } catch (e) {
      logger.warn('[EmailService] Transporter verification failed, will recreate on next use');
      cachedTransporter = null;
    }
  }
}, 5 * 60 * 1000); // 每5分钟验证一次
```

#### 建议 C: 数据库连接健康检查

```javascript
// dbOptimizer.js 或新文件 services/dbHealthCheck.js
export async function performDbHealthCheck() {
  const checks = {
    connection: false,
    latency: null,
    indexes: null,
    locks: null
  };
  
  // 连接测试
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.latency = Date.now() - start;
    checks.connection = true;
  } catch (e) {
    logger.error('[DB Health] Connection failed:', e.message);
    return { healthy: false, ...checks, error: e.message };
  }
  
  // 活跃连接数
  try {
    if (getPrimaryDbProvider() === 'postgresql') {
      const result = await prisma.$queryRaw`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      checks.activeConnections = Number(result[0].active_connections);
    }
  } catch (e) {
    logger.warn('[DB Health] Could not get connection stats');
  }
  
  return {
    healthy: checks.connection && checks.latency < 1000,
    ...checks
  };
}

// 健康检查定时任务
setInterval(async () => {
  const health = await performDbHealthCheck();
  if (!health.healthy) {
    logger.error('[DB Health] Database unhealthy:', health);
    // 触发告警
    await triggerAlert('database_health_failure', health);
  }
}, 60 * 1000);
```

---

## 三、重试/熔断机制建议

### 3.1 熔断器实现

```javascript
// 新建 services/circuitBreaker.js
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
    
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;
  }
  
  async execute(fn, context) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        logger.info(`[CircuitBreaker] Transitioning to HALF_OPEN`);
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        this.state = 'CLOSED';
        logger.info('[CircuitBreaker] Circuit closed after successful recovery');
      }
    }
  }
  
  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(`[CircuitBreaker] Circuit opened after ${this.failures} failures`);
    }
  }
  
  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime
    };
  }
}
```

### 3.2 集成到服务

```javascript
// moderationService.js 改进
const moderationCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60000
});

static async checkText(content, userId) {
  return moderationCircuitBreaker.execute(async () => {
    // ... 原有逻辑
  }, { content: content.slice(0, 50), userId });
}

// 导出状态用于监控
export function getModerationCircuitStatus() {
  return moderationCircuitBreaker.getStatus();
}
```

### 3.3 带指数退避的通用重试装饰器

```javascript
// utils/retry.js
export function withRetry(options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = () => true
  } = options;
  
  return function (target, propertyKey, descriptor) {
    const original = descriptor.value;
    
    descriptor.value = async function (...args) {
      let lastError;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await original.apply(this, args);
        } catch (error) {
          lastError = error;
          
          if (!retryableErrors(error) || attempt === maxAttempts - 1) {
            throw error;
          }
          
          const delay = Math.min(
            baseDelay * Math.pow(backoffMultiplier, attempt),
            maxDelay
          );
          
          logger.debug(`[Retry] ${propertyKey} attempt ${attempt + 1}/${maxAttempts} failed, retrying in ${delay}ms`);
          await sleep(delay);
        }
      }
      
      throw lastError;
    };
    
    return descriptor;
  };
}

// 使用示例
class ModerationService {
  @withRetry({
    maxAttempts: 3,
    baseDelay: 1000,
    retryableErrors: (e) => e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT'
  })
  static async checkText(content, userId) {
    // ...
  }
}
```

---

## 四、日志记录改进

### 4.1 当前日志问题

| 问题 | 位置 | 影响 |
|------|------|------|
| 缺少 traceId 传播 | 异步操作 | 难以关联请求 |
| 敏感数据未完全脱敏 | 部分 API 响应 | 安全风险 |
| 日志级别不统一 | 错误/warn 混用 | 难以告警 |
| 缺少结构化性能日志 | 数据库操作 | 难以优化 |

### 4.2 优化方案

#### 建议 A: 结构化追踪日志

```javascript
// logger.js 增强
export class LoggerWrapper {
  // 新增结构化日志方法
  logServiceCall(service, method, params, result, duration) {
    this.info(`[Service] ${service}.${method}`, {
      service,
      method,
      duration_ms: duration,
      params: this.sanitizeParams(params),
      success: result !== null && !result?.error
    });
  }
  
  logIntegrationCall(provider, endpoint, status, duration, error = null) {
    const level = error ? 'error' : status >= 400 ? 'warn' : 'info';
    this[level](`[Integration] ${provider} ${endpoint}`, {
      provider,
      endpoint,
      status,
      duration_ms: duration,
      error: error?.message
    });
  }
  
  logCircuitBreaker(event, name, state, metrics) {
    this.warn(`[CircuitBreaker] ${event} - ${name}`, {
      name,
      state,
      failures: metrics.failures,
      lastFailure: metrics.lastFailure
    });
  }
  
  sanitizeParams(params) {
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'];
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [
        k,
        sensitiveKeys.some(sk => k.toLowerCase().includes(sk)) ? '[REDACTED]' : v
      ])
    );
  }
}
```

#### 建议 B: syncService 增强日志

```javascript
// syncService.js 日志改进
export const syncServerToMainDB = async (localServerId, traceId) => {
  const startTime = Date.now();
  logger.info(`[Sync] Starting server sync`, { 
    localServerId, 
    traceId,
    operation: 'server_sync' 
  });
  
  try {
    // ...
    const duration = Date.now() - startTime;
    logger.logServiceCall('syncService', 'syncServerToMainDB', 
      { serverId: localServerId }, 
      { success: true, recordsAffected: 1 }, 
      duration
    );
  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error(`[Sync] Server sync failed`, {
      localServerId,
      traceId,
      duration_ms: duration,
      error: err.message,
      errorCode: err.code,
      stack: err.stack
    });
    throw err;
  }
};

// 定期同步添加操作计数
export const startPeriodicSync = () => {
  const metrics = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    lastSyncTime: null
  };
  
  const runSync = async () => {
    metrics.totalSyncs++;
    const start = Date.now();
    
    try {
      // ... 同步逻辑
      
      metrics.successfulSyncs++;
      metrics.lastSyncTime = new Date();
      
      // 周期性报告
      if (metrics.totalSyncs % 10 === 0) {
        logger.info('[Sync] Sync metrics report', {
          ...metrics,
          successRate: (metrics.successfulSyncs / metrics.totalSyncs * 100).toFixed(2) + '%',
          avgDuration: (Date.now() - start) + 'ms'
        });
      }
    } catch (err) {
      metrics.failedSyncs++;
      throw err;
    }
  };
};
```

#### 建议 C: Redis 慢操作日志

```javascript
// redisService.js 增强
const SLOW_OP_THRESHOLD_MS = 100;

async get(key) {
  const start = Date.now();
  try {
    const result = await this.client.get(key);
    const duration = Date.now() - start;
    
    if (duration > SLOW_OP_THRESHOLD_MS) {
      logger.warn(`[Redis] Slow GET operation`, {
        key: key.slice(0, 50),
        duration_ms: duration
      });
    }
    
    metricsService.recordRedisLatency('get', duration);
    return result ? JSON.parse(result) : null;
  } finally {
    // ...
  }
}
```

---

## 五、实施优先级

| 优先级 | 改进项 | 工作量 | 预期收益 |
|--------|--------|--------|----------|
| P0 | CMS 连接池 + 超时统一 | 低 | 高 |
| P0 | paymentHandler 重试机制 | 中 | 高 |
| P1 | 结构化日志增强 | 低 | 中 |
| P1 | 熔断器实现 | 中 | 高 |
| P2 | Email Transporter 复用 | 低 | 中 |
| P2 | 定期健康检查 | 中 | 中 |
| P3 | 通用 @retry 装饰器 | 中 | 低 |

---

## 六、监控指标建议

```javascript
// 新增 metricsService 指标
export const IntegrationMetrics = {
  // CMS
  'cms_sync_total': 'counter',
  'cms_sync_duration_seconds': 'histogram',
  'cms_circuit_breaker_state': 'gauge',
  
  // Email
  'email_send_total': 'counter',
  'email_send_failed': 'counter',
  'email_rate_limit_remaining': 'gauge',
  
  // Moderation
  'moderation_check_total': 'counter',
  'moderation_latency_seconds': 'histogram',
  'moderation_circuit_breaker_state': 'gauge',
  
  // Redis
  'redis_operation_duration_seconds': 'histogram',
  'redis_fallback_total': 'counter',
  
  // Payment
  'payment_side_effects_total': 'counter',
  'payment_side_effects_retries': 'counter',
  'payment_side_effects_dead_letter': 'counter'
};
```
