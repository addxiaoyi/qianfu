# 支付项目管理 API

## 路由

- `GET /api/v1/admin/payment-projects`
- `PUT /api/v1/admin/payment-projects/:projectKey`
- `DELETE /api/v1/admin/payment-projects/:projectKey`

## 权限

需要：

- 登录态
- `system_config` 权限

## 保存示例

```json
{
  "displayName": "StarMC",
  "upstreamProvider": "paypro",
  "backupUpstreamProvider": "hupijiao",
  "payProApiUrl": "http://127.0.0.1:8889",
  "payProOpenApiSecret": "secret",
  "payProNotifyUrl": "https://pay.example.com/api/payment/paypro/notify",
  "downstreamNotifyUrl": "https://starmc.example.com/api/payment/callback",
  "downstreamNotifySecret": "callback-secret"
}
```

## XPay 租户网关示例

当 `upstreamProvider` 为 `xpay` 且配置了以下字段时，Node 会调用 Java XPay 的租户下单接口：

```json
{
  "displayName": "StarMC",
  "upstreamProvider": "xpay",
  "xpayGatewayBaseUrl": "https://pay.example.com",
  "xpayTenantKey": "starmc",
  "xpayToken": "tenant-access-token",
  "xpayTenantCallbackSecret": "tenant-callback-secret",
  "xpayGatewayNotifySecret": "gateway-notify-secret",
  "bridgeNotifySecret": "bridge-secret",
  "personalQrListenerSecret": "listener-secret",
  "downstreamNotifyUrl": "https://starmc.example.com/api/payment/callback",
  "downstreamNotifySecret": "callback-secret"
}
```

此模式下创建支付返回：

- `provider`: `xpay-tenant`
- `paymentUrl`: Java XPay 租户支付页 `/open/tenants/{tenantKey}/orders/{orderId}/pay`
- `qrImagePath`: 当前租户支付方式配置的二维码图片地址（如果已配置）
- `paymentQrContent`: 当启用支付宝/微信官方 API 时，返回官方二维码内容，前端应优先展示这个二维码

联调命令：

```bash
npm run smoke:xpay-tenant
```

该命令会读取 `.env` 里的 `XPAY_GATEWAY_BASE_URL`、`XPAY_TENANT_KEY`、`XPAY_TOKEN`，直接向 Java XPay 创建 1 元测试订单，并输出 `paymentUrl` 与 `qrImagePath`。

租户成功回调接收地址：

- `POST /api/v1/payment/xpay/tenant-notify`

该回调使用 `xpayTenantCallbackSecret` 做 Base64 HMAC-SHA256 验签。

兼容旧 XPay 跳转收银台时，继续使用：

```json
{
  "displayName": "Legacy XPay",
  "upstreamProvider": "xpay",
  "xpayApiUrl": "https://pay.example.com/starmc/pay",
  "xpayToken": "legacy-token",
  "xpayNotifyUrl": "https://api.example.com/api/v1/payment/xpay/notify"
}
```

## XPay 付费版官方 API 模式

如果你已经购买 XPay 付费版，并拿到了支付宝/微信官方 API 密钥，项目配置仍然使用：

```json
{
  "displayName": "QianFu Official XPay",
  "upstreamProvider": "xpay",
  "xpayGatewayBaseUrl": "https://pay.example.com",
  "xpayTenantKey": "qianfu",
  "xpayToken": "tenant-access-token",
  "xpayTenantCallbackSecret": "tenant-callback-secret"
}
```

官方 API 密钥不存进 `payment_project:*`，而是通过 XPay Java 服务的环境变量提供：

```env
XPAY_PUBLIC_URL=https://pay.example.com
XPAY_PROVIDER_ALIPAY_ENABLED=true
XPAY_PROVIDER_ALIPAY_APP_ID=...
XPAY_PROVIDER_ALIPAY_PRIVATE_KEY=...
XPAY_PROVIDER_ALIPAY_PUBLIC_KEY=...
XPAY_PROVIDER_ALIPAY_VERIFY_ENABLED=true

XPAY_PROVIDER_WECHAT_ENABLED=true
XPAY_PROVIDER_WECHAT_APP_ID=...
XPAY_PROVIDER_WECHAT_MCH_ID=...
XPAY_PROVIDER_WECHAT_API_KEY=...
XPAY_PROVIDER_WECHAT_VERIFY_ENABLED=true
XPAY_PROVIDER_WECHAT_SPBILL_CREATE_IP=你的服务器公网IP
```

启用后，多租户 `XPay` 订单创建会直接调用官方支付宝当面付/微信 Native 下单，并把官方二维码内容返回给前端；支付成功后官方异步通知会打到：

- `/open/provider/alipay/tenants/{tenantKey}/orders/{orderId}/notify`
- `/open/provider/wechat/tenants/{tenantKey}/orders/{orderId}/notify`

## Tpay 示例

