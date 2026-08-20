# Promotion Task Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/promotion` with a secure manual-review task center that supports conflict-safe platform bindings, multiple idempotent claims, concurrency-safe limits, and exactly-once administrator rewards.

**Architecture:** Keep Express routes thin and move promotion validation and transaction rules into focused service modules. Persist claim sequence and idempotency in all Prisma targets, expose separate user-safe and administrator read models, and build the React page from typed API and focused state components.

**Tech Stack:** TypeScript, Express 5, Prisma 5, SQLite/MySQL/PostgreSQL, React 18, TanStack Query, Zod, Vitest, Testing Library, Playwright.

---

## File Map

- Create `server/services/promoClaimService.ts`: claim validation, serializable retry, capacity checks, pending claim creation.
- Create `server/services/promoRewardService.ts`: approval and rejection state transitions with atomic wallet credit.
- Create `server/schemas/promoSchemas.ts`: allowlisted platform, binding, proof, idempotency, and review validation.
- Modify `server/controllers/promoController.ts`: delegate writes and return user-safe/admin-safe read models.
- Modify `server/routes/promo.ts`: separate `/tasks/:id` from `/admin/tasks/:id`; add `/admin/claims` and mutation rate limits.
- Modify `prisma/schema.prisma`, `prisma/schema.mysql.prisma`, `prisma/schema.postgresql.prisma`: add claim sequence/idempotency constraints.
- Create `prisma/migrations/20260714192000_promo_claim_sequences/migration.sql`: SQLite data migration.
- Modify `scripts/prepare-postgres-prisma-schema.mjs`: retain generated PostgreSQL/MySQL schema parity from the canonical schema.
- Use `scripts/mysql-schema-reconcile.mjs` during a MySQL rollout to generate reviewed provider-specific DDL; production currently uses the SQLite migration path.
- Create `qianfu-liandeng/src/api/promotionApi.ts`: promotion request and response types.
- Create `qianfu-liandeng/src/pages/promotion/PromotionTaskCenter.tsx`: page query composition and tabs.
- Create `qianfu-liandeng/src/pages/promotion/PromotionSummary.tsx`: summary metrics.
- Create `qianfu-liandeng/src/pages/promotion/PromotionBindings.tsx`: binding display and conflict-safe form.
- Create `qianfu-liandeng/src/pages/promotion/PromotionTaskList.tsx`: task states and actions.
- Create `qianfu-liandeng/src/pages/promotion/PromotionClaimDialog.tsx`: bounded proof form and stable idempotency key.
- Create `qianfu-liandeng/src/pages/promotion/PromotionClaimHistory.tsx`: paginated claim history.
- Modify `qianfu-liandeng/src/pages/PromotionLanding.tsx`: export the task center instead of marketing content.
- Modify `qianfu-liandeng/src/pages/admin/AdminPromoClaims.tsx`: consume `/promo/admin/claims` with typed pagination.
- Modify `qianfu-liandeng/src/App.tsx`: require authentication for `/promotion` and administrator authorization for admin promotion routes.
- Extend `tests/unit/promo-claim-capacity.test.ts`, `tests/unit/promo-reward-policy.test.ts`, `tests/unit/promo-route-security.test.ts` and add focused integration/component tests.

### Task 1: Cross-Database Claim Sequence Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.mysql.prisma`
- Modify: `prisma/schema.postgresql.prisma`
- Create: `prisma/migrations/20260714192000_promo_claim_sequences/migration.sql`
- Verify: `scripts/prepare-postgres-prisma-schema.mjs`
- Verify: `scripts/mysql-schema-reconcile.mjs`
- Test: `tests/unit/prisma-migration-parity.test.ts`
- Test: `tests/unit/promo-reward-policy.test.ts`

- [ ] **Step 1: Write the failing schema contract test**

Assert each deployment schema contains:

```ts
expect(schema).toContain('claim_no          Int')
expect(schema).toContain('idempotency_key   String')
expect(schema).toContain('@@unique([user_id, task_id, claim_no])')
expect(schema).toContain('@@unique([user_id, task_id, idempotency_key])')
expect(schema).not.toContain('@@unique([user_id, task_id])')
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- tests/unit/promo-reward-policy.test.ts tests/unit/prisma-migration-parity.test.ts`

Expected: FAIL because sequence/idempotency fields and migrations do not exist.

