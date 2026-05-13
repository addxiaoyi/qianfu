# API 变更记录（D08）

## 2026-04-28

### Added

- 新增用户取消待支付订单接口：`POST /api/v1/payment/:orderId/cancel`（仅允许本人取消 `PENDING` 订单）。
- 新增支付风控环境变量：
  - `PAYMENT_MAX_PENDING_ORDERS`
  - `PAYMENT_DAILY_LIMIT_CNY`
  - `PAYMENT_DAILY_LIMIT_WECHAT_CNY`
  - `PAYMENT_DAILY_LIMIT_ALIPAY_CNY`
  - `PAYMENT_ORDER_TIMEOUT_MINUTES`

### Changed

- `POST /api/v1/payment/create` 新增创建前风控校验：
  - 用户待支付订单上限控制。
  - 用户日累计金额上限控制（总量 + 渠道维度）。
- 支付回调验签比较改为 timing-safe 比对，降低侧信道风险：
  - `POST /api/v1/payment/xpay/notify`
  - `POST /api/v1/payment/paypro/notify`
- 支付回调新增来源 IP 白名单（渠道专属优先，未配置时回退全局）：
  - `PAYMENT_NOTIFY_IP_ALLOWLIST`
  - `XPAY_NOTIFY_IP_ALLOWLIST`
  - `PAYPRO_NOTIFY_IP_ALLOWLIST`
  - `QIANFU_NOTIFY_IP_ALLOWLIST`（未配置时回退 `QIANFU_WHITELIST`）
- 支付回调新增防重放窗口：`PAYMENT_NOTIFY_REPLAY_TTL_SECONDS`（默认 600 秒，命中重复回调直接 `success` 幂等应答）。
- QianFu XPay 回调新增专属防重放窗口：`QIANFU_NOTIFY_REPLAY_TTL_SECONDS`（未配置时回退全局窗口）。
- 超时订单清理逻辑改为可配置超时分钟数（默认 15 分钟）。
- 超时订单状态由自动清理任务标记为 `EXPIRED`（原先为 `FAILED`）。
- 对账任务中的超时阈值说明同步对齐 `PAYMENT_ORDER_TIMEOUT_MINUTES`。

## 2026-04-27

### Added

- 新增响应语义化助手：`sendListResponse/sendDetailResponse/sendCreatedResponse/sendUpdatedResponse/sendDeletedResponse/sendBatchResponse/sendEmptyResponse`。
- 新增业务提示文案目录：`server/constants/businessMessages.ts`。
- 新增错误码目录：`server/constants/errorCodeCatalog.ts`。
- 新增 OpenAPI 同步守卫：`npm run guard:openapi-sync`。
- 新增查询能力指南：`docs/API-QUERY-SEARCH-GUIDE.md`（统一分页/排序/筛选/搜索/时间范围/性能策略）。
- 新增健壮性指南：`docs/API-ROBUSTNESS-GUIDE.md`（F01-F10 能力与验收说明）。
- 新增文档：
  - `docs/API-RESPONSE-DESIGN-GUIDE.md`
  - `docs/API-ERROR-CODE-CATALOG.md`
  - `docs/API-DOCUMENTATION-WORKFLOW.md`
  - `docs/API-FIELD-REFERENCE.md`
  - `docs/API-INTEGRATION-GUIDE.md`
  - `docs/API-VERSION-DIFF.md`

### Changed

- `generate-openapi` 改为基于 `swaggerSpec` 生成，修复空 schema 产物问题。
- OpenAPI 组件 schema 与统一响应结构对齐（成功/错误包络、分页元信息、校验错误结构）。
- `validate` 流程增加 OpenAPI 漂移校验，防止文档与代码不一致。
- 查询参数 schema 增强：支持 `search/q`、`sortBy/sortOrder`、`fuzzy`、`startDate/endDate` 标准化。
- 列表控制器增强：`servers/users/payments/tickets/audit` 接口统一多条件组合查询与默认排序策略。
- 查询性能增强：`prisma/schema.prisma` 增补 `Payment/Ticket/AuditLog/PermissionHistory` 复合索引。
- 新增 `idempotency/duplicate` 中间件，统一重复请求拦截与幂等回放能力。
- 新增 API 全局请求超时中间件，统一返回 `504` 超时错误包络。
- WAF 与 AntiCrawler 拦截响应对齐统一错误包络（含 `requestId`）。
- 进程级异常（`unhandledRejection/uncaughtException`）统一日志与优雅退出流程。
- 支付创建链路增强：`POST /api/v1/payment/create` 在 `PAYPRO_ENABLED=true` 时自动接入 PayPro OPENAPI 生成个人收款二维码，保持前端 `paymentUrl` 协议不变。
- 新增支付回调：`POST /api/v1/payment/paypro/notify`，支持 `orderNo/amount/payNum/sign` 验签与幂等入账。
