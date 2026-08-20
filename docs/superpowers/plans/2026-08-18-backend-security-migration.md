# Backend Security Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing production boundary immediately and introduce a non-Node backend migration path without breaking the current API contract.

**Architecture:** Keep the current service as the compatibility implementation while a Go edge service owns request validation, rate limits, OAuth PKCE initiation/callback validation, and private-network routing. Migrate route groups behind contract tests, then remove the Node implementation only after parity and production canary checks pass.

**Tech Stack:** Go 1.24, chi, Redis, PostgreSQL/MySQL, existing Express/Prisma compatibility service during migration, React/Vite frontend.

---

### Task 1: OAuth and WAF boundary hardening

**Files:**
- Modify: `server/controllers/githubAuthController.ts`
- Modify: `server/middleware/waf.ts`
- Modify: `server/bootstrap/middlewareLayers.ts`
- Test: `tests/unit/github-oauth-pkce.test.ts`
- Test: `tests/unit/waf-route-policy.test.ts`

- [ ] Add a one-time PKCE verifier stored with the OAuth state and require the same verifier during token exchange.
- [ ] Make WAF route-aware: use endpoint rate limits for auth/write routes, skip generic body inspection for validated JSON APIs, and never block normal forwarded headers supplied by the trusted proxy.
- [ ] Add regression tests for PKCE mismatch, PKCE replay, registration, server writes, and safe forwarded headers.

### Task 2: Database and upload exposure

**Files:**
- Modify: `server/bootstrap/proxyAndStatic.ts`
- Modify: `server/config/productionEnvPolicy.ts`
- Modify: `deploy/nginx/mc-u.top.conf.example`
- Modify: `.env.example`
- Test: `tests/unit/private-storage-boundary.test.ts`

- [ ] Remove direct public serving of private database/config paths and require uploads to pass through a validated public asset route.
- [ ] Fail production startup when database files or mutable upload roots are under the public web root.
- [ ] Add Nginx deny rules for database, environment, source-map, and backup extensions.

### Task 3: Server lifecycle, gallery, and mail reliability

**Files:**
- Modify: `server/routes/servers.ts`
- Modify: `server/controllers/servers/crud.ts`
- Modify: `server/routes/upload.ts`
- Modify: `server/controllers/authCodeController.ts`
- Test: `tests/unit/server-lifecycle-contract.test.ts`
- Test: `tests/unit/auth-code-delivery.test.ts`

- [ ] Ensure owner edits preserve the original server address only when the request omits it, while explicit address changes go through review and connectivity validation.
- [ ] Make delete and image cleanup transactional/idempotent, with a recoverable storage cleanup job.
- [ ] Add bounded mail timeouts, retry classification, and a deterministic pending state so the UI can resend without becoming stuck.

### Task 4: Go migration skeleton and frontend hardening

**Files:**
- Create: `services/edge-go/go.mod`
- Create: `services/edge-go/cmd/edge/main.go`
- Create: `services/edge-go/internal/security/policy.go`
- Create: `services/edge-go/internal/oauth/pkce.go`
- Modify: `qianfu-liandeng/src/components/ui/SeoHead.tsx`
- Modify: `qianfu-liandeng/src/components/ui/PageSeo.tsx`

- [ ] Add a health-checked Go service with private listen address, structured errors, security headers, and route-level rate limiting.
- [ ] Route OAuth and public API canary traffic through the Go service while the compatibility backend remains available internally.
- [ ] Ensure JSON-LD uses `search_term_string`, verify the default social image URL, and reduce keyword metadata to a short relevant set.

### Task 5: Verification and rollout

- [ ] Run focused unit tests, TypeScript checks, Go tests, and frontend production build.
- [ ] Run authenticated and unauthenticated API smoke tests, upload access checks, OAuth PKCE checks, and mobile browser checks.
- [ ] Deploy behind a reversible canary, verify health and public resources, then document rollback.
