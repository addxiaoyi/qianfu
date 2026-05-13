# 前后端对接注意事项（交接版）

> 适用项目：千服（QianFu）  
> 目的：用于前端重做/外包交接时，避免接口联调偏差、支付事故与鉴权问题。

## 1. 对接总原则

1. 前端请求统一写 `/api/...`，由客户端自动注入版本为 `/api/v1/...`。
2. 严格使用统一响应结构与错误结构，不允许页面各自定义“私有协议”。
3. 鉴权使用 SuperTokens 会话 Cookie（HttpOnly），不要依赖本地 token。
4. 写请求统一携带 CSRF 头，缺失时先获取 `/api/v1/csrf-token`。
5. 支付链路必须启用幂等与轮询状态机，禁止“只看一次下单返回就判定成功”。

---

## 2. 环境与基础配置

1. 前端运行端口：默认 `http://localhost:4123`（开发）。
2. 后端 API 前缀：`/api`，版本前缀：`/api/v1`。
3. 关键前端环境变量：
- `VITE_API_URL`（默认 `/api`）
- `VITE_SUPERTOKENS_API_DOMAIN`
- `VITE_GITHUB_LOGIN_ENABLED`
- `VITE_QQ_LOGIN_ENABLED`
- `VITE_DEV_AUTH_BYPASS`（生产必须关闭）
- `VITE_SIGNATURE_ENABLED`（按需）

4. 推荐联调命令：
- `npm run dev:stack`
- 合并前：`npm run validate`
- 发布前：`npm run release:preflight`

---

## 3. 接口契约（必须统一）

### 3.1 成功响应

```json
{
  "success": true,
  "message": "ok",
  "data": {},
  "requestId": "req_xxx",
  "timestamp": "2026-04-30T00:00:00.000Z",
  "meta": {}
}
```

### 3.2 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "statusCode": 400,
    "requestId": "req_xxx",
    "details": []
  },
  "timestamp": "2026-04-30T00:00:00.000Z"
}
```

### 3.3 前端错误处理约定

1. 优先判断 `error.code`，不要仅依赖文案。
2. `401/SESSION_EXPIRED`：清理前端用户态并跳转登录。
3. `403/PERMISSION_DENIED`：显示无权限页，不循环重试。
4. `VALIDATION_ERROR`：使用 `error.details` 显示字段级提示。
5. `429/RATE_LIMIT_EXCEEDED/LIMIT_EXCEEDED`：指数退避重试并提示稍后再试。

---

## 4. 鉴权、会话、CSRF 注意事项

1. `credentials: include` 必须开启。
2. 前端 `Authorization` 注入为兼容逻辑，不作为主认证手段。
3. 所有 `POST/PUT/PATCH/DELETE` 必须带 `x-csrf-token`。
4. 初次进入应用建议初始化：
- 拉取 `/api/csrf-token`
- 拉取 `/api/profile`

5. 路由守卫：
- 受保护路径未登录跳转 `#/login`
- 已登录访问访客页（`/login`、`/register` 等）应重定向首页

---

## 5. 邮箱验证解锁机制（业务强约束）

1. 未验证邮箱用户只允许基础浏览。
2. 以下操作需验证邮箱后开放：
- 发起支付
- 创建/回复工单
- 上传
- 其它高价值写操作

3. 后端返回 `EMAIL_NOT_VERIFIED` 时前端统一行为：
- toast 提示“请先完成邮箱验证”
- 跳转 `#/verify-code?email=xxx`

4. 验证接口：
- `POST /api/auth/send-code`
- `POST /api/auth/verify-code`

---

## 6. 支付对接重点（事故高发区）

### 6.1 下单

1. 接口：`POST /api/payment/create`
2. `Idempotency-Key` 必须放请求头，不放 body。
3. 前端 request body 不应包含 `idempotencyKey` 字段（需先剥离）。
4. 下单成功返回 `paymentUrl` 时：
- 打开新窗口或跳转
- 持久化 `orderId`
- 进入轮询状态