- [ ] **Step 3: Add the schema fields and migrations**

Use this Prisma contract in all three schemas:

```prisma
claim_no        Int
idempotency_key String

@@unique([user_id, task_id, claim_no])
@@unique([user_id, task_id, idempotency_key])
```

The SQLite migration must abort when legacy `(user_id, task_id)` duplicates exist, backfill `claim_no = 1`, copy `claim_request_no` into `idempotency_key`, replace the old unique constraint, and preserve all rows and foreign keys. Regenerate the PostgreSQL/MySQL deployment schemas from the canonical schema; provider DDL is produced and reviewed with Prisma diff at deployment time instead of inventing migration directories that this repository does not use.

- [ ] **Step 4: Verify GREEN and schema validity**

Run:

```powershell
npm run test:run -- tests/unit/promo-reward-policy.test.ts tests/unit/prisma-migration-parity.test.ts
npx prisma validate --schema prisma/schema.prisma
npx prisma validate --schema prisma/schema.mysql.prisma
npx prisma validate --schema prisma/schema.postgresql.prisma
npm run db:mysql:reconcile # only in a configured MySQL deployment environment
```

Expected: all tests pass and all schemas report valid. The MySQL reconcile command is required only when its deployment URL is configured and must produce reviewed forward/reverse SQL without exposing credentials.

### Task 2: Boundary Validation and Binding Ownership

**Files:**
- Create: `server/schemas/promoSchemas.ts`
- Modify: `server/controllers/promoController.ts`
- Create: `tests/unit/promo-binding-security.test.ts`

- [ ] **Step 1: Write failing binding and validation tests**

Cover supported platform normalization, maximum lengths, HTML rejection, unsupported proof keys, and the ownership rule:

```ts
await expect(bindPlatformAccountForUser(db, 22, {
  platform: 'bilibili',
  platformUserId: 'already-owned',
})).rejects.toMatchObject({ statusCode: 409 })
expect(ownerAfter.user_id).toBe(11)
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- tests/unit/promo-binding-security.test.ts`

Expected: FAIL because allowlisted schemas and ownership-preserving binding do not exist.

- [ ] **Step 3: Implement strict schemas and owner-targeted upsert**

Define `SUPPORTED_PROMO_PLATFORMS` as a readonly allowlist. Parse unknown input with Zod; reject tokens, cookies, passwords, HTML, extra proof keys, empty IDs, and overlong values. Query `(platform, platform_user_id)` first and return `409` when owned by another user, then upsert only by `(user_id, platform)`.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- tests/unit/promo-binding-security.test.ts`

Expected: all binding and validation tests pass.

### Task 3: Pending, Multiple, Idempotent Claim Submission

**Files:**
- Create: `server/services/promoClaimService.ts`
- Modify: `server/controllers/promoController.ts`
- Extend: `tests/unit/promo-claim-capacity.test.ts`
- Create: `tests/integration/promo-claim-submission.test.ts`

- [ ] **Step 1: Write failing claim transaction tests**

Cover claim 1 and 2 with distinct keys, replay of key 2 returning the same claim, claim 3 conflict, no wallet mutation, and concurrent daily/total limit enforcement. Assert every creation has:

```ts
expect(claim).toMatchObject({
  claim_status: 'PENDING',
  reward_status: 'PENDING',
  claim_no: 1,
  idempotency_key: key,
})
expect(walletAfter.balance).toBe(walletBefore.balance)
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- tests/integration/promo-claim-submission.test.ts tests/unit/promo-claim-capacity.test.ts`

Expected: FAIL because existing submission returns the first task claim and may reward immediately.

- [ ] **Step 3: Implement the serializable claim service**

Require a 16-128 character `Idempotency-Key`. Inside a serializable transaction: replay by `(user_id, task_id, idempotency_key)`, load enabled/time-valid task and active binding, count user/day/total claims, set `claim_no = userCount + 1`, create only `PENDING/PENDING`, and create a `MANUAL/PENDING` verification log without a pass result. Retry only Prisma `P2002` and `P2034` up to three attempts.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- tests/integration/promo-claim-submission.test.ts tests/unit/promo-claim-capacity.test.ts`

Expected: all submission tests pass with one row per idempotency key.

### Task 4: Exactly-Once Approval and Safe Rejection

