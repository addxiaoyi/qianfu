# Aliyun Baota Production Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the current Qianfu application to `121.196.161.249` with trusted TLS, private upstreams, durable process startup, backups, and rollback evidence.

**Architecture:** Baota Nginx terminates TLS and serves the atomically published frontend while proxying API traffic to PM2 on `127.0.0.1:3001`. MySQL and Redis remain host services bound to loopback; host and Alibaba security rules expose only required entry points.

**Tech Stack:** Alibaba Cloud Linux 3, Baota Panel, Nginx, PM2, Node.js 22, MySQL, Redis, Bash, PowerShell SSH runner

---

### Task 1: Capture production rollback evidence

**Files:**
- Create: `scripts/linux/snapshot-baota-release.sh`
- Test: `tests/scripts/snapshot-baota-release.test.ts`

- [ ] **Step 1: Write a failing path-safety test**

```ts
expect(validateBackupRoot('/www/backup/qianfu/releases')).toBe(true);
expect(validateBackupRoot('/')).toBe(false);
```

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/scripts/snapshot-baota-release.test.ts`

Expected: FAIL because the snapshot helper does not exist.

- [ ] **Step 3: Implement the snapshot script**

The script must use `set -euo pipefail`, create a timestamped directory below `/www/backup/qianfu/releases`, copy the `mc-u.top` vhost and certificate directory, archive the current frontend, redact `.env` values to a key-only manifest, run `mysqldump`, and save `pm2 prettylist` with environment values removed.

- [ ] **Step 4: Validate locally and remotely without mutation**

Run: `bash -n scripts/linux/snapshot-baota-release.sh`

Run remotely: `bash /www/wwwroot/qianfu-app/scripts/linux/snapshot-baota-release.sh --check-only`

Expected: syntax exit 0 and all required source paths reported.

### Task 2: Install a Baota-compatible Nginx vhost

**Files:**
- Create: `deploy/nginx/mc-u.top.baota.conf.example`
- Create: `scripts/linux/install-baota-vhost.sh`
- Test: `tests/scripts/install-baota-vhost.test.ts`

- [ ] **Step 1: Test required routing invariants**

```ts
expect(conf).toContain('return 301 https://$host$request_uri;');
expect(conf).toContain('root /www/wwwroot/qianfu-app/qianfu-liandeng/dist;');
expect(conf).toContain('proxy_pass http://127.0.0.1:3001;');
expect(conf).not.toMatch(/listen\s+3001/);
```

- [ ] **Step 2: Render separate port 80 and 443 server blocks**

Use Baota certificate paths under `/www/server/panel/vhost/cert/mc-u.top/`. Cache hashed assets for one year; set HTML and `qianfu-dist-manifest.json` to `no-cache`; proxy `/api/` and `/auth/`; include websocket upgrade headers.

- [ ] **Step 3: Gate installation on certificate and syntax checks**

```bash
test -s /www/server/panel/vhost/cert/mc-u.top/fullchain.pem
test -s /www/server/panel/vhost/cert/mc-u.top/privkey.pem
/www/server/nginx/sbin/nginx -t
```

The installer must restore the previous vhost automatically if the post-copy syntax check fails.

### Task 3: Publish frontend and backend artifacts atomically

**Files:**
- Modify: `scripts/linux/deploy-frontend-dist.sh`
- Modify: `scripts/linux/deploy-bt-oneclick.sh`
- Modify: `scripts/frontend-dist-manifest.mjs`

- [ ] **Step 1: Build on the workstation**

Run: `npm run typecheck && npm run typecheck:server && npm run build && npm run server:build`

Expected: all commands exit 0 and the frontend manifest reports a non-empty `distHash`.

- [ ] **Step 2: Upload to a staging directory**

Upload artifacts to `/www/wwwroot/qianfu-app/.releases/<timestamp>` rather than overwriting live paths.

- [ ] **Step 3: Validate staging before switching**

Require `index.html`, every manifest entrypoint, `dist-server/server/index.js`, Prisma clients, and `packages/shared` to exist.

- [ ] **Step 4: Switch atomically and retain one rollback release**

Use same-filesystem `mv` operations. Never delete the current release before staging validation completes.

### Task 4: Normalize process and service ownership

**Files:**
- Modify: `ecosystem.config.cjs`
- Create: `scripts/linux/verify-baota-services.sh`

- [ ] **Step 1: Bind Qianfu API to loopback**

```js
env_production: {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: 3001,
}
```

- [ ] **Step 2: Configure PM2 durability**

Set `max_memory_restart`, timestamped logs, bounded log rotation, graceful shutdown timeout, then run `pm2 reload ecosystem.config.cjs --only qianfu-api --env production && pm2 save`.

- [ ] **Step 3: Verify actual Baota service entry points**

Check `/etc/init.d/nginx`, `/etc/init.d/mysqld`, and `/etc/init.d/redis` plus listening processes. Do not rely only on unrelated distro systemd units.

### Task 5: Close network exposure and add memory headroom

**Files:**
- Create: `scripts/linux/harden-baota-host.sh`
- Test: `tests/scripts/harden-baota-host.test.ts`

- [ ] **Step 1: Add a dry-run firewall plan**

The dry run must preserve `22`, `80`, `443`, and temporarily `27438`, while denying public access to `3001`, `3306`, `3452`, `8787`, and `8788` without stopping their local processes.

- [ ] **Step 2: Bind MySQL to loopback and verify Redis loopback**

Run local connection checks before and after reload. Abort if the Qianfu health endpoint loses database readiness.

- [ ] **Step 3: Create persistent 2 GiB Swap**

Use `/swapfile`, mode `0600`, an idempotent `/etc/fstab` entry, and `vm.swappiness=10`.

- [ ] **Step 4: Re-probe from outside**

Expected: `22/80/443/27438` reachable; `3001/3306/3452/8787/8788` unreachable.

### Task 6: Install backups and health tasks

**Files:**
- Modify: `scripts/linux/setup-bt-cron.sh`
- Modify: `scripts/linux/qianfu-prod-healthcheck.sh`
- Create: `scripts/linux/prune-qianfu-backups.sh`

- [ ] **Step 1: Replace automatic deploy polling with explicit maintenance tasks**

Generate Baota tasks for daily MySQL backup, daily health/TLS/disk checks, and pruning. Do not auto-pull or auto-restart production every 15 minutes.

- [ ] **Step 2: Enforce retention**

Keep seven daily and four weekly backups. Refuse deletion outside `/www/backup/qianfu`.

- [ ] **Step 3: Perform a restore-readiness check**

Run `gzip -t` and import the dump into a temporary database name, compare critical table counts, then remove the temporary database.

### Task 7: Execute production cutover and rollback drill

**Files:**
- Create: `output/prod-launch/aliyun-baota-cutover.json`

- [ ] **Step 1: Run snapshot, dry runs, and syntax gates**

- [ ] **Step 2: Install trusted certificate and vhost**

- [ ] **Step 3: Publish artifacts and reload PM2/Nginx**

- [ ] **Step 4: Run `npm run prod:healthcheck:public` and manifest verification**

- [ ] **Step 5: Verify `star-web.top` response hash is unchanged**

- [ ] **Step 6: Record rollback commands and artifact hashes in the cutover report**

