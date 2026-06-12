# 2026-05-19 发布服务器计费闭环

## 当前结论

服务器发布链路统一为一套规则：

- `Payment` 页面只负责钱包充值
- `ServerEditor` 负责选择上架周期
- 创建服务器时直接从钱包余额扣款
- 订单回调里只有 `custom` 充值单会给钱包加钱

这样避免了两类错误：

- 先买发布套餐再创建时又扣一次钱包
- 普通用户没有 `publish_servers` 权限，导致明明有余额却无法发布

## 已落地规则

### 前端

- `qianfu-liandeng/src/pages/Payment.tsx`
  - 改成纯充值页
  - 不再售卖 `basic-monthly / pro-quarterly / vip-yearly`
  - 充值成功提示改为“余额已到账，发布时扣款”

- `qianfu-liandeng/src/pages/ServerEditor.tsx`
  - 保留发布套餐选择
  - 文案继续明确“新发布会从钱包余额扣款”

### 后端

- `server/controllers/servers/crud.ts`
  - 去掉创建前的 `userCanPublishServers` 预拦截
  - 普通用户只要余额足够且未超可用服务器位，就可以创建

- `server/services/userLevelService.ts`
  - 普通用户默认可有 `1` 个服务器位
  - 历史上已有 `publish_servers` 权限的账号仍兼容原有更高配额

- `server/services/paymentHandler.ts`
  - 发布套餐支付成功不再写入 `publish_servers` 权限
  - 只发充值到账通知，避免和发布业务混淆

## 2026-05-19 生产验证结果

### 部署

- 已同步到 `103.236.92.10:/www/wwwroot/qianfu-app`
- 已上传：
  - `qianfu-liandeng/dist`
  - `dist-server`
  - `prisma/schema.prisma`
  - `prisma/migrations/20260519080000_server_listing_plans`
- 远端未走 `npx prisma migrate deploy`
  - 原因：服务器侧 `npx` 拉到 Prisma 7，和当前 schema 写法不兼容
  - 处理：直接对 `prisma/dev.db` 执行 SQLite 列补齐与索引创建
- `pm2 restart qianfu-api` 后：
  - `qianfu-api` 在线
  - `https://mc-u.top/api/health` 返回 `200`
  - 首页入口已切到 `/assets/index-KY46svYY.js`

### 闭环验证

1. `custom` 充值单完成后，钱包余额增加
   - 已验证
   - `dev_local` 钱包从 `17.6` 变为 `27.6`
   - 路径：
     - `POST /api/v1/payment/create` with `planId=custom`
     - `POST /api/v1/payment/admin/complete-order`

2. 普通用户服务器配额与发布权限
   - 已验证
   - 新注册普通用户返回：
     - `max_cards = 1`
     - `current_cards = 0`
     - `can_publish = true`
   - 接口：
     - `GET /api/v1/servers/me`

3. 普通用户发布时不再报“无权限”
   - 已验证
   - 邮箱验证完成后，再次发布返回：
     - `400 INSUFFICIENT_FUNDS`
     - `message = 余额不足，无法开通服务器发布套餐`
   - 说明：流程已进入余额扣费分支，而不是旧的权限拦截分支

4. 充值后成功发布并写入上架字段
   - 已验证
   - 测试普通用户钱包从 `0` 充值到 `10`
   - 选择 `basic-monthly` 发布后：
     - 创建接口返回 `200`
     - `listing_plan = basic-monthly`
     - `listing_started_at` 已写入
     - `listing_expires_at` 已写入
     - `listing_price_paid = 700`
   - 管理员审核通过后，服务器状态切到 `APPROVED`

5. 公开列表路径与行为
   - 已验证
   - 前端真实公开列表路径是：
     - `GET /api/v1/public/servers`
   - 不是：
     - `GET /api/v1/servers/public/servers`
   - 已确认审核通过且未过期时，公开列表可见
   - 已在验证后删除测试服务器，当前公开列表和“我的服务器”都已清理干净

6. 通用线上烟测
   - 已验证
   - `npx tsx scripts/smoke-web-flows.ts`：PASS
   - `npx tsx scripts/smoke-auth-register-mail.ts`：PASS，保留 1 项邮箱收件箱人工确认 WARN

## 自动化回归

- 已新增脚本：
  - `scripts/smoke-wallet-listing-flow.ts`
- 已新增命令：
  - `npm run smoke:wallet-listing`

### 用法

运行前提供一个已验证邮箱的普通用户账号：

```powershell
$env:SMOKE_LISTING_USER_EMAIL='your-verified-user@example.com'
$env:SMOKE_LISTING_USER_PASSWORD='your-password'
npm run smoke:wallet-listing
```

### 当前实测结果

- 2026-05-19 已对生产 `https://mc-u.top` 跑通
- 结果：
  - 充值成功
  - 钱包增加
  - 发服成功
  - 审核通过
  - 公开列表可见
  - 删除后用户列表与公开列表都清空

## 浏览器验收补充

### 2026-05-19 浏览器侧发现与修复

- 现象：
  - 浏览器登录成功后，`#/dashboard` 内的以下接口在真实浏览器自动化里返回 `403`
    - `/api/v1/user/checkin/status`
    - `/api/v1/wallet/transactions`
    - `/api/v1/servers/me`
    - `/api/v1/tickets`
  - 返回码统一为：
    - `ILLEGAL_REQUEST_BLOCKED`

- 原因：
  - `server/middleware/antiCrawler.ts` 把带 `HeadlessChrome` 标识、但实际来自站内同源页面的自动化浏览器请求也判成了爬虫

- 修复：
  - 对“同源 referer + 浏览器提示头 + 非跨站”的自动化浏览器请求放行
  - 仍然保留对 `curl / python / axios / postman` 这类明显非浏览器抓取请求的拦截

### 修复后浏览器验收结果

- 桌面控制台：
  - `#/dashboard` 正常加载
  - 服务器位显示为 `0/1`
  - 快捷入口显示 `发布新服务器`
  - 最近账单显示 `Server publish plan: basic-monthly`

- 移动支付页：
  - `#/payment` 显示 `钱包充值`
  - 显示 `自定义金额`
  - 显示 `继续下一步`

- 移动首页：
  - `#/mobile` 正常加载
  - 搜索框、快捷入口、精选推荐区块可见
  - 不再是空白页
