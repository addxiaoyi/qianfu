# XPay 个人收款码自动回调桥接方案

## 结论
- 可以做“个人收款码自动回调”，但不是支付宝/微信官方给个人静态码直接推业务回调。
- 正规落地方式是:
  - 前端或第三方项目调用 XPay 创建订单
  - XPay 返回租户订单和收款方式
  - 个人码监听器或中间层识别到账结果
  - 中间层调用 XPay 的 `/open/gateway/tenants/{tenantKey}/orders/{orderId}/notify`
  - XPay 再向商户自己的 `callbackUrl` 发业务回调

## 适用场景
- 个人支付宝收款码
- 个人微信收款码
- 非官方直连能力的轻量支付接入
- 多项目共用一个 XPay 中心支付服务

## 不适合误解成什么
- 不是“个人静态二维码天然支持服务端异步通知”
- 不是“用户扫码后支付宝官方会直接把订单状态回推到你的个人服务器”
- 真正自动化仍然依赖外部监听器、中间层或人工确认链路

## 当前 XPay 已有接口

### 商户创建订单
- `POST /open/tenants/{tenantKey}/orders`
- 要求 `Authorization: Bearer {accessToken}`

### 中间层回推支付成功
- `POST /open/gateway/tenants/{tenantKey}/orders/{orderId}/notify`
- 用网关密钥签名，不用租户 `accessToken`

### XPay 向商户系统发业务回调
- 回调到租户自己的 `callbackUrl`
- 用租户自己的 `callbackSecret` 签名

## 推荐链路

### 方案 A: 个人码监听器桥接
1. 商户项目调用 XPay 创建订单
2. XPay 返回订单号、支付方式、支付页信息
3. 用户扫码向个人码付款
4. 外部监听器识别到账结果
5. 监听器按网关签名规则调用 XPay 网关通知接口
6. XPay 落单成功后再回调商户业务系统

### 方案 B: 人工确认桥接
1. 商户项目调用 XPay 创建订单
2. 用户扫码支付
3. 后台人工确认到账
4. 管理端或脚本调用 XPay 标记支付成功接口
5. XPay 继续发业务回调

### 方案 C: 官方支付回调适配
- 如果后续切到官方支付宝当面付或微信 Native
- 可以直接把官方回调打进:
  - `/open/provider/alipay/tenants/{tenantKey}/orders/{orderId}/notify`
  - `/open/provider/wechat/tenants/{tenantKey}/orders/{orderId}/notify`

## 中间层最小职责
- 识别支付渠道到账结果
- 根据金额、附言、商户单号或本地映射定位 XPay 订单
- 生成签名并调用 XPay 网关通知接口
- 做幂等重试
- 保存原始到账流水和推送日志

## XPay 网关通知请求示例
```json
{
  "tradeNo": "ALI-PERSONAL-20260515-0001",
  "status": "SUCCESS",
  "amount": "88.50",
  "timestamp": "1778823000000",
  "nonce": "a8f3b2c19e0d",
  "sign": "Base64-HMAC-SHA256"
}
```

## 入账校验规则
- 网关通知必须带 `amount`、`timestamp`、`nonce`、`status`、`tradeNo` 和 `sign`。
- `status` 只接受 `SUCCESS`。
- `timestamp` 必须在服务端 5 分钟容忍窗口内。
- `amount` 必须与 XPay 订单金额完全一致。
- 订单必须仍是待支付状态，且不能超过订单过期时间。
- 支付宝官方适配入口使用 `total_amount` 校验金额。
- 微信官方适配入口使用 `total_fee`（分）换算后校验金额。

## 签名规则
- 密钥: `xpay.gateway.notify-secret`
- 算法: `HmacSHA256`
- 编码: `Base64`
- 待签名内容:
  - 取 JSON 中除 `sign` 外全部字段
  - 按 key 升序
  - 拼成 `key=value&key=value`

## 回调给商户系统的字段
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

## 多项目共用方式
- 一个 XPay 服务可以服务多个项目
- 每个项目建一个 tenant
- 每个 tenant 独立:
  - `accessToken`
  - `callbackSecret`
  - `callbackUrl`
  - 支付方式配置
- 这样可以做到:
  - 项目 A 和项目 B 完全隔离
  - 回调地址互不串单
  - 密钥独立轮换
  - 给第三方接入时按租户发放独立凭证

## 生产建议
- XPay 对外只暴露 HTTPS
- 网关通知密钥与租户回调密钥分开
- 回调日志至少保留 7 到 30 天
- 商户回调必须做幂等
- 监听器必须做金额校验和重复到账校验
- 不要把超级管理员密码、租户 token、回调密钥写进代码仓库

## 现阶段边界
- 当前仓库里已经有桥接入口
- 个人码“自动回调”还缺你的外部监听器
- 如果没有监听器，就只能走人工确认或半自动

## 对你现在这套的直接结论
- XPay 已经可以作为统一支付中台
- 也已经能给多个项目分开用
- 也可以给别人接入回调
- 但“个人收款码自动到账回调”这一段，必须额外接一个监听/转发中间层，不能把个人静态码本身当成官方异步通知源
