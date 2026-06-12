# 2026-05-18 易支付 `ezfpy.cn` / QiuPay 接入状态

## 本次目标

- 把主站 Node 支付通道从旧的 `.../xpay/epay/mapi.php` 兼容写法，改成可对接 `https://www.ezfpy.cn` 的标准易支付 V1 `mapi.php`
- 修复支付后台把 `qiupay` 长期显示成灰态、语义不清的问题
- 验证 `mc-u.top` 线上是否能真实打到易支付上游

## 已完成改动

### 1. 后端下单路径兼容易支付 V1

- 文件：`server/controllers/paymentController.ts`
- 改动：
  - `qiupayBaseUrl` 现在支持两种写法：
    - 根地址：`https://www.ezfpy.cn`
    - 直接完整入口：`https://www.ezfpy.cn/mapi.php`
  - 不再强行拼接旧路径 `/xpay/epay/mapi.php`
  - 成功响应兼容字段：
    - `qrcode`
    - `payurl`
    - `url`
  - 成功码兼容：
    - `1`
    - `200`
    - `success`
  - `qiupay` 现已支持：
    - `alipay`
    - `wechat -> wxpay`

### 2. 前端支付后台语义修正

- 文件：`qianfu-liandeng/src/pages/admin/AdminPaymentConfig.tsx`
- 改动：
  - UI 标签从 `QiuPay` 调整为 `EPay / 易支付`
  - 配置说明改为面向 `ezfpy.cn` / 标准易支付 V1
  - base url 提示改为可直接填 `https://www.ezfpy.cn`

### 3. 我的服务器页真实数据修正

- 文件：`qianfu-liandeng/src/pages/MyServers.tsx`
- 改动：
  - 请求路径已使用 `/api/v1/servers`
  - 兼容分页响应结构
  - 改为读取真实后端字段：
    - `thumbnail`
    - `review_status`
    - `activity`
    - `supported_versions`
  - 不再误读旧的 `/me/servers`

## 线上验证结果

### 已验证通过

1. 前端新 bundle 已上线
   - 首页当前返回：`assets/index-DBdVWNAl.js`

2. 后端新支付控制器已上线
   - 远端 `dist-server/server/controllers/paymentController.js` 已包含 `mapi.php` 新路径逻辑

3. 主站到易支付上游的网络路径是通的
   - 在 `103.236.92.10` 直接请求：
     - `POST https://www.ezfpy.cn/mapi.php`
   - 返回：
     - `HTTP 200`
     - `{"code":201,"msg":"账户余额不足,无法发起支付!"}`

这说明：

- 主站已经不是“没接上易支付”
- 也不是“路径错误”
- 当前阻塞点是上游商户业务状态，而不是本地代码路径

### 已验证但不满足“可上线主通道”

1. 把 `payment_project:qianfu` 临时切到 `upstreamProvider=qiupay` 后
2. 通过管理员测试单接口创建订单：
   - `POST /api/v1/admin/payment-projects/qianfu/test-order`
3. 主站返回：
   - `502`
4. 线上日志明确记录：
   - `QiuPay create order failed: 账户余额不足,无法发起支付!`

结论：

- 易支付代码接入已打通
- 但当前 `ezfpy.cn` 商户无法成功创建真实订单
- 原因来自上游商户余额/业务状态，不是主站 API 路由或签名路径错误

## 风险控制

为了避免线上真实用户下单直接命中失败，本次已把 `qianfu` 项目恢复为：

- `upstreamProvider = xpay`
- `backupUpstreamProvider = qiupay`

也就是说：

- 生产主链路继续走当前稳定 `xpay`
- `ezfpy.cn` 仍保留为已配置备用通道，待商户余额或权限恢复后再切主

## 服务器列表结论

对 `dev_local` 管理员账号实测：

- `GET /api/v1/servers?page=1&limit=10`
- 返回：
  - `200`
  - `data: []`
  - `meta.total: 0`

结论：

- “我的服务器”页面现在空白并不是前端 bug
- 当前账号确实没有归属服务器
- 之前的真实 bug 是旧路径 `/api/v1/me/servers` 的 `404`，这个已经修复

## 当前结论

### 可以认定已完成

- 易支付 V1 路径接入
- 易支付后台配置语义修正
- `MyServers` 404 修复
- `MyServers` 真实字段映射修复

### 不能认定已完成

- `ezfpy.cn` 真实支付可用性

当前它不是代码没接好，而是上游商户返回：

- `账户余额不足,无法发起支付!`

## 下一步

1. 在 `ezfpy.cn` 后台确认：
   - 商户是否已启用
   - 商户余额是否足够
   - `PID 781` 是否允许对应支付方式
   - 回调域名 `https://mc-u.top/api/v1/payment/qiupay/notify` 是否已放行

2. 一旦上游余额/权限恢复，重新执行：
   - 后台测试单 `provider=qiupay`
   - 前端真实订单创建
   - 回调闭环验证

3. 确认成功后再把：
   - `payment_project:qianfu.upstreamProvider`
   - 从 `xpay` 切回 `qiupay`

## 2026-05-18 晚间追加：再次核对 `https://www.ezfpy.cn/doc`

本轮重新对照官方文档后，补齐了两处和标准易支付 V1 更一致的兼容点：

1. 支付结果通知兼容 `GET`
   - 文档侧 `支付结果通知` 使用 query string 形式说明回调参数
   - 主站原先只挂了：
     - `POST /api/v1/payment/qiupay/notify`
   - 现已补齐：
     - `GET /api/v1/payment/qiupay/notify`

2. 下单结果兼容 `code_url`
   - 文档成功响应示例里除 `qrcode` 外，还可能给出 `code_url`
   - 主站现已在 `qiupay` 创建结果中兼容 `code_url`
   - 如果上游返回的是二维码图片路径而非纯扫码字符串，主站也能接住

### 追加核对后的结果

补齐以上两点后，再次实测：

- 直连 `https://www.ezfpy.cn/mapi.php`
- 主站 `POST /api/v1/admin/payment-projects/qianfu/test-order`

结果仍然一致：

```json
{"code":201,"msg":"账户余额不足,无法发起支付!"}
```

结论没有变化：

- 当前剩余阻塞点不是文档协议差异
- 而是 `ezfpy.cn` 商户业务状态本身