**Files:**
- Create: `server/services/promoRewardService.ts`
- Modify: `server/controllers/promoController.ts`
- Extend: `tests/unit/promo-reward-policy.test.ts`
- Create: `tests/integration/promo-review.test.ts`

- [ ] **Step 1: Write failing reward transition tests**

Assert one approval creates one uniquely referenced wallet transaction, increments once, and repeated/concurrent approval returns the rewarded claim. Assert blank rejection notes fail with `400` and rewarded claims cannot be rejected.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- tests/integration/promo-review.test.ts tests/unit/promo-reward-policy.test.ts`

Expected: FAIL because rejection defaults its note and leaves `reward_status=PENDING`.

- [ ] **Step 3: Implement atomic review transitions**

Guard approval from `PENDING` to `REWARDING`, upsert wallet, increment balance, insert the unique claim reference, and finish `REWARDED/REWARDED` in one transaction. Treat an already rewarded claim as idempotent. Reject only a non-rewarded pending claim with a trimmed note and store `REJECTED/REJECTED`.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- tests/integration/promo-review.test.ts tests/unit/promo-reward-policy.test.ts`

Expected: all review tests pass and wallet balance changes exactly once.

### Task 5: User-Safe and Administrator API Separation

**Files:**
- Modify: `server/controllers/promoController.ts`
- Modify: `server/routes/promo.ts`
- Extend: `tests/unit/promo-route-security.test.ts`
- Create: `tests/integration/promo-read-privacy.test.ts`

- [ ] **Step 1: Write failing privacy and route tests**

Assert `GET /tasks/:id` never returns `claims`, `user`, `auditLogs`, `verify_detail`, or another user's data. Assert `/admin/tasks/:id` and `/admin/claims` reject non-admin users and return review data to admins.

- [ ] **Step 2: Verify RED**

Run: `npm run test:run -- tests/unit/promo-route-security.test.ts tests/integration/promo-read-privacy.test.ts`

Expected: FAIL because the current user detail includes all claims, users, and audit logs.

- [ ] **Step 3: Implement separate projections and pagination**

Return visible task fields, binding state, `userClaimCount`, remaining capacities, and latest caller claim from user endpoints. Add admin-only `getAdminPromoTask` and `listAdminPromoClaims` controllers. Keep authentication globally, require `adminOnly` on every `/admin/*` route, CSRF on every mutation, and dedicated rate limiters on binding and claim submission.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:run -- tests/unit/promo-route-security.test.ts tests/integration/promo-read-privacy.test.ts`

Expected: route and privacy tests pass.

### Task 6: Typed Promotion Task Center

**Files:**
- Create: `qianfu-liandeng/src/api/promotionApi.ts`
- Create: `qianfu-liandeng/src/pages/promotion/PromotionTaskCenter.tsx`
- Create: `qianfu-liandeng/src/pages/promotion/PromotionSummary.tsx`
- Create: `qianfu-liandeng/src/pages/promotion/PromotionBindings.tsx`
- Create: `qianfu-liandeng/src/pages/promotion/PromotionTaskList.tsx`
- Create: `qianfu-liandeng/src/pages/promotion/PromotionClaimDialog.tsx`
- Create: `qianfu-liandeng/src/pages/promotion/PromotionClaimHistory.tsx`
- Modify: `qianfu-liandeng/src/pages/PromotionLanding.tsx`
- Modify: `qianfu-liandeng/src/App.tsx`
- Create: `qianfu-liandeng/src/pages/promotion/PromotionTaskCenter.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover loading, empty, error, unauthenticated, unbound, pending, rewarded, and rejected states. Verify duplicate submit clicks send one request with one stable idempotency key and successful submission refreshes task and history queries.

- [ ] **Step 2: Verify RED**

Run: `npm --prefix qianfu-liandeng test -- --run src/pages/promotion/PromotionTaskCenter.test.tsx`

Expected: FAIL because the task center modules do not exist.

- [ ] **Step 3: Build the focused task-center components**

Use typed query hooks and the existing request client. Render a compact summary, task/history tabs, binding controls, task rows, and a manual-review claim dialog. Generate one UUID when the dialog opens and reuse it through retries; disable submit while pending. Keep desktop two-column and mobile one-column layouts with explicit loading, empty, and error surfaces.

- [ ] **Step 4: Verify GREEN**

