# XPay Frontend Liandeng Refactor

## Goal
- Rebuild XPay frontend pages around the QianFu Liandeng visual system.
- Replace mixed dark luxury / legacy bootstrap pages with one consistent light editorial theme.
- Preserve existing endpoint bindings, DOM ids, and core interaction scripts where possible.

## Scope
- Admin pages:
  - `admin-login.html`
  - `admin-dashboard.html`
- StarMC tenant pages:
  - `starmc-pay.html`
  - `starmc-settings.html`
  - `starmc-confirm.html`
- Shared status pages:
  - `pay-success.html`
  - `pay-fail.html`

## Progress
- 已完成共享主题落地：
  - `xpay-code/src/main/resources/static/assets/css/liandeng-theme.css`
- 已切换主后台、支付页、确认页、成功失败页、统计页、移动端页面到联灯风格。
- 2026-05-15 收尾补齐的边缘模板：
  - `email-admin.html`
  - `email-fake.html`
  - `o2c.html`
  - `sendwxcode.html`
  - `sendxboot.html`
  - `swagger-ui.html`（保守覆层）
  - `xboot.html`
- 改造原则：
  - 邮件模板允许重做版式，但不改 Thymeleaf 变量语义。
  - Swagger / OAuth / 跳转页仅做轻量视觉包裹，不碰核心脚本。

## Design baseline
- Source of truth:
  - `qianfu-liandeng/src/index.css`
  - `qianfu-liandeng/src/pages/Home.tsx`
- Required traits:
  - bright background
  - black dominant typography
  - rounded large cards
  - editorial uppercase italic headings
  - restrained accent use
  - desktop/mobile consistency

## Implementation strategy
- Introduce shared stylesheet under XPay static assets.
- Move templates onto shared layout primitives instead of page-local large inline CSS.
- Keep JS behavior stable by preserving important ids and API paths.

## Guardrails
- No secrets hardcoded into templates.
- No backend contract changes in this pass.
- Avoid changing payment flow semantics while reworking visuals.
