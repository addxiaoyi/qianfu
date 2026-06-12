# 支付项目 JSON 模板

## 1. 千服默认项目（XPay）

```json
{
  "key": "qianfu",
  "displayName": "QianFu",
  "upstreamProvider": "xpay",
  "backupUpstreamProvider": "tpay",
  "xpayApiUrl": "https://pay.star-web.top/xpay/starmc/pay",
  "xpayToken": "replace-with-your-xpay-token",
  "xpayNotifyUrl": "https://pay.star-web.top/api/v1/payment/xpay/notify",
  "xpayGatewayBaseUrl": "https://pay.star-web.top/xpay",
  "xpayGatewayNotifySecret": "replace-with-your-xpay-gateway-secret",
  "xpayTenantKey": "demo-tenant",
  "xpayTenantCallbackSecret": "replace-with-your-xpay-tenant-callback-secret",
  "bridgeNotifySecret": "replace-with-your-bridge-secret"
}
```

## 2. StarMC 项目（XPay + 下游业务回调）

```json
{
  "key": "starmc",
  "displayName": "StarMC",
  "upstreamProvider": "xpay",
  "backupUpstreamProvider": "hupijiao",
  "xpayApiUrl": "https://pay.star-web.top/xpay/starmc/pay",
  "xpayToken": "replace-with-your-xpay-token",
  "xpayNotifyUrl": "https://pay.star-web.top/api/v1/payment/xpay/notify",
  "xpayGatewayBaseUrl": "https://pay.star-web.top/xpay",
  "xpayGatewayNotifySecret": "replace-with-your-xpay-gateway-secret",
  "xpayTenantKey": "starmc-main",
  "xpayTenantCallbackSecret": "replace-with-your-xpay-tenant-callback-secret",
  "bridgeNotifySecret": "replace-with-your-bridge-secret",
  "downstreamNotifyUrl": "https://starmc.example.com/api/payment/callback",
  "downstreamNotifySecret": "replace-with-your-downstream-secret"
}
```

## 3. 第三方项目（PayPro）

```json
{
  "key": "thirdparty-demo",
  "displayName": "ThirdParty Demo",
  "upstreamProvider": "paypro",
  "payProApiUrl": "http://127.0.0.1:8889",
  "payProOpenApiSecret": "replace-with-paypro-secret",
  "payProNotifyUrl": "https://pay.star-web.top/api/v1/payment/paypro/notify",
  "xpayGatewayBaseUrl": "https://pay.star-web.top/xpay",
  "xpayGatewayNotifySecret": "replace-with-your-xpay-gateway-secret",
  "xpayTenantKey": "thirdparty-demo",
  "xpayTenantCallbackSecret": "replace-with-your-xpay-tenant-callback-secret",
  "bridgeNotifySecret": "replace-with-your-bridge-secret",
  "downstreamNotifyUrl": "https://demo.example.com/api/payment/callback",
  "downstreamNotifySecret": "replace-with-your-downstream-secret"
}
```

## 4. Tpay 全自动方案

```json
{
  "key": "qianfu-tpay",
  "displayName": "QianFu Tpay",
  "upstreamProvider": "tpay",
  "backupUpstreamProvider": "hupijiao",
  "tpayGatewayUrl": "https://gateway.xddpay.com",
  "tpayAppId": "10088",
  "tpayAppSecret": "replace-with-tpay-secret",
  "tpayQueryUrl": "https://gateway.xddpay.com/query.ashx"
}
```

## 5. HuPiJiao 备用方案

```json
{
  "key": "qianfu-hupijiao",
  "displayName": "QianFu HuPiJiao",
  "upstreamProvider": "hupijiao",
  "hupijiaoGatewayUrl": "https://api.xunhupay.com/payment/do.html",
  "hupijiaoBackupGatewayUrl": "https://api.dpweixin.com/payment/do.html",
  "hupijiaoAppId": "replace-with-hupijiao-appid",
  "hupijiaoAppSecret": "replace-with-hupijiao-secret",
  "hupijiaoNotifyUrl": "https://pay.star-web.top/api/v1/payment/hupijiao/notify",
  "hupijiaoReturnUrl": "https://app.example.com/#/payment-success",
  "hupijiaoPlugins": "alipay",
  "hupijiaoVersion": "1.1"
}
```
