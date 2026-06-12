# 交付人工验收执行记录（2026-05-27）

> 延续：`docs/RELEASE-MANUAL-CHECK-RUN-2026-05-26.md`  
> 目标：补齐 2026-05-27 当天新增自动化证据、阻塞项和门禁复验结果

## 新增执行与结果

1. 支付 + 上架 + 删除闭环（自动化）

```bash
SMOKE_WEB_BASE_URL=https://mc-u.top \
SMOKE_ADMIN_IDENTIFIER=<qa-admin> \
SMOKE_ADMIN_PASSWORD=<qa-admin-pass> \
SMOKE_LISTING_USER_EMAIL=<qa-user-email> \
SMOKE_LISTING_USER_PASSWORD=<qa-user-pass> \
npm run smoke:wallet-listing
```

结果：
- 核心链路通过（充值、扣费、上架、审核、删除）
- `public-cleared` 为 `WARN`：删除后公开列表存在短暂延迟（`eventual-sync-pending`），非核心资金链路失败
- 日志：`tmp/smoke-wallet-listing-20260527-auto5.log`
- 报告：`logs/smoke-wallet-listing-flow-2026-05-27-auto5.json`
- 复跑（同结论）：
  - 日志：`tmp/smoke-wallet-listing-20260527-auto6.log`
  - 报告：`logs/smoke-wallet-listing-flow-2026-05-27-auto6.json`

2. 认证/邮件冒烟（SMTP + API）

```bash
npm run smoke:auth-mail -- --skip-core
```

结果：
- `Result: PASS_WITH_WARNINGS`
- SMTP 可用：`smtp-relay.brevo.com:587` 验证成功
- Brevo API 返回 `401`，当前按“SMTP fallback 可用”降级为 `WARN`
- 日志：`tmp/smoke-auth-mail-20260527-auto2.log`
- 复跑（同结论）：
  - 日志：`tmp/smoke-auth-mail-20260527-auto3.log`

3. 注册 + 邮件配置链路冒烟

```bash
npx tsx scripts/smoke-auth-register-mail.ts
```

结果：
- OAuth 状态、登录、注册、发码、读取邮件配置均通过
- `mail-config-test-send` 失败（500）
- 日志：`tmp/smoke-auth-register-mail-20260527-auto.log`
- 报告：`logs/smoke-auth-register-mail-2026-05-27-auto.json`
- 复跑（同结论）：
  - 日志：`tmp/smoke-auth-register-mail-20260527-auto2.log`
  - 报告：`logs/smoke-auth-register-mail-2026-05-27T04-41-45-543Z.json`
- QA 管理员凭据复跑（增强诊断）：
  - 日志：`tmp/smoke-auth-register-mail-20260527-auto3.log`
  - 报告：`logs/smoke-auth-register-mail-2026-05-27-auto3.json`
  - 错误码：`EMESSAGE`（响应仍为通用 500 文案）

4. 生产邮件配置排障（远程）

已完成：
- 修复 QA 管理员权限 JSON 异常，恢复管理接口稳定性  
  证据：`tmp/remote-fix-qa-admin-permissions-20260527-115947.log`
- 补齐生产加密密钥环境变量  
  证据：`tmp/remote-set-mail-encryption-key-20260527-120619.log`
- PM2 侧确认过往故障包含解密/认证异常（`mail-config` 相关）  
  证据：`tmp/remote-pm2-mail-debug-20260527-115920.log`

5. 线上热更新与阻塞原因显式化（远程）

已完成：
- 发布最小热更新文件到生产：
  - `dist-server/server/controllers/mailConfigController.js(.map)`
  - `dist-server/server/services/cleanupService.js(.map)`
- 重启 `pm2 qianfu-api` 并确认进程在线。
- 远程状态证据：`tmp/remote-deploy-mail-cleanup-verify-20260527.log`

发布后复测：
- 日志：`tmp/smoke-auth-register-mail-20260527-auto5-postdeploy.log`
- 报告：`logs/smoke-auth-register-mail-2026-05-27-auto5-postdeploy.json`
- `mail-config-test-send` 现已返回明确原因（503）：
  - `Your SMTP account is not yet activated`
  - 需邮件供应商激活 SMTP 账户后才可通过真实邮箱到达验收

6. 生产邮件通道切换到 GMX 并验证通过（远程）

已完成：
- 使用管理员接口把生产 SMTP 切换到 GMX（SSL 465）。
- 首次按 `mail.gmx.cn` 测试失败，原因为证书域名不匹配。
- 改为 `smtp.gmx.com` 后测试通过（200）。

证据：
- 首次切换（证书不匹配）：`tmp/remote-mail-config-switch-gmx-20260527.log`
- 主机修正并通过：`tmp/remote-mail-config-switch-gmx-hostfix-20260527.log`
- 注册/邮件链路复测通过：`tmp/smoke-auth-register-mail-20260527-auto6-gmx-ok.log`
- 报告：`logs/smoke-auth-register-mail-2026-05-27-auto6-gmx-ok.json`

7. 真实小额支付订单状态复核（新增自动化）

