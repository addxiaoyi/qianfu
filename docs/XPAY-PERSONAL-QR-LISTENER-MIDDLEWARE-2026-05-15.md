# XPay 个人码到账监听中间层

## 入口

- `POST /api/v1/payment/personal-qr/notify`

该接口用于接收“个人码到账事件”。事件可以来自合法的外部监听器、人工确认工具或你自己的账单同步服务。

## 必填字段

```json
{
  "projectKey": "qianfu",
  "orderId": "qianfu_xxx",
  "provider": "alipay",
  "amount": "1.00",
  "tradeNo": "ALI-20260515-001",
  "timestamp": "1778823000000",
  "nonce": "a8f3b2c19e0d",
  "status": "SUCCESS",
  "sign": "hex-hmac-sha256"
}
```

`orderId` 可以省略，但 `remark`、`subject`、`description` 或 `memo` 中必须包含订单号。中间层不会只靠金额自动匹配订单，避免串单。

## 签名规则

- 密钥优先使用支付项目配置里的 `personalQrListenerSecret`
- 如果未配置，则回退到 `bridgeNotifySecret`
- 算法：`HmacSHA256`
- 编码：`hex`
- 待签名字段：
  - `projectKey`
  - `orderId`
  - `amount`
  - `tradeNo`
  - `timestamp`
  - `nonce`
  - `status`
  - `provider`
- 字段按 key 升序拼成 `key=value&key=value`
- `amount` 按两位小数签名，例如 `1.00`

## 处理逻辑

1. 校验项目配置、监听密钥和 XPay 网关配置。
2. 校验签名、时间戳和 nonce 防重放。
3. 校验 `provider`，当前支持 `alipay`、`wechat`、`qqpay`、`unipay`。
4. 只接受成功状态：`SUCCESS`、`PAID`、`TRADE_SUCCESS`。
5. 转发到 Java XPay：
   - `/open/gateway/tenants/{xpayTenantKey}/orders/{orderId}/notify`
6. Java XPay 再校验金额、订单状态、订单过期时间，并回调租户业务系统。

## 本地模拟

```bash
npm run simulate:personal-qr -- qianfu_xxx 1.00 ALI-20260515-001
```

需要 `.env` 中至少配置：

```env
PERSONAL_QR_LISTENER_SECRET=your-listener-secret
XPAY_GATEWAY_BASE_URL=http://127.0.0.1:8888
XPAY_GATEWAY_NOTIFY_SECRET=your-gateway-secret
XPAY_TENANT_KEY=qianfu
```

如果没有单独设置 `PERSONAL_QR_LISTENER_SECRET`，脚本会回退使用 `XPAY_BRIDGE_NOTIFY_SECRET`。

## 真实监听器接入建议

- 监听器只负责识别到账流水，不直接修改订单。
- 监听器必须把订单号写进 `orderId`，或保证付款备注里包含订单号。
- 每笔到账都要有唯一 `tradeNo`。
- 金额必须以实际到账金额上报。
- 不要只用金额匹配订单。
- 不要把监听器密钥写进前端或公开仓库。
