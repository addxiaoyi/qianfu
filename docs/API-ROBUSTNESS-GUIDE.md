# API 健壮性指南（F01-F10）

## 目标

将重复请求、幂等、超时、异常、限流、安全拦截、兼容性与测试能力统一为可复用机制。

## F01 重复请求处理

- 提供通用中间件 `createDuplicateRequestGuard`（`server/middleware/idempotency.ts`）。
- 在短时间窗口内（默认 8s）拦截同一请求指纹（用户/IP + 路由 + 方法 + 请求体）。
- 典型接入：
  - `POST /api/v1/tickets`
  - `POST /api/v1/tickets/:id/messages`
  - `POST /api/v1/reports`
  - `POST /api/v1/payment/admin/complete-order`
  - `POST /api/v1/payment/:orderId/cancel`

## F02 幂等接口设计

- 已有：`POST /api/v1/payment/create` 控制器内置 `Idempotency-Key` 幂等与分布式锁。
- 已有：`POST /api/v1/payment/:orderId/cancel` 使用支付订单锁（`payment:<orderId>`）保证并发取消/回调一致性。
- 新增：`createIdempotencyMiddleware`（`server/middleware/idempotency.ts`）通用化：
  - 支持 `Idempotency-Key` 结果回放。
  - 同 key 并发请求返回 `409`（处理中）。
  - 成功响应缓存（默认 24h，可配置）。

## F03 超时处理

- 新增全局 API 请求超时中间件 `createRequestTimeoutMiddleware`（`server/middleware/requestTimeout.ts`）。
- 在 `middlewareLayers` 中接入 `/api` 层统一超时防护，默认 15000ms，可由 `API_REQUEST_TIMEOUT_MS` 配置。
- 返回统一 `504 GATEWAY_TIMEOUT` 错误包络。
- 服务间调用已统一 `AbortController/AbortSignal.timeout`。
- 支付链路增加订单超时清理：`PAYMENT_ORDER_TIMEOUT_MINUTES`（默认 15 分钟）后，`PENDING` 自动置为 `EXPIRED`。

## F04 异常捕获统一化

- 路由级异常由统一 `errorHandler` 收口（`server/middleware/error.ts`）。
- 进程级异常补齐：
  - `unhandledRejection` 统一记录。
  - `uncaughtException` 统一记录后触发优雅退出。

## F05 错误日志记录

- 统一输出结构化日志，包含 `requestId/url/method/code`。
- 关键安全事件和限流事件写入审计日志：
  - `RATE_LIMIT_HIT`
  - `WAF_BLOCK`
  - `WAF_RATE_LIMIT`
- 支付回调验签使用 timing-safe 比对，降低签名比较侧信道风险。
- 支付回调支持来源 IP 白名单（`PAYMENT_NOTIFY_IP_ALLOWLIST`，可被渠道专属白名单覆盖）。
- 支付回调支持防重放窗口（`PAYMENT_NOTIFY_REPLAY_TTL_SECONDS`，默认 600 秒）：
  - 命中重复回调返回 `success`，避免上游反复重试。
- QianFu XPay 回调支持专属覆盖：`QIANFU_NOTIFY_IP_ALLOWLIST`、`QIANFU_NOTIFY_REPLAY_TTL_SECONDS`。

## F06 参数缺失降级处理

- `validateRequest` 中间件支持统一归一化：
  - `trimStrings`
  - `emptyStringAsUndefined`
  - `nullAsUndefined`
- 查询 schema 普遍提供默认值（分页、排序、模糊开关），减少缺参导致的 5xx。

## F07 非法请求拦截

- WAF 与反爬中间件覆盖：
  - 恶意 UA、恶意 Header、注入特征、路径遍历、可疑请求体。
- 拦截响应已统一为标准错误包络（含 `requestId`）。

## F08 请求频率限制

- `rateLimiter` 实现全局 + 路由分级限流（支持 Redis Store 与内存降级）。
- 对认证、上传、支付、工单、AI、管理接口有独立限流策略。

## F09 接口兼容性处理

- `apiVersioning` 与 `backwardCompatRedirect` 支持 `/api/*` 到 `/api/v1/*` 兼容重写。
- 通过统一前缀常量集中管理版本路径。

## F10 接口测试用例覆盖

- 新增健壮性测试：
  - `tests/unit/robustness-middleware.test.ts`
  - 覆盖重复请求拦截、幂等回放、请求超时返回。
- 既有相关测试：
  - `tests/unit/request-validation-middleware.test.ts`

## 快速验证命令

```bash
npm run test:run -- tests/unit/robustness-middleware.test.ts tests/unit/request-validation-middleware.test.ts
npm run lint
npm run guard:api-contract
```
