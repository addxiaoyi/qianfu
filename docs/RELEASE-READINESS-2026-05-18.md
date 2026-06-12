# 千服交付前验收清单 - 2026-05-18

## 结论

当前版本已经通过一轮本地构建、类型检查、认证/邮件烟测、线上基础 API 烟测，并修复了两个会直接影响交付质量的高风险问题：

- `GET /api/v1/servers/me` 原先被 `/servers/:id` 抢路由，线上会返回 `400 Invalid ID`
- 现已修复并在生产环境验证返回 `200`
- 移动端存在双重分流/重复隐藏风险，在部分手机浏览器上可能表现为首页空白
- 现已移除移动包装层的二次 `isMobile` 分流，并去掉移动首页根节点的 `md:hidden`

当前版本可以进入交付验收，且主支付链路已经完成主站创单与签名回调闭环验证。

## 本地验证结果

### 1. 类型检查

- 命令：`npm run typecheck`
- 结果：PASS

### 2. 前端构建

- 命令：`npm run build`
- 结果：PASS
- 最新前端构建入口：
  - `qianfu-liandeng/dist/index.html`
  - `assets/index-BloShowb.js`

### 3. 认证/注册/邮件烟测

- 命令：`npx tsx scripts/smoke-auth-register-mail.ts`
- 结果：PASS（1 项 WARN）
- 通过项：
  - OAuth 状态
  - 密码登录
  - CSRF
  - Profile
  - 用户名检查
  - 注册
  - 新用户登录
  - 邮箱验证码发送
  - 邮件配置读取
  - 测试邮件发送
- 警告项：
  - 收件箱实际到达仍需人工确认

### 4. 线上基础 Web Smoke

- 命令：`npx tsx scripts/smoke-web-flows.ts`
- 结果：PASS
- 通过项：
  - 根页面
  - GitHub OAuth 状态/跳转/错误回跳
  - 密码登录
  - Profile
  - Mail Config / Mail Library
  - Payment Projects
  - Payment My
  - QiuPay health

## 生产环境已验证接口

### 正常

- `GET /api/v1/auth/oauth-status`
- `POST /api/v1/auth/login`
- `GET /api/v1/profile`
- `GET /api/v1/admin/mail-config`
- `GET /api/v1/admin/mail-config/library`
- `GET /api/v1/admin/payment-projects`
- `GET /api/v1/payment/my`
- `GET /api/v1/servers?page=1&limit=10`
- `GET /api/v1/servers/me`
- `GET /api/v1/tickets?limit=20`
- `POST /api/v1/admin/payment-projects/qianfu/test-order`
- `POST /api/v1/payment/qiupay/notify`

### 已修复

- `GET /api/v1/servers/me`
  - 修复前：`400 Invalid params parameters`
  - 原因：`/servers/:id` 抢匹配
  - 修复后：`200`
- 移动端首页空白风险
  - 原因：移动路由已在 `App.tsx` 分流后，`MobileWrapperPage` 仍二次判断 `isMobile`，`MobileHome` 同时存在 `md:hidden`
  - 修复后：移动页面不再做二次分流，也不再自带根节点隐藏

## 已完成但需要记住的发布项

### ICP 备案号

代码已加到：

- `qianfu-liandeng/src/components/Footer.tsx`
- `qianfu-liandeng/src/components/mobile/MobileLayout.tsx`
- `qianfu-liandeng/src/components/admin/AdminSidebar.tsx`

目标备案号：

- `苏ICP备2026025306号-2`
- 链接：`https://beian.miit.gov.cn/`

说明：

- 当前构建产物中已包含备案号字符串
- 远端 `index.html` 已切到新入口 `index-BloShowb.js`
- 若浏览器仍未看到，优先排查缓存

### 易支付 / `ezfpy.cn`

已补齐对照官方文档后的兼容项：

- `mapi.php` 下单路径
- `wxpay` / `alipay`
- `GET /api/v1/payment/qiupay/notify`
- `POST /api/v1/payment/qiupay/notify`
- `code_url` 响应兼容
- 主站创单成功返回 `paymentUrl`、`upstreamOrderId`
- 主站签名回调模拟后，订单状态已从 `PENDING` 变为 `COMPLETED`

当前项目支付状态：

- `qianfu.upstreamProvider = qiupay`
- `qianfu.backupUpstreamProvider = xpay`

## 当前上线建议

### 可以继续交付的部分

- 首页 / 搜索 / 服务器详情
- 登录 / 注册 / 邮件验证码
- 用户中心
- 工单系统
- 管理后台
- 邮件后台
- 服务器配额接口
- 主支付 `qiupay`
- 备用支付 `xpay`

## 交付前人工清单

1. 浏览器强刷首页，确认ICP备案号可见且可点击
2. 用手机真实浏览器打开首页，确认首页内容可见、不再空白
3. 登录普通用户，确认：
   - Dashboard 正常
   - `/dashboard/servers` 不报错
   - `/dashboard/tickets` 正常
4. 登录管理员，确认：
   - `/admin`
   - `/admin-tickets`
   - `/admin-qianfu`
   - `/admin-mail`
5. 检查真实邮箱收件箱，确认：
   - 注册验证码
   - 管理员测试邮件
6. 用真实支付环境完成一笔小额订单，确认：
   - 主站订单完成
   - 上游账单存在
   - 业务到账正常

## 本轮关键修复文件

- `server/routes/servers.ts`
- `server/controllers/paymentController.ts`
- `server/routes/payment.ts`
- `server/middleware/error.ts`
- `qianfu-liandeng/src/components/Footer.tsx`
- `qianfu-liandeng/src/components/mobile/MobileLayout.tsx`
- `qianfu-liandeng/src/components/mobile/MobileWrapperPage.tsx`
- `qianfu-liandeng/src/components/admin/AdminSidebar.tsx`
- `qianfu-liandeng/src/pages/MobileHome.tsx`
- `qianfu-liandeng/src/pages/MyServers.tsx`
- `qianfu-liandeng/src/pages/admin/AdminPaymentConfig.tsx`
