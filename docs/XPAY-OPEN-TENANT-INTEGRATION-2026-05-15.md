# XPay 租户开放接入 Runbook

## 当前本地可用地址
- XPay 服务: `http://127.0.0.1:8888`
- 超级管理员后台: `http://127.0.0.1:8888/admin-login.html`
- 调试回调回显: `http://127.0.0.1:8888/open/debug/callback-echo`

## 已验证账号
- 超级管理员用户名: `addxiaoyi`
- 超级管理员密码: `Lsc513148`

## 已验证演示租户
- `tenantKey`: `demo-tenant`
- `accessToken`: `9hgXpK0Lm9mPTbblT9S6xZh3TlGCdPLQ2RrXSC60kys`
- 当前回调地址: `http://127.0.0.1:8888/open/debug/callback-echo`

## 开放接口

### 1. 获取租户公开资料
- `GET /open/tenants/{tenantKey}`
- 无需登录
- 返回:
  - 租户展示名
  - 启用中的支付方式

### 2. 创建订单
- `POST /open/tenants/{tenantKey}/orders`
- 需要请求头:
  - `Authorization: Bearer {accessToken}`
- 请求体示例:
```json
{
  "orderId": "tenant-order-1001",
  "outOrderId": "merchant-order-9001",
  "amount": "88.50",
  "subject": "StarMC VIP",
  "body": "Demo tenant order",
  "payType": "alipay",
  "metadata": {
    "userId": "u_1001",
    "serverId": "s_9001"
  }
}
```

### 3. 查询订单
- `GET /open/tenants/{tenantKey}/orders/{orderId}`
- 需要请求头:
  - `Authorization: Bearer {accessToken}`

### 4. 标记支付成功并触发业务回调
- `POST /open/tenants/{tenantKey}/orders/{orderId}/paid`
- 需要请求头:
  - `Authorization: Bearer {accessToken}`
- 请求体示例:
```json
{
  "tradeNo": "TRADE-DEMO-001"
}
```

### 5. 上游网关统一支付通知入口
- `POST /open/gateway/tenants/{tenantKey}/orders/{orderId}/notify`
- 适合你的中间层、回调转发器或统一支付网关来调用
- 不依赖租户 `accessToken`
- 依赖网关通知签名
- 请求体最少建议包含:
```json
{
  "tradeNo": "ALIPAY-20260515-0001",
  "timestamp": "1778823000000",
  "nonce": "abc123xyz",
  "status": "SUCCESS",
  "sign": "Base64-HMAC-SHA256"
}
```

## 网关通知签名规则
- 配置项:
  - `xpay.gateway.notify-secret`
  - 未单独配置时默认回退到 `qianfu.secret-key`
- 签名算法:
  - `HmacSHA256`
  - `Base64`
- 参与签名字段:
  - 取请求 JSON 中除 `sign` 外全部字段
  - 按 key 升序
  - 拼接 `key=value&key=value`
- 校验通过后:
  - 对应租户订单会被标记支付成功
  - XPay 会继续向租户自己的 `callbackUrl` 发送业务回调

## 厂商回调适配入口

### 支付宝回调适配
- `POST /open/provider/alipay/tenants/{tenantKey}/orders/{orderId}/notify`
- 适合把支付宝表单回调直接打进来
- 当前最关键字段:
  - `trade_status=TRADE_SUCCESS` 或 `TRADE_FINISHED`
  - `trade_no`

### 微信回调适配
- `POST /open/provider/wechat/tenants/{tenantKey}/orders/{orderId}/notify`
- 请求体是微信原始 XML
- 当前最关键字段:
  - `result_code=SUCCESS`
  - `transaction_id`

### 根据订单反查建议回调地址
- `GET /open/provider/orders/{orderId}`
- 返回:
  - `tenantKey`
  - `payType`
  - `alipayNotifyUrl`
  - `wechatNotifyUrl`

## 回调规则
- XPay 会向租户 `callbackUrl` 发送 `POST application/json`
- 当前回调字段:
  - `tenantKey`
  - `orderId`
  - `outOrderId`
  - `amount`
  - `subject`
  - `status`
  - `payType`
  - `tradeNo`
  - `paidAt`
  - `timestamp`
  - `nonce`
  - `metadata`
  - `sign`

## 回调签名规则
- 算法: `HmacSHA256`
- 编码: `Base64`
- 参与签名参数:
  - 取回调 JSON 中除 `sign` 外的字段
  - 按 key 的字典序升序排序
  - 拼接为 `key=value&key=value`
- 使用租户的 `callbackSecret` 作为 HMAC 密钥

## 本地实测样例
- 创建订单成功: `tenant-order-1001`
- 查询订单成功
- 标记支付成功后:
  - 订单状态变为 `1`
  - `callbackStatus` 变为 `SUCCESS`
  - 本地回调回显端点收到签名后的 payload

## 管理端新增接口
- `PUT /admin/tenants/{tenantId}`
- 可更新:
  - `displayName`
  - `callbackUrl`
  - `status`
  - `paymentMethods`

## 当前限制
- `paid` 适合后台手工确认或本地联调
- `/open/gateway/.../notify` 更适合真实支付中间层或厂商回调转发接入
- `/open/provider/.../notify` 是厂商回调适配层，目前先做最小成功态接入，尚未加入支付宝签名验真和微信签名验真
- 本地当前使用临时 MySQL `3307`
- 旧租户如创建于密文字段上线前，需要轮换一次密钥