```bash
SMOKE_WEB_BASE_URL=https://mc-u.top \
PAYMENT_PROJECT_KEY=qianfu \
PAYMENT_ORDER_ID=qianfu_dd3c7f1c-797f-4723-8d29-41af01e21a7d \
PAYMENT_UPSTREAM_ORDER_ID=Y2026052713184716056 \
PAYMENT_POLL_MAX_ATTEMPTS=1 \
PAYMENT_REQUIRE_COMPLETED=false \
npm run smoke:payment-order-status
```

结果：
- 管理端订单查询接口返回 `200`
- 订单状态当前为 `PENDING`（尚未完成真实支付动作）
- 支付链接可达性验证：`HTTP/1.1 200 OK`
- 报告：`logs/payment-order-status-2026-05-27-real-small-order.json`
- 日志：`tmp/real-payment-status-check-20260527.log`
- 链接探活日志：`tmp/real-payment-url-head-20260527.log`
- 当 `PAYMENT_REQUIRE_COMPLETED=true` 且状态非 `COMPLETED` 时，命令会返回非零退出码用于门禁阻断。

8. “支付链接打不开”现场排障与兜底

现象：
- 用户反馈原始链接无法打开（移动端内置浏览器）。

定位：
- 该支付页为“自动唤醒支付宝协议”页面（`alipayqr://...`），部分内置浏览器会拦截外部协议拉起，表现为打不开或无响应。
- 服务器侧探活正常：原始链接 `HTTP/1.1 200 OK`。

处理：
- 新建支付宝小额订单（0.1）：
  - `orderId`: `qianfu_829ec977-68c5-48db-aa5a-e582027a809a`
  - `upstreamOrderId`: `Y2026052713323041825`
  - `paymentUrl`: `https://code.ymyu.cn/url.php?user_id=2088052999146807&price=0.1&trade_no=qianfu_829ec977-68c5-48db-aa5a-e582027a809a`
  - 状态报告：`logs/payment-order-status-2026-05-27-retry-order.json`（当前 `PENDING`）
- 新建微信小额订单（0.1）作为兜底：
  - `orderId`: `qianfu_233e8038-2e6d-4980-8951-fd267d06e964`
  - `upstreamOrderId`: `Y2026052713333133384`
  - 二维码地址（上游）：`https://www.ezfpy.cn/upload/qrcode/20260518/2956053996ad4ac2e4e9f2551c452885.png`
  - 状态报告：`logs/payment-order-status-2026-05-27-wechat-retry-order.json`（当前 `PENDING`）

## 代码级稳健性加固（本轮）

1. 清理任务容错加固（避免周期性 P2003 噪声）
- 文件：`server/services/cleanupService.ts`
- 变更：
  - `cleanupExpiredUnverified` 从批量删除改为逐个用户清理
  - 引入外键冲突识别与“已知依赖清理后重试”
  - 单用户失败不再拖垮整个清理批次，按用户维度记录 `warn/error`

2. 邮件冒烟错误可观测性增强
- 文件：`scripts/smoke-auth-register-mail.ts`
- 变更：
  - `safeMsg` 增加 HTTP 状态与更多错误字段提取
  - `mail-config-test-send` 失败时附带压缩响应体，便于直接定位上游阻塞

## 发布门禁复验

```bash
PORT=13000 SMOKE_API_BASE_URL=http://127.0.0.1:13000 npm run release:preflight
```

结果：
- `PASS`
- 日志：`tmp/release-preflight-run13-port13000.log`

说明：
- 默认 `:3000` 在当前机器被其他项目占用，会导致 `smoke:api:local` 命中错误服务。
- 本仓复验已切到独立端口避免串扰，门禁链路通过。

5. 默认命令门禁（无手工端口参数）

```bash
npm run release:preflight
```

结果：
- `PASS`
- `smoke:api:local` 默认探测端口已切到 `13000`，避免与本机其他项目的 `3000` 端口冲突
- 日志：`tmp/release-preflight-run14-default.log`
- 对应脚本修复：`scripts/smoke-api-local.ts`

## 当前剩余阻塞

1. 真实邮箱到达验收
- 技术阻塞已解除（GMX SMTP 测试发送返回 200）。
- 剩余仅为人工收件箱确认与截图留档。

2. 真实小额支付闭环
- 自动化已完成内部资金链路与订单状态闭环。
- 已创建真实小额订单：
  - `orderId`: `qianfu_dd3c7f1c-797f-4723-8d29-41af01e21a7d`
  - `upstreamOrderId`: `Y2026052713184716056`
  - `paymentUrl`: `https://code.ymyu.cn/url.php?user_id=2088052999146807&price=0.1&trade_no=qianfu_dd3c7f1c-797f-4723-8d29-41af01e21a7d`
- 当前状态：`PENDING`，待真实支付后回切 `COMPLETED`。

## 建议下一步

1. 先完成真实邮箱可达性（含垃圾箱）人工验收并回填截图。
2. 若短期无法激活 Brevo SMTP，切换到可用 SMTP 通道后重跑：
   - `npx tsx scripts/smoke-auth-register-mail.ts`
   - `npm run smoke:auth-mail -- --skip-core`
3. 以生产白名单配置执行一次真实小额支付回归，回填订单号与上游流水号。
4. 支付完成后执行：
   - `PAYMENT_REQUIRE_COMPLETED=true npm run smoke:payment-order-status`
5. 完成后更新 `docs/RELEASE-MANUAL-CHECKLIST-2026-05-26.md` 的两项最终签收状态。
