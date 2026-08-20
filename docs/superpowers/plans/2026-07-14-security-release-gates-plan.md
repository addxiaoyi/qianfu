# Security And Release Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce known dependency and application security findings to an accepted release baseline and produce reproducible evidence for the complete site.

**Architecture:** Security is enforced through dependency gates, route-level authorization and validation tests, host exposure checks, browser CSP/cookie checks, and a final requirement-by-requirement evidence manifest. A release is blocked by critical/high dependency findings, failed security tests, exposed private ports, or incomplete business smokes.

**Tech Stack:** npm audit, Vitest, Playwright, Nginx, TLS/OpenSSL, custom security checks, OWASP-style abuse cases

---

### Task 1: Repair test database schema drift

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: test database bootstrap scripts located by `rg -n 'prisma migrate|db push|dev.db' setupTests.ts tests scripts`
- Create: `tests/integration/schema-parity.test.ts`

- [ ] **Step 1: Reproduce `AuditLog.method` mismatch**

Run: `npx vitest run tests/unit/security-hardening.test.ts`

- [ ] **Step 2: Recreate the isolated test database from the authoritative schema**

- [ ] **Step 3: Add parity assertions for every Prisma model column used by security/audit middleware**

Expected: no runtime `column does not exist` errors.

### Task 2: Remove critical and high production dependency findings

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `qianfu-liandeng/package.json`
- Modify: `qianfu-liandeng/package-lock.json`
- Modify: `qianfu-liandeng/vite.config.ts`

- [ ] **Step 1: Save authoritative audit reports**

Run: `npm audit --omit=dev --json --registry=https://registry.npmjs.org`

Run: `npm --prefix qianfu-liandeng audit --omit=dev --json --registry=https://registry.npmjs.org`

Baseline: root 17 total with 2 critical/8 high; frontend 35 total with 16 critical/14 high.

- [ ] **Step 2: Remove the vulnerable `vite-plugin-imagemin` binary chain**

Delete the plugin from production dependencies and Vite configuration. Keep image optimization outside the runtime dependency graph; the existing assets must still build and render.

- [ ] **Step 3: Upgrade direct vulnerable runtime packages**

Update `multer`, `nodemailer`, `http-proxy-middleware`, `dompurify`, `markdown-it`, `morgan`, and affected transitive parents to patched compatible versions. Move build-only tools such as Vite and `concurrently` to `devDependencies` where appropriate.

- [ ] **Step 4: Reinstall with lockfile integrity**

Run `npm install --package-lock-only --registry=https://registry.npmjs.org`, then `npm ci --ignore-scripts` in a clean verification directory before allowing install scripts.

- [ ] **Step 5: Enforce audit gate**

Expected: zero critical and zero high findings for `--omit=dev`. Any remaining moderate/low item requires a documented reachability assessment.

### Task 3: Run application security tests

**Files:**
- Modify: `tests/unit/security-hardening.test.ts`
- Create: `tests/integration/security-boundaries.test.ts`
- Modify: `scripts/security-check.ts`

- [ ] **Step 1: Add abuse cases**

Cover SQL/NoSQL injection strings, stored/reflected XSS, path traversal, SSRF private ranges and DNS rebinding inputs, oversized JSON/uploads, CSRF absence, IDOR across users, brute-force limits, callback replay, and open redirects.

- [ ] **Step 2: Verify consistent error envelopes**

No production response may expose stack traces, filesystem paths, SQL text, secrets, or raw upstream bodies.

- [ ] **Step 3: Run the security suite**

Run: `npm run test:coverage:critical`

Run: `npx vitest run tests/integration/security-boundaries.test.ts tests/unit/payment-callback-security.test.ts`

Expected: zero failures.

### Task 4: Verify browser and edge security

**Files:**
- Create: `qianfu-liandeng/tests/e2e/security-headers.spec.ts`
- Create: `scripts/verify-tls-and-ports.mjs`

- [ ] **Step 1: Verify trusted TLS and redirects without `-k`**

- [ ] **Step 2: Assert HSTS, CSP, nosniff, frame policy, referrer policy, and secure cookie attributes**

- [ ] **Step 3: Assert private ports are unreachable from outside**

- [ ] **Step 4: Assert the browser console has no CSP, MIME, mixed-content, failed-chunk, or uncaught runtime errors on critical pages**

### Task 5: Run complete quality gates

**Files:**
- Create: `scripts/release-gate.ts`
- Create: `output/prod-launch/release-gate.json`

- [ ] **Step 1: Run static gates**

```bash
npm run typecheck
npm run typecheck:server
npm run lint
npm run build
npm run server:build
```

- [ ] **Step 2: Run unit and integration suites**

Run: `npm run test:run`

Expected: zero failed tests; skipped tests are listed and justified.

- [ ] **Step 3: Run production smokes**

Run auth, promotion, listing, marketplace, payment status, public browser audit, manifest hash, TLS, and port checks.

- [ ] **Step 4: Produce the evidence manifest**

The JSON report records command, timestamp, exit code, artifact path, target URL, and redacted summary for every explicit goal requirement.

### Task 6: Final completion audit

**Files:**
- Create: `docs/PRODUCTION-LAUNCH-AUDIT-2026-07-14.md`

- [ ] **Step 1: Map every user requirement to authoritative evidence**

- [ ] **Step 2: Mark unsupported absolute claims as unproven rather than passed**

- [ ] **Step 3: List only genuine remaining external dependencies or residual risks**

- [ ] **Step 4: Declare launch complete only when every release-blocking item has current passing evidence**

