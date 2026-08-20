# 个人备案功能收口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在个人备案模式下关闭支付、钱包、商城交易和现金推广能力，移除前端入口并让后端接口 fail closed，同时保留服务器展示、账号、新闻、审核和工单基础能力。

**Architecture:** 以“未挂载即不可访问”为主：前端移除商业页面和导航，后端不再注册支付/钱包/商城/推广路由；历史订单、流水和审计数据保留在数据库中，不提供新的交易写入。条款和测试同步改为非交易站点表述，避免只隐藏 UI 而保留可调用接口。

**Tech Stack:** React 19 + React Router + TypeScript + Express + Vitest + Prisma。

---

### Task 1: Lock the closure boundary

**Files:**
- Modify: `tests/unit/personal-filing-feature-closure.test.ts`
- Modify: `docs/superpowers/plans/2026-08-10-personal-filing-feature-closure.md`

- [x] **Step 1: Write failing contract tests**

  Assert that the frontend route table and navigation no longer expose payment, wallet, marketplace, or promotion paths, and that the backend route registry no longer mounts their route modules.

- [x] **Step 2: Run the focused test and confirm RED**

  Run `npm run test:run -- tests/unit/personal-filing-feature-closure.test.ts`.

  Expected: failure because the current app still imports and registers the commercial routes.

### Task 2: Remove commercial frontend surfaces

**Files:**
- Modify: `qianfu-liandeng/src/App.tsx`
- Modify: `qianfu-liandeng/src/components/layout/Navbar.tsx`
- Modify: `qianfu-liandeng/src/pages/Profile.tsx`
- Modify: `qianfu-liandeng/src/pages/Billing.tsx`
- Modify: `qianfu-liandeng/src/pages/ServerEditor.tsx`
- Modify: `qianfu-liandeng/src/pages/Terms.tsx`

- [x] **Step 1: Remove imports/routes for payment, wallet, marketplace, and promotion pages**
- [x] **Step 2: Remove recharge, wallet balance, paid listing, shop, and promotion links**
- [x] **Step 3: Keep direct legacy paths on a clear disabled page or not-found response**
- [x] **Step 4: Update user-facing legal copy to describe the non-transactional service**

### Task 3: Close commercial backend routes

**Files:**
- Modify: `server/routes/index.ts`
- Modify: `server/routes/payment.ts`
- Modify: `server/routes/wallet.ts`
- Modify: `server/routes/promo.ts`
- Modify: `server/routes/paymentProjects.ts`
- Modify: `server/routes/paymentPersonalQr.ts`
- Modify: `server/routes/paymentXpayBridge.ts`
- Modify: `server/core/controller/QianFuController.ts`

- [x] **Step 1: Remove route registration for payment, wallet, promo, marketplace payment, and payment admin modules**
- [x] **Step 2: Ensure legacy commercial endpoints return the standard disabled-feature response when retained for compatibility**
- [x] **Step 3: Reject commercial listing plans and balance deductions at the server boundary**

### Task 4: Verify and document the closed surface

**Files:**
- Modify: `tests/unit/personal-filing-feature-closure.test.ts`
- Create: `docs/compliance/personal-filing-service-boundary.md`

- [x] **Step 1: Document enabled and disabled capabilities without claiming formal regulatory approval**
- [x] **Step 2: Run focused tests, `npm run typecheck`, and `npm --prefix qianfu-liandeng run build`**
- [x] **Step 3: Review the diff to ensure historical data and unrelated dirty-worktree changes were preserved**
