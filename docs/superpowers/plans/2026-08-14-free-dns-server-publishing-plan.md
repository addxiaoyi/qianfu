# 免费服务器域名配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在服务器审核通过后，为用户申请的管理员域名池域名自动配置阿里云 DNS 或 Cloudflare 解析。

**Architecture:** 新增域名池和服务器域名绑定两张表；通过 provider adapter 隔离阿里云与 Cloudflare；服务器审核通过后创建幂等 provision task，失败可由管理员重试。发布表单只提交申请，前端显示待审核和解析状态。

**Tech Stack:** TypeScript, Express, Prisma, PostgreSQL/SQLite migrations, React, Vitest, existing auth/CSRF/permission middleware.

---

### Task 1: Add failing domain lifecycle contract tests

**Files:**
- Create: `tests/unit/server-domain-binding-feature-contract.test.ts`
- Test: `tests/unit/server-domain-binding-feature-contract.test.ts`

- [ ] **Step 1: Write failing tests** for domain validation, no provider call before approval, approval provisioning, provider failure retry, and ownership isolation.
- [ ] **Step 2: Run `npx vitest run --maxWorkers=1 --pool=threads --no-file-parallelism tests/unit/server-domain-binding-feature-contract.test.ts`** and verify it fails because the domain service and provider interface do not exist.

### Task 2: Add schema and migrations

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.postgresql.prisma`
- Create: `prisma/migrations/20260814100000_server_domain_bindings/migration.sql`
- Create: `prisma/migrations/20260814100000_server_domain_bindings/migration.postgresql.sql`

- [ ] **Step 1:** Add `DnsDomainPool` and `ServerDomainBinding`, unique domain names, provider record ids, lifecycle status, and user/server relations.
- [ ] **Step 2:** Add SQLite and PostgreSQL migrations with foreign keys and indexes.
- [ ] **Step 3:** Run both Prisma schema validation commands.

### Task 3: Implement provider adapters and domain service

**Files:**
- Create: `server/services/dns/types.ts`
- Create: `server/services/dns/aliyunDnsProvider.ts`
- Create: `server/services/dns/cloudflareDnsProvider.ts`
- Create: `server/services/dns/dnsProviderRegistry.ts`
- Create: `server/services/serverDomainBindingService.ts`

- [ ] **Step 1:** Keep provider credentials in environment variables and expose only create/delete/query methods.
- [ ] **Step 2:** Validate prefix, zone, targets, record type, and Minecraft SRV target before provider calls.
- [ ] **Step 3:** Implement idempotent provisioning and cleanup with provider record ids.
- [ ] **Step 4:** Run Task 1 tests and confirm the lifecycle tests pass.

### Task 4: Integrate server create/review/delete lifecycle

**Files:**
- Modify: `server/utils/validation.ts`
- Modify: `server/controllers/servers/crud.ts`
- Modify: `server/controllers/reviewController.ts`
- Modify: `server/routes/servers.ts`
- Modify: `server/routes/review.ts`
- Modify: `server/routes/index.ts`
- Create: `server/routes/serverDomains.ts`
- Create: `server/controllers/serverDomainController.ts`

- [ ] **Step 1:** Accept an optional domain pool id and prefix during server create/update.
- [ ] **Step 2:** Create or update a pending binding without provider calls.
- [ ] **Step 3:** Queue provisioning only after `APPROVED`; make the hook path and batch review path use the same service.
- [ ] **Step 4:** Clean up owned records on server deletion and add user/admin status endpoints.

### Task 5: Add admin domain pool and DNS operations UI

**Files:**
- Create: `qianfu-liandeng/src/api/serverDomainApi.ts`
- Create: `qianfu-liandeng/src/pages/admin/AdminDomainPools.tsx`
- Modify: `qianfu-liandeng/src/pages/admin/AdminReview.tsx`
- Modify: `qianfu-liandeng/src/App.tsx`
- Modify: `qianfu-liandeng/src/components/ui/admin/AdminSidebar.tsx`

- [ ] **Step 1:** Add domain pool CRUD with provider and zone fields, never render secrets.
- [ ] **Step 2:** Add binding status, retry, revoke, and error display to review/admin surfaces.
- [ ] **Step 3:** Add route and permission gate.

### Task 6: Add user publish form and status UX

**Files:**
- Modify: `qianfu-liandeng/src/pages/ServerEditor.tsx`
- Modify: `qianfu-liandeng/src/pages/MyServers.tsx`
- Modify: `qianfu-liandeng/src/types/server.ts`

- [ ] **Step 1:** Load enabled domain pools and show optional prefix/domain preview.
- [ ] **Step 2:** Explain that DNS is configured only after server approval.
- [ ] **Step 3:** Show pending, active, failed, and revoked states with retry guidance.

### Task 7: Verify and package

**Files:**
- No source changes unless a verification failure requires a scoped fix.

- [ ] **Step 1:** Run targeted domain tests and existing server/review contract tests.
- [ ] **Step 2:** Run TypeScript server check, server build, frontend build, and migration validation.
- [ ] **Step 3:** Run `git diff --check` on scoped files and inspect generated release artifacts.
- [ ] **Step 4:** Do not deploy provider credentials or production DNS writes until production environment variables and an approved domain pool are confirmed.
