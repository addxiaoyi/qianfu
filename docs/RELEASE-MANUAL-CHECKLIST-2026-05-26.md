# 交付人工验收清单（2026-05-26）

> 对齐 `docs/RELEASE-READINESS-2026-05-18.md` 的 6 条人工验收项。

## 执行前环境

1. 基础门禁先通过：

```bash
npm run release:preflight
```

2. 准备 QA 账号变量（建议写入 `.env` 或终端环境）：

```bash
QA_LOGIN_IDENTIFIER=...
QA_LOGIN_PASSWORD=...
QA_ADMIN_IDENTIFIER=...
QA_ADMIN_PASSWORD=...
QA_BASE_URL=https://mc-u.top
```

## 6 条人工验收

1. ICP 备案号可见且可点击
- 页面：桌面首页、移动端底部、管理端侧栏。
- 目标文案：`苏ICP备2026025306号-2`
- 链接：`https://beian.miit.gov.cn/`

2. 真机移动端可用性
- 用手机浏览器打开：`https://mc-u.top/#/mobile`
- 验证：登录、注册、工单新建、资料编辑输入时不整页刷新/不回跳。
- 参考自动化（公开页输入检查）：

```bash
node scripts/ui-mobile-public-input-check.cjs
```

3. 普通用户后台验收
- 登录普通用户后检查：
  - `/dashboard`
  - `/dashboard/servers`
  - `/dashboard/tickets`
- 参考自动化：

```bash
node scripts/ui-mobile-interaction-audit.cjs
```

4. 管理员后台验收
- 检查：
  - `/admin`
  - `/admin-tickets`
  - `/admin-qianfu`
  - `/admin-mail`
- 自动化（强制必须有管理员凭据）：

```bash
npm run audit:ui:full:admin-required
```

5. 真实邮箱到达验收
- 触发注册验证码与测试邮件。
- 在真实收件箱确认到达与内容可读。
- 参考脚本（仅接口层，不替代真实到达）：

```bash
npm run smoke:auth-mail
```

6. 真实小额支付闭环
- 在真实支付配置下完成小额订单，确认：
  - 主站订单 `COMPLETED`
  - 上游账单存在
  - 业务到账正常
- 支付回归前确认白名单配置：
  - `VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS`
  - `TRUSTED_REDIRECT_HOSTS`

## 验收记录模板

| 项目 | 结果 | 证据 |
|---|---|---|
| ICP 备案号可见 |  | 截图/录屏 |
| 真机移动端 |  | 设备型号+录屏 |
| 普通用户后台 |  | 截图 |
| 管理员后台 |  | 截图 |
| 真实邮箱到达 |  | 邮箱截图 |
| 真实小额支付闭环 |  | 订单号+上游流水 |

## 当前状态（截至 2026-05-27）

参考执行记录：
- `docs/RELEASE-MANUAL-CHECK-RUN-2026-05-26.md`
- `docs/RELEASE-MANUAL-CHECK-RUN-2026-05-27.md`

| 项目 | 当前状态 | 说明 |
|---|---|---|
| ICP 备案号可见 | 待人工最终截图 | 需在桌面首页、移动端、管理端分别留档 |
| 真机移动端 | 自动化通过，待真机留档 | 公开输入与登录后交互自动化均已通过 |
| 普通用户后台 | 自动化通过，待人工截图 | `/dashboard*` 自动化链路通过 |
| 管理员后台 | 自动化通过，待人工截图 | 管理端全量路由审计通过 |
| 真实邮箱到达 | 技术已确认，待人工截图签收 | 生产已切换 GMX SMTP 且 `mail-config-test-send` 返回 200；IMAP 核验日志 `tmp/gmx-imap-inbox-check-20260527.log` 已匹配到测试邮件 |
| 真实小额支付闭环 | 半完成（订单已创建） | `orderId=qianfu_dd3c7f1c-797f-4723-8d29-41af01e21a7d` 当前 `PENDING`，支付后执行 `PAYMENT_REQUIRE_COMPLETED=true npm run smoke:payment-order-status` 做最终签收 |
