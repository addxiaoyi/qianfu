# API 联调指南（D10）

本指南面向前端、测试与第三方接入方，提供可直接联调的最小闭环。

## 1. 基础信息

- Base URL（本地）：`http://localhost:3000`
- API 前缀：`/api/v1`
- 文档入口：`/api-docs`
- 版本协商：
  - URL：`/api/v1/...`
  - Header：`X-API-Version: v1`
  - Query：`?api-version=v1`

## 2. 鉴权与安全

- 鉴权方式：`Authorization: Bearer <token>`
- 写操作建议附带 CSRF 头（若接口要求）
- 所有错误响应含 `requestId`，用于日志排障

## 3. 限流与重试

- 高频接口有路由级限流（返回 `429`）
- 建议客户端使用指数退避重试（`1s -> 2s -> 4s`）
- 避免在失败后立即并发重放同一写请求

## 4. 示例请求（D06）

### 4.1 创建服务器

```bash
curl -X POST "http://localhost:3000/api/v1/servers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "QianFu Vanilla",
    "host": "mc.example.com",
    "port": 25565,
    "version": "1.20.1",
    "description": "欢迎来到千服原版生存"
  }'
```

### 4.2 查询工单列表

```bash
curl "http://localhost:3000/api/v1/tickets?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

## 5. 示例响应（D07）

### 5.1 创建成功

```json
{
  "success": true,
  "message": "Server created successfully",
  "data": {
    "id": 3001,
    "name": "QianFu Vanilla",
    "host": "mc.example.com",
    "port": 25565
  },
  "requestId": "req_01JABCXYZ",
  "timestamp": "2026-04-27T09:30:00.000Z"
}
```

### 5.2 参数错误

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "requestId": "req_01JABCERR",
    "details": [
      {
        "source": "body",
        "path": "host",
        "code": "invalid_string",
        "message": "Invalid host format"
      }
    ]
  },
  "timestamp": "2026-04-27T09:31:00.000Z"
}
```

## 6. 常见问题

- `401 UNAUTHORIZED`：检查 token 是否过期、是否附带 `Bearer` 前缀。
- `403 FORBIDDEN`：当前账号权限不足，需确认角色/权限组。
- `404 NOT_FOUND`：确认资源 ID 存在且路径是否使用 `/api/v1`。
- `429`：触发限流，按退避策略重试。

## 7. 支付联调（个人收款二维码）

### 7.1 服务端配置

- 启用 PayPro 通道：
  - `PAYPRO_ENABLED=true`
  - `PAYPRO_API_URL=http://127.0.0.1:8892`
  - `PAYPRO_OPENAPI_SECRET=<与你的 PayPro openapi secret 一致>`
  - `PAYPRO_NOTIFY_URL=<公网回调地址，例如 https://api.example.com/api/v1/payment/paypro/notify>`

### 7.2 下单接口（前端保持不变）

- 仍使用：`POST /api/v1/payment/create`
- `paymentMethod` 为 `wechat` / `alipay` 时，后端会自动调用 PayPro OPENAPI 创建订单并返回 `paymentUrl`。
- 建议客户端传入 `Idempotency-Key`，避免弱网重试产生重复订单。
- 响应中会包含：
  - `paymentId`
  - `orderId`
  - `paymentUrl`（优先 returnUrl，缺省回退 qrCodeUrl）

### 7.3 风控与超时策略

- 待支付订单上限：`PAYMENT_MAX_PENDING_ORDERS`（默认 `3`，`0` 表示不限制）。
- 用户每日总支付限额：`PAYMENT_DAILY_LIMIT_CNY`（单位：元，默认 `0` 不限制）。
- 用户每日渠道限额：
  - `PAYMENT_DAILY_LIMIT_WECHAT_CNY`
  - `PAYMENT_DAILY_LIMIT_ALIPAY_CNY`
- 订单超时清理：`PAYMENT_ORDER_TIMEOUT_MINUTES`（默认 `15` 分钟），超时 `PENDING` 订单自动标记 `EXPIRED`。
- 命中上限时返回 `429 LIMIT_EXCEEDED`，前端应提示用户先完成或取消现有订单后再重试。

### 7.4 回调与验签

- 回调地址：`POST /api/v1/payment/paypro/notify`
- 回调字段：`orderNo`、`amount`、`payNum`、`sign`
- 可选 IP 白名单（渠道配置优先，未配置时回退全局）：
  - 全局：`PAYMENT_NOTIFY_IP_ALLOWLIST`
  - XPay：`XPAY_NOTIFY_IP_ALLOWLIST`
  - PayPro：`PAYPRO_NOTIFY_IP_ALLOWLIST`
  - QianFu XPay：`QIANFU_NOTIFY_IP_ALLOWLIST`（未配置时回退 `QIANFU_WHITELIST`）
- 验签规则：
  - 参数按字母排序（排除 `sign`）
  - 拼接 `key=PAYPRO_OPENAPI_SECRET`
  - MD5 大写比对
- 验签比较使用 timing-safe 比对，降低签名比较侧信道风险。
- 回调防重放：`PAYMENT_NOTIFY_REPLAY_TTL_SECONDS`（默认 `600` 秒，`0` 表示关闭）。
  - 同一回调指纹命中重放窗口时，服务端直接返回 `success`，避免上游重复重试导致重复处理。
- QianFu XPay 回调可单独配置防重放窗口：`QIANFU_NOTIFY_REPLAY_TTL_SECONDS`（未配置时回退 `PAYMENT_NOTIFY_REPLAY_TTL_SECONDS`）。
- 通过后订单标记为 `COMPLETED`；`custom` 充值订单自动入账钱包。

### 7.5 取消待支付订单

- 接口：`POST /api/v1/payment/:orderId/cancel`
- 仅订单归属用户可取消，且仅允许取消 `PENDING` 状态。
- 若订单已处理（`FAILED` 等）返回成功并提示“已处理”，保证接口幂等体验。
- 若订单已完成（`COMPLETED`）返回 `409 INVALID_OPERATION`。

## 8. 联调核对清单

- 是否使用了统一前缀 `/api/v1`
- 是否按接口要求携带鉴权头
- 是否处理了统一错误结构（`error.code`）
- 是否记录了 `requestId` 便于排障
- 是否对分页接口读取了 `meta.total/page/limit/totalPages`