### 6.2 轮询

1. 接口：`GET /api/payment/status/:id`
2. 轮询间隔：3 秒；超时：15 分钟。
3. 状态机判定：
- 成功：`COMPLETED`
- 失败：`FAILED`、`EXPIRED`
- 等待：`PENDING`

4. 兼容两种响应形态：
- `{ status, orderId }`
- `{ success, data: { status, orderId } }`

### 6.3 取消订单

1. 接口：`POST /api/payment/:orderId/cancel`
2. 用户主动取消时应：
- 停止轮询
- 清理本地 pending key
- 调取消接口（失败可忽略，前端保持可恢复）

### 6.4 UI 业务一致性要求

1. 输入自定义金额时必须切到 `selectedPlan='custom'`。
2. 账单周期文案必须覆盖 `monthly/quarterly/yearly/one-time`。
3. 移动端支付页必须接入移动专用 flow，不复用桌面状态机。

---

## 7. 主要模块接口清单（给前端设计/开发）

### 7.1 服务器与互动

- `GET /api/public/servers`
- `GET /api/public/servers/status`
- `GET /api/servers/:id`
- `POST /api/servers/:id/like`
- `GET /api/public/servers/:id/comments`
- `POST /api/servers/:id/comments`
- `DELETE /api/servers/:id/comments/:commentId`

### 7.2 用户中心

- `GET /api/profile`
- `PUT /api/profile`
- `PUT /api/profile/password`
- `GET /api/user/checkin/status`
- `POST /api/user/checkin`

### 7.3 工单

- `GET /api/tickets`
- `POST /api/tickets`
- `GET /api/tickets/:id`
- `POST /api/tickets/:id/messages`
- `PUT /api/tickets/:id/status`

### 7.4 上传

- `POST /api/upload`

### 7.5 支付

- `POST /api/payment/create`
- `GET /api/payment/status/:id`
- `POST /api/payment/:id/cancel`

### 7.6 管理后台

- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/role`
- `GET /api/admin/servers/pending`
- `POST /api/admin/servers/:id/approve`
- `POST /api/admin/servers/:id/reject`
- `GET /api/port5555/stats`
- `GET /api/port5555/logs`

---

## 8. 前端页面必须具备的通用状态

每个页面至少设计并实现以下 6 类状态：

1. Loading（骨架屏）
2. Empty（空数据）
3. Error（失败重试）
4. Unauthorized（未登录）
5. Forbidden（无权限）
6. Locked（邮箱未验证，功能锁定）

---

## 9. 联调验收清单（交付前逐条打勾）

1. 是否统一走 `/api` 并自动版本化到 `/api/v1`。
2. 是否统一处理成功/错误包络。
3. 是否所有写请求都携带 CSRF。
4. 是否登录态完全依赖 Cookie 会话。
5. 是否实现 `EMAIL_NOT_VERIFIED` 跳转验证页。
6. 支付是否通过请求头传 `Idempotency-Key`。
7. 支付轮询是否正确识别 `COMPLETED/FAILED/EXPIRED`。
8. 自定义金额是否真实生效。
9. 移动支付页是否使用移动专用流程。
10. 是否通过 `npm run validate` 与 `npm run release:preflight`。

---

## 10. 交接建议

1. 本文档与以下文档一起交接：
- `docs/API-REST-STYLE-GUIDE.md`
- `docs/API-REQUEST-VALIDATION-GUIDE.md`
- `docs/API-RESPONSE-DESIGN-GUIDE.md`
- `docs/API-ERROR-CODE-CATALOG.md`
- `docs/API-INTEGRATION-GUIDE.md`

2. 前端对接人首次进场流程：
- 先跑 `dev:stack`
- 再按本文第 9 节联调清单逐项验证
- 最后提交验收记录（问题、截图、请求/响应样例、requestId）
