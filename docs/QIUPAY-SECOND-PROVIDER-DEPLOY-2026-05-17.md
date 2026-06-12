# 2026-05-17 QiuPay 第二支付方案部署记录

## 目标

- 主域名：`mc-u.top`
- 主站目录：`/www/wwwroot/qianfu-app`
- QiuPay 目录：`/www/wwwroot/qiu-pay`
- 目标顺序：
  - 第一方案：`Creem`
  - 第二方案：`QiuPay`
  - 第三梯队：`XPay / TPay`

## 本次完成

### 1. 主站代码已重新部署到 `103.236.92.10`

- 已将本地最新 `dist-server` 与 `qianfu-liandeng/dist` 同步到远端。
- 已重启：
  - `pm2 restart qianfu-api`
- 当前进程：
  - `qianfu-api` 在线
  - `qianfu-xpay` 在线
  - `qiu-pay` 在线

### 2. 修复了线上前端 500

部署前远端存在真实故障：

- 宝塔 Nginx 站点根目录指向：
  - `/www/wwwroot/qianfu-app/qianfu-liandeng/dist`
- 但该目录当时不存在，导致：
  - `http://mc-u.top/` 返回 `500 Internal Server Error`

已修复：

- 重新下发前端 `dist`
- 当前验证：
  - `http://mc-u.top/` -> `200`
  - `http://mc-u.top/api/health` -> `200`

### 3. 管理员支付配置页顺序已调整

已把主站支付矩阵的 provider 顺序调整为：

1. `Creem`
2. `QiuPay`
3. `XPay`
4. `TPay`
5. `HuPiJiao`
6. `PayPro`

并修复了一个后端遗漏：

- `paymentProjectController` 之前没有把 `Creem / QiuPay` 正确纳入项目级 readiness map
- 现在 `admin/payment-projects` 已能返回：
  - `supportedProviders = ["creem","qiupay","xpay","tpay","hupijiao","paypro"]`

### 4. QiuPay 服务已作为独立第二方案部署

当前运行方式：

- PM2 进程名：`qiu-pay`
- 当前公网入口：`http://mc-u.top:8001`
- 健康检查：`http://mc-u.top:8001/health`
- 健康检查：
  - `http://127.0.0.1:8001/health` -> `{"status":"ok"}`
  - `http://mc-u.top:8001/health` -> `{"status":"ok"}`

说明：

- 因为 `qiu-pay` 前端和接口是根路径设计（`/xpay`、`/v1`、`/admin`），不适合直接塞进主站子路径。
- 当前采用独立服务运行。
- 已将 `qiu-pay` 从 `127.0.0.1:8001` 放开到公网 `8001/tcp`，方便直接进入后台上传凭证。
- 主站后端通过内网地址调用：
  - `http://127.0.0.1:8001`

### 5. 已创建 QiuPay 商户壳子

已在 `qiu-pay` 管理后台创建：

- 商户用户名：`qianfu`
- 商户 PID：`1`
- 当前商户凭证数：`0`

并已把以下字段预写入主站 `payment_project:qianfu` 配置：

- `qiupayBaseUrl = http://127.0.0.1:8001`
- `qiupayPid = 1`
- `qiupayKey = [server-side stored]`
- `qiupayNotifyUrl = http://mc-u.top/api/v1/payment/qiupay/notify`
- `qiupayReturnUrl = http://mc-u.top/#/payment/success`

## 当前还没到“可真实收款”的原因

`QiuPay` 服务虽然已上线、商户也已创建，但商户还没有完成这一步：

- 上传收款二维码
- 配置支付宝开发平台凭证：
  - `app_id`
  - `public_key`
  - `private_key`

在 `qiu-pay` 的代码里，若商户缺少这些凭证，创建订单会直接失败：

- `商户尚未配置收款码和支付宝凭证`

所以当前状态是：

- `QiuPay 已部署`
- `QiuPay 已建商户`
- `QiuPay 已接入主站配置`
- `QiuPay 还未完成凭证层配置，因此暂不能作为真实收款通道启用`

## 当前主站实际收款状态

- 主站当前仍保持：
  - `upstreamProvider = xpay`
- 这样可以避免在 `QiuPay` 凭证未配完之前，把线上切到不可用通道。

## 下一步

1. 登录 `qiu-pay` 后台，为商户 `qianfu` 上传收款码与支付宝凭证。
2. 在主站管理员支付配置页把：
   - 主通道切到 `Creem` 或
   - 备用通道切到 `QiuPay`
3. 用真实订单测试：
   - 主站创建订单
   - `qiu-pay` 生成订单
   - 主站回调地址 `http://mc-u.top/api/v1/payment/qiupay/notify` 收到通知
   - 主站订单状态变成 `COMPLETED`
