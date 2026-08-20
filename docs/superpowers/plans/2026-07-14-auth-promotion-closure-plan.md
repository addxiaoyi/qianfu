# Authentication And Promotion Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and harden registration, password login, session handling, password recovery, platform binding, promotion claims, review, and one-time wallet rewards.

**Architecture:** Existing Express auth and promo routes remain the public contract. Integration smoke scripts create disposable users and assert database-backed state transitions; promo reward issuance becomes idempotent inside a single database transaction.

**Tech Stack:** Express, Prisma, MySQL, Vitest, Supertest, React, Playwright, CSRF cookies, JWT/session cookies

---

### Task 1: Replace mock-only auth evidence with real-route tests

**Files:**
- Create: `tests/integration/auth-closure.test.ts`
- Modify: `scripts/smoke-auth-register-mail.ts`
- Test: `qianfu-liandeng/tests/e2e/auth.spec.ts`

- [ ] **Step 1: Add failing real-route cases**

Assert CSRF acquisition, unique registration, duplicate email/username rejection, login by username and email, wrong-password rejection, logout, session revocation, forgot-password non-enumeration, reset token one-time use, and production cookie flags.

```ts
expect(setCookie).toContain('HttpOnly');
expect(setCookie).toContain('Secure');
expect(setCookie).toContain('SameSite=Strict');
```

- [ ] **Step 2: Run real auth tests**

Run: `npx vitest run tests/integration/auth-closure.test.ts`

Expected: failures identify contract gaps in `server/routes/auth.ts`, `server/controllers/authController.ts`, `server/controllers/registerController.ts`, or `server/controllers/authCodeController.ts`.

- [ ] **Step 3: Fix only observed contract failures**

Validate all request bodies at the route boundary, keep generic login/reset errors, rotate session identifiers on login, hash reset tokens at rest, and invalidate used/expired reset tokens.

- [ ] **Step 4: Run browser auth flows**

Run: `npm run smoke:browser-auth:nonpay`

Expected: desktop and mobile registration/login pages complete with no console errors.

### Task 2: Enforce promotion authorization

**Files:**
- Modify: `server/routes/promo.ts`
- Modify: `server/controllers/promoController.ts`
- Create: `tests/integration/promo-authorization.test.ts`

- [ ] **Step 1: Prove non-admin mutation is denied**

```ts
await expectStatus(user, 'POST', '/api/v1/promo/tasks', 403);
await expectStatus(user, 'POST', '/api/v1/promo/claims/1/approve', 403);
await expectStatus(user, 'GET', '/api/v1/promo/admin/summary', 403);
```

- [ ] **Step 2: Add route-level admin middleware**

Use the existing permission/role middleware for task creation, update, publish, pause, disable, claim detail, approval, rejection, and admin summary. Keep user task/binding/claim endpoints authenticated but non-admin.

- [ ] **Step 3: Validate IDs and bodies with Zod schemas**

Create explicit schemas for platform bindings, task mutations, proof data, audit remarks, and numeric route parameters; reject unknown or oversized proof objects.

### Task 3: Make claim and reward issuance idempotent

**Files:**
- Modify: `server/controllers/promoController.ts`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.mysql.prisma`
- Modify: `prisma/schema.postgresql.prisma`
- Create: `prisma/migrations/20260714_promo_claim_idempotency/migration.sql`
- Create: `tests/integration/promo-reward-idempotency.test.ts`

- [ ] **Step 1: Write concurrent claim tests**

Send two claims for the same `(user_id, task_id)` and assert one claim, one wallet transaction, and one balance increment.

- [ ] **Step 2: Add database uniqueness**

Add a unique constraint for the claim identity and a unique reward reference for `promoWalletTransaction`.

- [ ] **Step 3: Use conditional state transitions**

Approval must update only claims not already `REWARDED`; if the conditional update count is zero, return the existing rewarded record without another wallet increment.

- [ ] **Step 4: Verify rollback safety**

Force wallet transaction creation to fail and assert claim status and wallet balance remain unchanged.

### Task 4: Complete the user and admin promotion journey

**Files:**
- Modify: `qianfu-liandeng/src/pages/PromotionLanding.tsx`
- Modify: `qianfu-liandeng/src/pages/admin/AdminPromoTasks.tsx`
- Modify: `qianfu-liandeng/src/pages/admin/AdminPromoClaims.tsx`
- Create: `qianfu-liandeng/tests/e2e/promotion-flow.spec.ts`

- [ ] **Step 1: Cover loading, empty, error, bound, claimed, pending, rejected, and rewarded states**

- [ ] **Step 2: Add a Playwright closed-loop test**

Admin creates and publishes a task; user binds an account and submits proof; admin approves; user sees `REWARDED`; wallet balance increases exactly once.

- [ ] **Step 3: Run the focused browser test**

Run: `npx playwright test qianfu-liandeng/tests/e2e/promotion-flow.spec.ts`

Expected: all steps pass with no page errors.

### Task 5: Run production auth/promo smoke

**Files:**
- Create: `scripts/smoke-auth-promo-closure.ts`
- Create: `output/prod-launch/auth-promo-closure.json`

- [ ] **Step 1: Use unique disposable accounts and record created IDs**

- [ ] **Step 2: Execute the full flow against `https://mc-u.top`**

- [ ] **Step 3: Clean up only records created by the smoke run**

- [ ] **Step 4: Fail the command on any WARN or FAIL result**

