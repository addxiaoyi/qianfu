# XPay 个人码桥接本地联调

## 目的
- 本地模拟“个人码监听器”到账通知
- 验证:
  - 监听器 -> 千服桥接 API
  - 千服桥接 API -> XPay `/open/gateway/.../notify`
  - XPay -> 租户业务回调

## 先决条件
- 千服 Node 服务已启动
- XPay 已启动
- 支付项目配置里已填:
  - `bridgeNotifySecret`
  - `xpayGatewayBaseUrl`
  - `xpayGatewayNotifySecret`
  - `xpayTenantKey`
- XPay 对应租户订单已存在

## 推荐环境变量
```env
XPAY_BRIDGE_NOTIFY_URL=http://127.0.0.1:3001/api/v1/payment/xpay-bridge/notify
XPAY_BRIDGE_PROJECT_KEY=qianfu
XPAY_BRIDGE_NOTIFY_SECRET=replace-with-your-bridge-secret
XPAY_BRIDGE_PROVIDER=alipay
```

## 启动命令
```bash
npm run simulate:xpay-bridge -- tenant-order-1003 28.00 ALI-SIM-001 alipay
```

参数顺序:
1. `orderId`
2. `amount`
3. `tradeNo`
4. `provider`

## 成功结果
- 脚本会打印桥接请求 payload
- 千服桥接接口返回 `200`
- XPay 对应订单被标记成功
- `callback-echo` 能看到新的回调落点

## 可选验证地址
- 千服桥接:
  - `http://127.0.0.1:3001/api/v1/payment/xpay-bridge/notify`
- XPay 回调回显:
  - `http://127.0.0.1:8888/open/debug/callback-echo`

## 常见失败点
- `Bridge project config incomplete`
  - 说明 payment project 缺桥接配置字段
- `Invalid bridge signature`
  - 说明 `XPAY_BRIDGE_NOTIFY_SECRET` 不匹配
- `XPay gateway notify failed`
  - 说明 XPay 网关密钥或 `tenantKey/orderId` 不对
- `order not found`
  - 说明 XPay 里还没有这个租户订单
