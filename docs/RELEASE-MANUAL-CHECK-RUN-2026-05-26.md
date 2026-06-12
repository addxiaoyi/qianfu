# 交付人工验收执行记录（2026-05-26）

> 对应清单：`docs/RELEASE-MANUAL-CHECKLIST-2026-05-26.md`

## 已执行

1. 移动端公开输入稳定性：

```bash
QA_BASE_URL=https://mc-u.top node scripts/ui-mobile-public-input-check.cjs
```

结果：
- `total=2`
- `failed=0`
- 报告：`output/ui-audit-2026-05-21/mobile-public-input-report.json`

2. 移动端登录后交互稳定性（普通用户）：

```bash
QA_BASE_URL=https://mc-u.top \
QA_LOGIN_IDENTIFIER=<qa-user> \
QA_LOGIN_PASSWORD=<qa-pass> \
node scripts/ui-mobile-interaction-audit.cjs
```

结果：
- `total=4`
- `failed=0`
- 报告：`output/ui-audit-2026-05-21/mobile-interaction-report.json`

3. 全量 UI 审计（含管理员路由）：

```bash
QA_BASE_URL=https://mc-u.top \
QA_LOGIN_IDENTIFIER=<qa-user> \
QA_LOGIN_PASSWORD=<qa-pass> \
QA_ADMIN_IDENTIFIER=<qa-admin> \
QA_ADMIN_PASSWORD=<qa-admin-pass> \
npm run audit:ui:full:admin-required
```

结果：
- `total=47`
- `failed=0`
- 报告：`output/ui-audit-2026-05-21/report.json`

4. 浏览器认证链路脚本（兼容修复后）：

```bash
SMOKE_WEB_BASE_URL=https://mc-u.top \
SMOKE_LOGIN_IDENTIFIER=<qa-user> \
SMOKE_LOGIN_PASSWORD=<qa-pass> \
SMOKE_ADMIN_IDENTIFIER=<qa-admin> \
SMOKE_ADMIN_PASSWORD=<qa-admin-pass> \
node scripts/browser-auth-validation.cjs
```

结果：
- `PASS`
- 日志：`tmp/browser-auth-validation-20260526-2301.log`

5. 生产 QA 账号已创建（用于本次自动化）：

- 普通用户：`qa_user_20260526a1`
- 管理员：`qa_admin_20260526a1`
- 创建日志：`tmp/remote-create-qa-users-20260526-225313.log`

6. 发布门禁：

```bash
npm run release:preflight
```

结果：
- `PASS`
- 日志：`tmp/release-preflight-run11.log`

## 当前阻塞（待你提供）

1. 真实邮箱到达与真实小额支付闭环：
- 需要生产可用邮箱与真实支付回归凭据。
