# API 幂等性支持指南

## 概述

本项目提供两层次幂等性保护：

1. **重复请求防护 (DuplicateRequestGuard)** - 基于请求内容摘要，防止短时间内重复提交
2. **完整幂等性支持 (IdempotencyMiddleware)** - 基于客户端提供的 `Idempotency-Key`，保证操作幂等

## 中间件位置

```
dist-server/server/middleware/idempotency.js
```

## 1. 重复请求防护 (DuplicateRequestGuard)

### 适用场景

- 用户快速点击按钮导致重复提交
- 网络超时导致客户端重试
- 防止短时间内相同操作的重复处理

### 使用方式

```javascript
import { createDuplicateRequestGuard } from '../middleware/idempotency.js';

// 应用于 POST/PUT/PATCH/DELETE 路由
router.post('/endpoint', 
  createDuplicateRequestGuard({ ttlSeconds: 10 }),
  controller
);
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ttlSeconds` | number | 8 | 请求去重的时间窗口（秒） |
| `keyPrefix` | string | `'dup:req'` | Redis key 前缀 |
| `includeBody` | boolean | true | 是否包含请求体计算摘要 |

### 示例

```javascript
// 支付取消操作 - 10秒内不允许重复请求
router.post('/:orderId/cancel', 
  authenticate,
  createDuplicateRequestGuard({ ttlSeconds: 10 }),
  cancelPayment
);

// 管理员手动完成订单 - 10秒去重窗口
router.post('/admin/complete-order',
  authenticate,
  createDuplicateRequestGuard({ 
    ttlSeconds: 10,
    includeBody: true 
  }),
  manualCompletePayment
);
```

### 响应

当检测到重复请求时，返回 HTTP 409：

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_REQUEST",
    "message": "Duplicate request detected, please wait and retry.",
    "requestId": "req_abc123"
  }
}
```

---

## 2. 完整幂等性支持 (IdempotencyMiddleware)

### 适用场景

- 支付操作 - 保证支付不会因重试被扣多次
- 订单创建 - 保证订单不会因重试被创建多个
- 关键业务操作 - 需要客户端显式控制幂等性

### 使用方式

```javascript
import { createIdempotencyMiddleware } from '../middleware/idempotency.js';

// 可选：必须提供 Idempotency-Key
const idempotent = createIdempotencyMiddleware({ requireHeader: true });

// 可选：Idempotency-Key 为可选项
const idempotentOptional = createIdempotencyMiddleware({ requireHeader: false });

router.post('/create', idempotent, createPayment);
```

### 请求头

客户端需要在请求中提供以下头之一：

```
Idempotency-Key: <unique-key>
```

或（大小写不敏感）：

```
idempotency-key: <unique-key>
```

### Idempotency-Key 格式要求

- 长度：8-128 个字符
- 字符集：`A-Za-z0-9:_-`
- 推荐格式：`{operation}:{resource}:{uuid}`

示例：
```
payment:order_123:550e8400-e29b-41d4-a716-446655440000
```

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ttlSeconds` | number | 86400 (24h) | 幂等结果缓存时间 |
| `lockTtlSeconds` | number | 30 | 分布式锁超时时间 |
| `keyPrefix` | string | `'idem'` | Redis key 前缀 |
| `requireHeader` | boolean | false | 是否强制要求 Idempotency-Key |

### 响应头

成功返回的响应会包含：

```
X-Idempotent-Replay: 1   // 表示这是缓存的重复响应
```

### 行为说明

1. **首次请求**：获取锁 → 执行操作 → 缓存响应 → 释放锁 → 返回结果
2. **重复请求**（锁未释放）：返回 409，提示请求正在处理中
3. **重复请求**（已处理完）：直接返回缓存的响应，设置 `X-Idempotent-Replay: 1`

### 示例

```javascript
import { createIdempotencyMiddleware } from '../middleware/idempotency.js';

// 支付创建 - 必须提供幂等性 key
const idempotentPayment = createIdempotencyMiddleware({
  ttlSeconds: 24 * 60 * 60,  // 24小时
  lockTtlSeconds: 30,
  requireHeader: true
});

router.post('/create', 
  authenticate,
  idempotentPayment,
  createPayment
);
```

---

## Redis 存储结构

幂等性数据存储在 Redis 中：

