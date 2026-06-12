# 2026-05-14 支付系统状态

## 代码路径

- 后端控制器：`server/controllers/paymentController.ts`
- 后端路由：`server/routes/payment.ts`
- 前端支付页：`qianfu-liandeng/src/pages/Payment.tsx`
- 钱包签名：`server/lib/wallet.ts`

## 本次已确认问题

### 1. 前后端套餐 ID 与金额不一致

修复前：

- 前端使用：
  - `basic-monthly` = 20
  - `pro-quarterly` = 55
  - `vip-yearly` = 200
- 后端使用：
  - `basic-monthly` = 7
  - `premium-quarterly` = 20
  - `premium-yearly` = 63

影响：

- `POST /api/payment/create` 会对 `planId` 和 `amount` 做严格校验。
- 前端当前发起的 `pro-quarterly` / `vip-yearly` 会被后端识别为非法套餐。
- `basic-monthly` 即使套餐 ID 一致，金额也会被判定不匹配。

### 2. 线上真实收款状态仍未最终核验

当前仓库内已确认支付链路支持两类外部通道：

- PayPro
- XPay

但是否可真实收款，仍取决于线上环境变量与上游可达性，至少需要确认：

- `PAYPRO_ENABLED`
- `PAYPRO_API_URL`
- `PAYPRO_OPENAPI_SECRET`
- `PAYPRO_NOTIFY_URL`
- `PAYPRO_DEV_MOCK_ENABLED`
- `XPAY_TOKEN`
- `XPAY_API_URL`
- `XPAY_NOTIFY_URL`
- `WALLET_SECRET`

## 本次已做修复

文件：`server/controllers/paymentController.ts`

- 将后端套餐价格改为与前端支付页一致：
  - `basic-monthly` = 20
  - `pro-quarterly` = 55
  - `vip-yearly` = 200
- 增加套餐 ID 兼容映射：
  - `premium-quarterly` -> `pro-quarterly`
  - `premium-yearly` -> `vip-yearly`
- 创建订单时统一规范化 `planId` 后再校验、落库

结果：

- 当前前端支付页发起的套餐下单请求，后端可正确识别
- 历史若仍有旧调用方发送 `premium-*`，后端也可兼容

## 当前结论

可确认：

- 支付模块代码路径明确
- 支付创建接口的套餐配置阻塞已在源码层修复

仍未最终确认：

- 线上服务器是否已配置真实收款通道
- 线上回调地址是否已完成公网连通
- 线上是否处于 PayPro mock / XPay fallback / 真正生产收款

## 下一步

1. 将本次后端修复重新构建并部署到服务器
2. 在线上读取支付相关环境变量状态
3. 以真实登录态调用一次 `POST /api/payment/create`
4. 验证返回的是：
   - 真实支付二维码/跳转链接
   - 还是 mock 链路
   - 还是 503/配置缺失