```json
{
  "displayName": "QianFu Tpay",
  "upstreamProvider": "tpay",
  "backupUpstreamProvider": "hupijiao",
  "tpayGatewayUrl": "https://gateway.xddpay.com",
  "tpayAppId": "10088",
  "tpayAppSecret": "replace-with-tpay-secret",
  "tpayQueryUrl": "https://gateway.xddpay.com/query.ashx"
}
```

Tpay 回调地址：

- `POST /api/v1/payment/tpay/notify`

## QiuPay 示例

```json
{
  "displayName": "QianFu QiuPay",
  "upstreamProvider": "qiupay",
  "backupUpstreamProvider": "xpay",
  "qiupayBaseUrl": "https://mc-u.top/qiupay",
  "qiupayPid": "1",
  "qiupayKey": "merchant_key_xxx",
  "qiupayNotifyUrl": "https://mc-u.top/api/v1/payment/qiupay/notify",
  "qiupayReturnUrl": "https://mc-u.top/#/payment/success"
}
```

QiuPay 路由：

- 发起支付：`POST {qiupayBaseUrl}/xpay/epay/mapi.php`
- 查询订单：`GET {qiupayBaseUrl}/xpay/epay/api.php?act=order...`
- 主站回调：`POST /api/v1/payment/qiupay/notify`

说明：

- 当前按仓库官方文档，只走 `type=alipay`
- 返回的 `qrcode` 会直接作为二维码图片 URL 使用
- `notify_url` 收到 `TRADE_SUCCESS` 后，主站必须返回纯文本 `success`

## Creem 示例

```json
{
  "displayName": "QianFu Creem",
  "upstreamProvider": "creem",
  "backupUpstreamProvider": "xpay",
  "creemApiBaseUrl": "https://api.creem.io",
  "creemApiKey": "creem_live_xxx",
  "creemWebhookSecret": "whsec_xxx",
  "creemProductId": "prod_xxx",
  "creemReturnUrl": "https://mc-u.top/api/v1/payment/creem/return"
}
```

Creem 路由：

- `POST /api/v1/payment/creem/webhook`
- `GET /api/v1/payment/creem/return`

说明：

- `creemApiBaseUrl` 留空时：
  - 测试 key 默认走 `https://test-api.creem.io`
  - 正式 key 默认走 `https://api.creem.io`
- `creemApiKey` 用于：
  - 创建 checkout
  - 校验 redirect return 签名
- `creemWebhookSecret` 用于校验 `creem-signature`
- `creemProductId` 是 Creem 后台产品 ID
- `creemReturnUrl` 不填时会自动回退到当前站点的 `/api/v1/payment/creem/return`

## HuPiJiao 示例

```json
{
  "displayName": "QianFu HuPiJiao",
  "upstreamProvider": "hupijiao",
  "hupijiaoGatewayUrl": "https://api.xunhupay.com/payment/do.html",
  "hupijiaoBackupGatewayUrl": "https://api.dpweixin.com/payment/do.html",
  "hupijiaoAppId": "replace-with-hupijiao-appid",
  "hupijiaoAppSecret": "replace-with-hupijiao-secret",
  "hupijiaoNotifyUrl": "https://api.example.com/api/v1/payment/hupijiao/notify",
  "hupijiaoReturnUrl": "https://app.example.com/#/payment-success",
  "hupijiaoPlugins": "alipay",
  "hupijiaoVersion": "1.1"
}
```

HuPiJiao 回调地址：

- `POST /api/v1/payment/hupijiao/notify`

## 默认项目

建议先保存：

- `qianfu`

然后再给外部项目各自保存：

- `starmc`
- `legacyshop`
- 其他项目 key

## 订单请求

创建订单时传：

```json
{
  "projectKey": "starmc",
  "planId": "basic-monthly",
  "amount": 20,
  "provider": "hupijiao",
  "paymentMethod": "wechat"
}
```

`provider` 可选值：

- `paypro`
- `xpay`
- `tpay`
- `hupijiao`
- `creem`
- `qiupay`

不传时使用项目默认 `upstreamProvider`；如果主 provider 下单失败且配置了 `backupUpstreamProvider`，后端会自动切备用。

## 回调规则

支付网关会：

1. 用订单号前缀识别项目
2. 用该项目自己的上游密钥验签
3. 支付成功后向项目自己的 `downstreamNotifyUrl` 推送业务回调

## 个人码桥接

外部监听器或人工确认中间层推送到 Node 桥接入口：

- `POST /api/v1/payment/xpay-bridge/notify`
- `POST /api/v1/payment/personal-qr/notify`

桥接入口使用 `bridgeNotifySecret` 验签，再用 `xpayGatewayNotifySecret` 转发到 Java XPay：

- `/open/gateway/tenants/{xpayTenantKey}/orders/{orderId}/notify`

个人码监听入口优先使用 `personalQrListenerSecret` 验签；未配置时回退使用 `bridgeNotifySecret`。详见 `docs/XPAY-PERSONAL-QR-LISTENER-MIDDLEWARE-2026-05-15.md`。