```
# 响应缓存
idem:resp:{scope}:{method}:{route}:{idempotencyKey}
  -> { "statusCode": 200, "body": {...} }
  -> TTL: 24小时

# 处理锁
idem:lock:{scope}:{method}:{route}:{idempotencyKey}
  -> "1"
  -> TTL: 30秒

# 重复请求防护
dup:req:{requestDigest}
  -> 请求计数
  -> TTL: 8秒
```

---

## 最佳实践

### 1. Key 生成策略

```javascript
// 客户端生成幂等性 key
function generateIdempotencyKey(operation, resourceId) {
  return `${operation}:${resourceId}:${crypto.randomUUID()}`;
}

// 示例
const key = generateIdempotencyKey('payment', 'order_123');
// "payment:order_123:550e8400-e29b-41d4-a716-446655440000"
```

### 2. 重试逻辑

```javascript
async function createPayment(orderData) {
  const idempotencyKey = generateIdempotencyKey('payment', orderData.orderId);
  
  const response = await fetch('/api/payment/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(orderData)
  });
  
  if (response.status === 409) {
    // 请求正在处理中，等待后重试
    await sleep(1000);
    return createPayment(orderData);
  }
  
  return response.json();
}
```

### 3. 错误处理

幂等性中间件在 Redis 不可用时会降级为正常请求流程，不会阻塞服务：

```
[Idempotency] degraded: fallback to normal request flow
```

### 4. TTL 选择

| 操作类型 | 推荐 TTL | 理由 |
|----------|----------|------|
| 支付 | 24小时 | 支付处理可能耗时较长 |
| 订单创建 | 24小时 | 保证一天内的重试有效 |
| 状态更新 | 1小时 | 短期操作 |
| 数据删除 | 1小时 | 留足够时间处理并发 |

---

## 现有使用示例

### payment.js

```javascript
// 取消订单 - 重复请求防护
router.post('/:orderId/cancel', 
  authenticate,
  paymentLimiter,
  csrfProtection,
  createDuplicateRequestGuard({ ttlSeconds: 10 }),
  validateParams(paymentCancelParamSchema),
  cancelPayment
);

// 管理员完成订单 - 重复请求防护
router.post('/admin/complete-order',
  authenticate,
  adminLimiter,
  csrfProtection,
  createDuplicateRequestGuard({ ttlSeconds: 10 }),
  validateBody(manualPaymentSchema),
  manualCompletePayment
);
```

### tickets.js

```javascript
// 创建工单 - 双重幂等保护
router.post('/', 
  requireVerifiedEmail, 
  csrfProtection,
  createDuplicateRequestGuard({ ttlSeconds: 10 }),
  createIdempotencyMiddleware({ ttlSeconds: 60 * 60 }),  // 1小时缓存
  validateBody(ticketSchema), 
  createTicket
);

// 添加工单消息 - 快速操作，5秒去重
router.post('/:id/messages', 
  requireVerifiedEmail, 
  csrfProtection, 
  createDuplicateRequestGuard({ ttlSeconds: 5 }),
  validateParams(idParamSchema), 
  validateBody(ticketMessageSchema), 
  addMessage
);
```

### reports.js

```javascript
// 创建报告 - 双重幂等保护
router.post('/', 
  requireVerifiedEmail, 
  createDuplicateRequestGuard({ ttlSeconds: 10 }),
  createIdempotencyMiddleware({ ttlSeconds: 60 * 60 }),  // 1小时缓存
  createReport
);
```

---

## 故障排查

### Q: 返回 409 Idempotency In Progress
A: 同一 Idempotency-Key 的请求正在处理中，等待完成后再重试。

### Q: 返回 400 Invalid Idempotency-Key
A: Key 格式不正确，确保：
- 长度在 8-128 字符之间
- 只包含 `A-Za-z0-9:_-` 字符

### Q: 重复请求没有返回缓存结果
A: 检查：
1. Redis 连接是否正常
2. 响应是否在 200-399 状态码范围内（只有成功响应才会被缓存）
3. 原始响应是否正确设置了 JSON body

### Q: 内存回退模式
A: Redis 不可用时会自动使用内存缓存作为降级方案，注意：
- 内存缓存在服务重启后会丢失
- 分布式部署环境下无法跨节点共享

---

## 相关文档

- [API 健壮性指南](./API-ROBUSTNESS-GUIDE.md)
- [API 错误码目录](./API-ERROR-CODE-CATALOG.md)
- [Redis 服务文档](./ARCHITECTURE-*.md)
