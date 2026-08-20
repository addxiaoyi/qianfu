# 2026-05-16 腾讯云部署状态

## 目标服务器

- IP: `110.40.170.13`
- 系统: `TencentOS Server 4.4`
- 部署目录: `/www/wwwroot/qianfu-app`

## 已确认在线

- `nginx` 监听 `80`
- `qianfu-xpay` 通过 PM2 在线
- `xpay` Java 进程监听 `8889`
- `http://127.0.0.1:8889/admin/login` 可返回后台登录页
- `XPAY_LOCAL_ADMIN_ENABLED=true` 已生效
- `XPAY_SUPERADMIN_BOOTSTRAP_USERNAME=xpayadmin` 已在启动时自动写入库

## 当前阻塞

- 首轮阻塞已经解除：
  - `qianfu-api` 重新监听 `3001`
  - `dist-server` 产物已重新同步
  - `paymentController.js` / `paymentProjectController.js` 已一致
- 第二轮阻塞也已解除：
  - SQLite `AuditLog` 缺少 `method` 等字段
  - `completeExternalPayment` / 手工完成支付路径曾在事务内写全局审计日志，触发 SQLite 写锁等待，导致 Prisma 交互事务 5 秒超时
- 第三轮租户模式阻塞也已解除：
  - 主站新增 `xpay` 租户 JSON 回调接收器
  - `antiCrawler` 已放行支付/桥接回调路径
  - `qianfu` 项目已切换为 `tenant-gateway`
  - `qianfu` 租户已在 `xpay` 后台创建并验证

## 历史错误记录

- 第一轮启动错误：

```text
SyntaxError: The requested module './paymentController.js' does not provide an export named 'PLAN_PRICES_FEN'
```

- 第二轮支付闭环错误：

```text
Transaction already closed: A commit cannot be executed on an expired transaction.
```

- 第三轮集成缺口：

```text
XPay 租户回调是签名 JSON，不是旧版 legacy xpay notify 表单
```

## 已验证的远端事实

- PM2:
  - `qianfu-api`
  - `qianfu-xpay`
- `qianfu-xpay` 最近一次启动成功日志包含：
  - Tomcat started on port `8889`
  - 自动插入 `t_admin_local_account`
- `qianfu-api` 错误日志混有旧的 Prisma 引擎错误，但最新直接阻塞是 `PLAN_PRICES_FEN` 导出缺失

## 2026-05-16 已完成修复

1. 本地重新构建：
   - `npm run server:build`
   - `npm --prefix qianfu-liandeng run build`
2. 打包并同步：
   - `dist-server`
   - `qianfu-liandeng/dist`
3. 远端重新补齐 Prisma Linux 兼容引擎：
   - `libquery_engine-rhel-openssl-3.0.x.so.node`
4. 远端重启：
   - `pm2 restart qianfu-api`
5. 增加运维脚本：
   - `scripts/linux/fix-sqlite-audit-log-schema.py`
6. 修复支付完成事务：
   - 将 `paymentController.ts` 中事务内的审计日志写入移到事务外
7. 新增租户回调能力：
   - `POST /api/v1/payment/xpay/tenant-notify`
8. 放行公开回调路径：
   - `server/middleware/antiCrawler.ts`
9. 已切换 `qianfu` 为 XPay 租户模式：
   - `xpayMode = tenant-gateway`
   - `tenantCallbackReady = true`
10. 已新增主站直管 XPay 租户接口：
   - `GET /api/v1/admin/payment-projects/:projectKey/xpay-tenant`
   - `POST /api/v1/admin/payment-projects/:projectKey/xpay-tenant/sync`
   - `POST /api/v1/admin/payment-projects/:projectKey/xpay-tenant/payment-methods/:payType/qr`

## 当前可用状态

- `http://110.40.170.13/` 返回新版前端
- `http://110.40.170.13/xpay/` 返回 XPay 首页
- `http://110.40.170.13/xpay/open/tenants/qianfu/orders/{orderId}/pay` 可返回租户支付页
- `http://127.0.0.1:3001/api/v1/auth/login` 正常
- `http://127.0.0.1:8889/admin/auth/local/login` 正常
- 默认支付项目 `qianfu` 已存在，主通道为 `xpay tenant`
- 管理后台接口 `/api/v1/admin/payment-projects` 可返回真实配置

## 已完成的烟雾验证

1. 主站本地管理员登录成功：
   - 测试账号凭据已从文档移除。
2. XPay 本地管理员登录成功：
   - 测试账号凭据已从文档移除。
3. 后台测试单创建成功：
   - `projectKey=qianfu`
   - `provider=xpay`
   - `planId=custom`
4. 模拟支付成功闭环成功：
   - 订单从 `PENDING` -> `COMPLETED`
   - 不再出现 `Transaction already closed`
5. 公网 `public/servers`:
   - 直接 `curl` 会被反爬拦截返回 `403`
   - 带浏览器提示头后可返回 `200`
   - 说明当前拦截是 `antiCrawler` 规则，不是 Nginx/路由故障
6. XPay 租户模式闭环成功：
   - `provider=xpay-tenant`
   - 支付页 URL:
     - `/xpay/open/tenants/qianfu/orders/{orderId}/pay`
   - 通过 `POST /open/tenants/qianfu/orders/{orderId}/paid` 触发 XPay 业务回调
   - 主站订单状态变为 `COMPLETED`
   - XPay 订单 `callbackStatus=SUCCESS`
7. 当前租户支付页资源状态：
   - `qianfu` 租户已启用 `alipay` / `wechat` 支付方式骨架
   - 但服务器上还没有上传任何租户二维码
   - 官方支付宝/微信 API 也仍是 `disabled`
   - 因此支付页当前会显示：
     - `当前支付方式未配置二维码`
8. 主站直管 XPay 租户已验证：
   - `xpay-tenant` 状态查询成功
   - `sync tenant` 旋转密钥并回写主站配置成功
   - QR 上传代理已验证成功
   - 测试上传后已立即清回空状态，未留下假二维码

## 下一步

1. 用真实浏览器打开：
   - `http://110.40.170.13/#/login`
   - `http://110.40.170.13/#/admin-qianfu`
2. 在 XPay 后台补真实收款资源：
   - 支付宝/微信二维码
   - 如启用官方 API，再填正式密钥
3. 如果走个人码监听/中间层：
   - 已有 `bridgeNotifySecret`
   - 已有 `personalQrListenerSecret`
   - 已有 `xpayGatewayNotifySecret`
   - 可直接接 `/api/v1/payment/personal-qr/notify` 或 `/api/v1/payment/xpay-bridge/notify`
4. 如需真实回调收款，继续接：
   - 官方支付宝/微信
   - 或 TPay / 虎皮椒备用通道
