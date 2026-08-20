# Level Rules Gameplay Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make level rules accurate and actionable from XP acquisition through unlock, permission enforcement, and visible user progress.

**Architecture:** Keep level thresholds, XP sources, and unlocks in `server/services/userLevelService.ts` as the single source of truth. Expose a read-only rules/progress endpoint through the existing user router, make authorization use effective level permissions, and make first-like XP idempotent with a database-backed event table. The frontend consumes that endpoint and links each action to a real workflow.

**Tech Stack:** Express, Prisma/PostgreSQL/SQLite schema parity, TypeScript, Vitest, React, React Router, Tailwind classes.

---

### Task 1: Lock the level contract with failing tests

**Files:**
- Create: `tests/unit/level-rules-gameplay.test.ts`
- Modify: `tests/unit/user-level-service.test.ts`

- [ ] **Step 1: Write failing tests**

Cover these behaviors with executable assertions:

```ts
it('returns the next unlock and XP source rules from one service contract', () => {
  const rules = getLevelRules();
  expect(rules.xpSources).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'checkin', xp: XP_CHECKIN, dailyLimit: 1 }),
    expect.objectContaining({ key: 'like', xp: XP_LIKE, firstOnly: true }),
    expect.objectContaining({ key: 'comment', xp: XP_COMMENT }),
  ]));
  expect(rules.unlocks).toEqual(expect.arrayContaining([
    expect.objectContaining({ level: 3, permission: 'rate_servers' }),
    expect.objectContaining({ level: 5, permission: 'comment_servers' }),
  ]));
  expect(getNextLevelUnlock(1)?.level).toBe(3);
});

it('uses level-granted permissions in middleware', () => {
  const user = makeUser({ role: 'USER', permissions: [], experience_points: xpAtLevel(3) });
  expect(getEffectivePermissions(user)).toContain('rate_servers');
});

it('does not grant like XP after the first like event for the same user and server', async () => {
  const first = await grantFirstLikeExperience(7, 42);
  const second = await grantFirstLikeExperience(7, 42);
  expect(first.added).toBe(XP_LIKE);
  expect(second.added).toBe(0);
});
```

- [ ] **Step 2: Run the focused tests and verify the expected failures**

Run `npx vitest run tests/unit/level-rules-gameplay.test.ts tests/unit/user-level-service.test.ts`. Expected failures must identify missing rules contract, missing first-like idempotency, or middleware not seeing the level permission.

### Task 2: Implement the backend rules contract and permission closure

**Files:**
- Modify: `server/services/userLevelService.ts`
- Modify: `server/middleware/auth.ts`
- Modify: `server/controllers/userLevelController.ts`
- Modify: `server/routes/user.ts`

- [ ] **Step 1: Add typed rules and progress helpers**

Export typed `xpSources`, `unlocks`, `getLevelRules()`, `getNextLevelUnlock(level)`, and `getLevelSnapshot(user)` from the level service. Use the existing XP constants and threshold functions; the snapshot must return `level`, `totalXp`, `xpIntoLevel`, `xpForNext`, `progress`, `isMax`, `nextUnlock`, and `grantedPermissions`.

- [ ] **Step 2: Make `hasPermission` use the effective permission set**

Import `getEffectivePermissions` and replace direct `parseAuthorizedPermissions` use in `hasPermission` with `getEffectivePermissions(req.user)`. Keep administrative-role bypass and known-permission validation unchanged.

- [ ] **Step 3: Add `GET /api/user/level/rules`**

Use `authenticateOptional`; return public rules for guests and include a `me` snapshot only when a verified user is attached. Return the project response wrapper used by existing controllers, with `ok: true`, and never expose wallet data or private profile fields.

- [ ] **Step 4: Re-run the focused tests**

Run the same Vitest command and expect all new rules and permission tests to pass.

### Task 3: Make first-like XP idempotent

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.postgresql.prisma`
- Modify: `prisma/schema.mysql.prisma`
- Create: `prisma/migrations/20260810120000_level_xp_events/migration.sql`
- Modify: `server/services/userLevelService.ts`
- Modify: `server/controllers/serverSocialController.ts`

- [ ] **Step 1: Add the unique XP event model and migration**

Add `UserExperienceEvent` with `user_id`, `event_key`, `source_id`, `amount`, and `created_at`, plus a unique constraint on `(user_id, event_key, source_id)` and a user index. The migration must create the table and unique index for the PostgreSQL production schema; keep the SQLite/MySQL schema files structurally equivalent.

- [ ] **Step 2: Implement an idempotent first-like grant**

Add `grantFirstLikeExperience(userId, serverId)` using a transaction: create the unique event, increment XP only when the insert succeeds, and return an `ApplyXpResult` with `added: 0` for duplicate events. Treat a unique constraint collision as an expected duplicate, not as a silent error.

- [ ] **Step 3: Call it only when a like is newly created**

In `toggleServerLike`, retain the existing like toggle response but call `grantFirstLikeExperience` after a new like is created. Never grant XP when the like is removed or re-created after removal.

- [ ] **Step 4: Run focused backend tests and TypeScript checks**

Run `npx vitest run tests/unit/level-rules-gameplay.test.ts tests/unit/user-level-service.test.ts tests/unit/auth-owner-authorization.test.ts`, then `npm run typecheck` and the server TypeScript check used by this repository.

### Task 4: Replace static rules page with the real gameplay loop

**Files:**
- Modify: `qianfu-liandeng/src/pages/LevelRules.tsx`
- Modify: `qianfu-liandeng/src/types/api.ts`
- Create or modify: `qianfu-liandeng/src/api/levelRulesApi.ts`
- Test: `qianfu-liandeng/src/pages/LevelRules.test.tsx`

- [ ] **Step 1: Add the failing component contract test**

Assert that the page renders loading/error/guest states, renders `me` progress when returned, and contains links for `/dashboard`, `/servers`, and `/dashboard/servers` actions.

- [ ] **Step 2: Implement the page against the endpoint**

Use the existing API request/response helpers and auth store. Show current level, total XP, current-level progress, next unlock, XP source rows, unlock rows, and a compact action row. Keep the page readable on mobile and use icon buttons only where text is not required; no native dropdown is needed.

- [ ] **Step 3: Run frontend tests and build**

Run `npx vitest run qianfu-liandeng/src/pages/LevelRules.test.tsx` and the frontend typecheck/build command. Fix loading, empty, and error paths before integration.

### Task 5: Integration verification and production release

**Files:**
- Modify only release metadata or generated output required by the existing deployment script.

- [ ] **Step 1: Run the complete focused quality gate**

Run the level tests, related auth/social tests, root TypeScript, server TypeScript, and frontend production build. Record failed checks separately from environment-only Prisma engine lock failures.

- [ ] **Step 2: Build a new release ID and run preflight**

Use a new release id such as `20260810-level-loop-01`, run the existing Baota deployment script with `--preflight-only`, and verify the bundle contains the new endpoint and frontend manifest.

- [ ] **Step 3: Publish and verify**

Publish the staged release with the same id, then verify PM2 `qianfu-api`, `/healthz`, public rules response, authenticated level snapshot, and an actual rate/comment permission path. Do not execute a real user check-in during verification.

---

**Self-review:** The plan covers the rule source of truth, permission enforcement, XP anti-abuse, public/authenticated rules rendering, actionable links, tests, and deployment verification. No unrelated payment, upload, or admin-page changes are included.
