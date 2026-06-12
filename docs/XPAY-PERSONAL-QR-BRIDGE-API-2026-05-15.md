# XPay 个人码桥接 API

## 目标
- 给外部监听器一个稳定入口
- 监听器只需要把个人码到账结果推给千服
- 千服再签名转发到 XPay:
  - `/open/gateway/tenants/{tenantKey}/orders/{orderId}/notify`

## 桥接入口
- `POST /api/v1/payment/xpay-bridge/notify`

## 项目配置新增字段
- `bridgeNotifySecret`
  - 外部监听器调用千服桥接接口时使用
- `xpayGatewayBaseUrl`
  - 例如 `http://127.0.0.1:8888`
- `xpayGatewayNotifySecret`
  - 与 XPay `xpay.gateway.notify-secret` 保持一致
- `xpayTenantKey`
  - 例如 `demo-tenant`

## 请求体
```json
{
  "projectKey": "qianfu",
  "orderId": "tenant-order-1003",
  "amount": "28.00",
  "tradeNo": "ALI-PERSONAL-20260515-0001",
  "timestamp": "1778826000000",
  "nonce": "3f4aab8e8d40",
  "status": "SUCCESS",
  "provider": "alipay",
  "metadata": {
    "source": "personal-qr-listener"
  },
  "sign": "hex-hmac-sha256"
}
```

## 桥接签名规则
- 算法:
  - `HmacSHA256`
- 编码:
  - `hex`
- 使用密钥:
  - `bridgeNotifySecret`
- 参与签名字段:
  - `projectKey`
  - `orderId`
  - `amount`
  - `tradeNo`
  - `timestamp`
  - `nonce`
  - `status`
  - `provider`
- 排序:
  - 按 key 升序
- 拼接:
  - `key=value&key=value`

## XPay 网关转发
- 千服收到桥接请求后会再生成一份 XPay 网关签名
- 转发到:
  - `{xpayGatewayBaseUrl}/open/gateway/tenants/{xpayTenantKey}/orders/{orderId}/notify`
- 这里使用:
  - `xpayGatewayNotifySecret`
- 编码:
  - `Base64`

## 幂等
- 桥接接口内置 replay 防重
- 默认 TTL:
  - `600` 秒
- 可通过环境变量覆盖:
  - `XPAY_BRIDGE_REPLAY_TTL_SECONDS`

## 典型链路
1. 外部监听器识别个人码到账
2. 监听器计算桥接签名
3. 调用 `/api/v1/payment/xpay-bridge/notify`
4. 千服验证签名和时间戳
5. 千服转发到 XPay `/open/gateway/.../notify`
6. XPay 标记订单成功并回调租户业务地址