Run: `npm --prefix qianfu-liandeng test -- --run src/pages/promotion/PromotionTaskCenter.test.tsx`

Expected: all component state and duplicate-submit tests pass.

### Task 7: Administrator Queue Correction

**Files:**
- Modify: `qianfu-liandeng/src/pages/admin/AdminPromoClaims.tsx`
- Create: `qianfu-liandeng/src/pages/admin/AdminPromoClaims.test.tsx`
- Modify: `qianfu-liandeng/src/App.tsx`

- [ ] **Step 1: Write the failing administrator endpoint test**

Render the page and assert its query requests `/promo/admin/claims`, supports status/page filters, and never requests `/promo/claims/me`.

- [ ] **Step 2: Verify RED**

Run: `npm --prefix qianfu-liandeng test -- --run src/pages/admin/AdminPromoClaims.test.tsx`

Expected: FAIL because the page currently uses the signed-in user's claim endpoint.

- [ ] **Step 3: Switch to the admin queue and enforce route authorization**

Use the typed paginated admin endpoint, retain explicit loading/error/empty states, refresh after approve/reject, and wrap admin promotion routes with the repository's administrator guard.

- [ ] **Step 4: Verify GREEN**

Run: `npm --prefix qianfu-liandeng test -- --run src/pages/admin/AdminPromoClaims.test.tsx`

Expected: administrator queue tests pass.

### Task 8: Full Verification and Production Rollout

**Files:**
- Create: `scripts/smoke-promotion-task-center.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the isolated smoke contract before the script**

Create a test that requires a unique prefix, records initial wallet balance, binds a fresh identity, submits two distinct keys, replays one key, approves once, repeats approval, checks privacy and limits, and deletes wallet transaction, verification log, claims, binding, wallet, task, and user in foreign-key order.

- [ ] **Step 2: Verify the smoke contract fails**

Run: `npm run test:run -- tests/unit/promo-smoke-contract.test.ts`

Expected: FAIL because the smoke script and package command do not exist.

- [ ] **Step 3: Implement the smoke runner and command**

Add `smoke:promotion` to `package.json`. Fail fast on every unexpected status, verify cleanup counts are zero, and never print cookies, CSRF tokens, credentials, proof text, or secrets.

- [ ] **Step 4: Run local quality gates**

Run:

```powershell
npm run test:run -- tests/unit/promo-claim-capacity.test.ts tests/unit/promo-reward-policy.test.ts tests/unit/promo-route-security.test.ts tests/unit/promo-binding-security.test.ts tests/integration/promo-claim-submission.test.ts tests/integration/promo-review.test.ts tests/integration/promo-read-privacy.test.ts
npm run typecheck:server
npm --prefix qianfu-liandeng run typecheck
npm run lint
npm run server:build
npm run build
npm run test:run
```

Expected: targeted tests, both type checks, build steps, and the full suite pass; lint has zero errors and only documented baseline warnings.

- [ ] **Step 5: Deploy with rollback and run production smoke**

Create a timestamped release, back up the SQLite database, apply the migration, build, atomically repoint `current`, reload `qianfu-api`, and verify `/health`, `/ready`, and frontend manifests. Run `npm run smoke:promotion -- --base-url https://mc-u.top` through the authorized Alibaba Cloud channel, then confirm cleanup counts are zero and `PRAGMA quick_check` returns `ok`.

- [ ] **Step 6: Verify responsive UI and report bounded evidence**

Use Playwright at desktop and mobile viewports to confirm no overlap and all controls remain visible. Report exact test/build/smoke results, deployed release path, and remaining untested provider/platform integration gaps; do not claim zero bugs or vulnerabilities.

## Self-Review

- Spec coverage: schema parity, ownership conflicts, multiple claims, idempotency, capacity concurrency, pending-only submission, exactly-once reward, rejection rules, read privacy, admin queue, responsive states, deployment, rollback, and cleanup all map to tasks above.
- Scope boundary: payment-to-marketplace completion remains a separate design because it is an independent transaction domain.
- Placeholder scan: no TBD/TODO or unspecified implementation step remains.
- Type consistency: `claim_no`, `idempotency_key`, `Idempotency-Key`, `PENDING`, `REWARDING`, `REWARDED`, and `REJECTED` are used consistently across schema, API, tests, and UI.
