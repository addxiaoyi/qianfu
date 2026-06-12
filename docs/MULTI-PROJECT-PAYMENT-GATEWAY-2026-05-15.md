# 多项目支付网关方案

## 目标

一套千服支付服务，服务多个项目：

- 每个项目独立 `projectKey`
- 每个项目独立上游支付配置
- 每个项目独立下游业务回调地址
- 每个项目独立下游签名密钥

## 当前实现

已支持请求体传入：

- `projectKey`

订单号格式：

- `<projectKey>_<uuid>`

用途：

- 创建订单时根据 `projectKey` 读取项目配置
- 收到第三方支付回调时，从订单号前缀反查项目配置
- 使用该项目自己的密钥验签
- 入账成功后，向项目自己的 `downstreamNotifyUrl` 发送业务回调

## 项目配置存储

当前版本为避免直接改线上数据库结构，项目配置存储在 `SystemConfig`：

- key: `payment_project:<projectKey>`
- value: JSON

示例：

```json
{
  "key": "starmc",
  "displayName": "StarMC",
  "upstreamProvider": "paypro",
  "payProApiUrl": "http://127.0.0.1:8889",
  "payProOpenApiSecret": "your-paypro-openapi-secret",
  "payProNotifyUrl": "https://pay.example.com/api/payment/paypro/notify",
  "downstreamNotifyUrl": "https://starmc.example.com/api/payment/callback",
  "downstreamNotifySecret": "your-downstream-hmac-secret"
}
```

XPay 项目示例：

```json
{
  "key": "legacyshop",
  "displayName": "Legacy Shop",
  "upstreamProvider": "xpay",
  "xpayApiUrl": "https://xpay.example.com/api/pay",
  "xpayToken": "your-xpay-token",
  "xpayNotifyUrl": "https://pay.example.com/api/payment/xpay/notify",
  "downstreamNotifyUrl": "https://legacyshop.example.com/api/payment/callback",
  "downstreamNotifySecret": "your-downstream-hmac-secret"
}
```

## 下游回调

支付成功后，支付网关会向项目自己的 `downstreamNotifyUrl` 发送：

```json
{
  "event": "payment.completed",
  "projectKey": "starmc",
  "orderId": "starmc_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "userId": 123,
  "amountFen": 2000,
  "currency": "CNY",
  "planId": "basic-monthly",
  "paymentMethod": "wechat",
  "status": "COMPLETED",
  "createdAt": "2026-05-15T00:00:00.000Z",
  "completedAt": "2026-05-15T00:00:05.000Z"
}
```

如果配置了 `downstreamNotifySecret`，会同时发送：

- `X-QianFu-Project: <projectKey>`
- `X-QianFu-Signature: <hex hmac sha256>`

签名算法：

- `HMAC-SHA256(body, downstreamNotifySecret)`

## 当前仍需你准备的内容

每个项目至少需要：

1. `projectKey`
2. 上游支付配置
3. 项目自己的业务回调地址
4. 项目自己的回调验签密钥

## 上线建议

1. 先保留默认项目 `qianfu`
2. 新增一个真实外部项目配置做联调
3. 由外部项目先验收下游回调
4. 再逐步把更多项目接入同一网关

## 后续可继续增强

1. 将项目配置从 `SystemConfig` 升级为独立 `PaymentProject` 表
2. 增加后台管理界面
3. 为下游回调增加重试队列
4. 为每个项目增加 IP 白名单、限额、状态开关
