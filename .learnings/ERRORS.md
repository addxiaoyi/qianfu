# Errors

Command failures and integration errors.

---

## [ERR-20260715-017] root-prisma-client-uninitialized

**Logged**: 2026-07-15T14:32:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
An ad hoc acceptance script imported the root `@prisma/client`, which is intentionally not generated in this workspace.

### Error
```text
@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
```

### Context
- The application resolves generated clients from `prisma/generated/client` through `server/utils/prismaClientResolver.ts`.
- The test exited before creating or mutating a test user.

### Resolution
- **Resolved**: 2026-07-15T14:32:00+08:00
- **Notes**: Subsequent local acceptance probes import `server/db.ts`, matching the live server client resolver instead of regenerating dependencies.

### Metadata
- Reproducible: yes
- Related Files: server/db.ts, server/utils/prismaClientResolver.ts

---

## [ERR-20260715-016] prisma-query-engine-lock-during-server-build

**Logged**: 2026-07-15T10:27:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
`server:build` could not replace Prisma's Windows query engine while the local API process held the DLL open.

### Error
```text
EPERM: operation not permitted, rename query_engine-windows.dll.node.tmp -> query_engine-windows.dll.node
```

### Context
- Type checks and the frontend build had already passed.
- No production host state was changed.
- The local API on port 3000 is expected to be the file-lock owner.

### Suggested Fix
Stop only the local API listener, rerun `npm run server:build`, then restart the local API and rerun the required smoke checks.

### Metadata
- Reproducible: yes
- Related Files: prisma/generated/client/query_engine-windows.dll.node

### Resolution
- **Resolved**: 2026-07-15T10:47:00+08:00
- **Notes**: Stopped only the verified local Qianfu API process tree, rebuilt successfully, then restarted Qianfu on port 3050 to avoid an unrelated local service already bound to 3000. The Vite proxy was restarted against 3050 and returned the Qianfu health response.

---

## [ERR-20260715-007] powershell-login-profile-timeout

**Logged**: 2026-07-15T08:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
PowerShell commands timed out when started with the interactive login profile enabled.

### Error
```text
command timed out after approximately 10 seconds
```

### Context
- The affected checks were read-only local project and environment inspection commands.
- The login profile started an unrelated WSL/Docker helper before the requested command ran.
- No source, deployment, or secret state was changed.

### Suggested Fix
Use non-login PowerShell sessions for automation in this workspace unless the profile is explicitly required.

### Metadata
- Reproducible: yes
- Related Files: local shell automation

### Resolution
- **Resolved**: 2026-07-15T08:00:00+08:00
- **Notes**: Re-ran the checks with `login:false`; commands completed normally.

---

## [ERR-20260715-008] remote-shell-nested-quote-parse

**Logged**: 2026-07-15T08:15:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A read-only remote diagnostic command failed because nested shell quotes changed the AWK expression before it reached the target host.

### Error
```text
bash: -c: line 6: syntax error near unexpected token `('
```

### Context
- The SSH connection and application-root check completed successfully before the diagnostic command ran.
- The failed command only requested host, Nginx, certificate, PM2, listener, and release-directory summaries.
- No remote files, services, databases, or credentials were modified.

### Suggested Fix
Encode multi-line remote diagnostics as one Base64 payload and execute the decoded script with Bash.

### Metadata
- Reproducible: yes
- Related Files: scripts/remote_restore_password.py

### Resolution
- **Resolved**: 2026-07-15T08:15:00+08:00
- **Notes**: Replaced nested shell quoting with an encoded, read-only Bash payload.

---

## [ERR-20260715-009] baota-release-snapshot-pm2-contract

**Logged**: 2026-07-15T08:45:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
The staged production release stopped during its pre-switch snapshot because the PM2 command did not emit strict JSON, and rollback assumed an unavailable ecosystem config filename.

### Error
```text
SyntaxError: Expected property name or '}' in JSON
[PM2][ERROR] File ecosystem.config.cjs not found
```

### Context
- The failure occurred before server artifacts or the frontend current link were replaced.
- The release trap restored the existing frontend target before exiting.
- A follow-up health check is required before retrying with the corrected PM2 contract.

### Suggested Fix
Use `pm2 jlist` for machine-readable process snapshots and reload the existing Qianfu process by name when no ecosystem config file is present.

### Metadata
- Reproducible: yes
- Related Files: scripts/linux/snapshot-baota-release.sh, scripts/linux/publish-baota-release.sh

### Resolution
- **Resolved**: 2026-07-15T06:05:48+08:00
- **Notes**: The snapshot now uses `pm2 jlist`, and release rollback/restart targets the existing process by name. Release `20260715-053624` published successfully.

---

## [ERR-20260715-010] windows-console-unicode-release-output

**Logged**: 2026-07-15T08:55:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
The local release runner could not print a valid remote Unicode character through the Windows GBK console after the remote command completed.

### Error
```text
UnicodeEncodeError: 'gbk' codec can't encode character
```

### Context
- The error occurred while writing captured remote stdout locally, after the SSH command stream reached completion.
- Remote release state is unknown until verified through read-only health and release-link checks.
- No credential value was printed or persisted.

### Suggested Fix
Write captured remote output through UTF-8 binary stdout with a safe text fallback.

### Metadata
- Reproducible: yes
- Related Files: scripts/deploy-baota-release.py

### Resolution
- **Resolved**: 2026-07-15T06:05:48+08:00
- **Notes**: The release runner writes captured remote output through UTF-8 binary streams. The successful release and later remote checks completed without console-encoding corruption.

---

## [ERR-20260715-011] remote-python-sqlite-backup-api

**Logged**: 2026-07-15T09:15:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
The remote Python SQLite binding lacks the `Connection.backup()` method required by the initial online-backup implementation.

### Error
```text
AttributeError: 'sqlite3.Connection' object has no attribute 'backup'
```

### Context
- The failure occurred during the pre-switch SQLite backup stage.
- The release rollback restored the previous links and reloaded the existing PM2 process.
- No migration or new application artifact became active.

### Suggested Fix
Use SQLite `VACUUM INTO` when supported by the server SQLite library, with an explicit version check before using it.

### Metadata
- Reproducible: yes
- Related Files: scripts/linux/snapshot-baota-release.sh

### Resolution
- **Resolved**: 2026-07-15T06:05:48+08:00
- **Notes**: The snapshot uses the server's `sqlite3 .backup` capability instead of the unavailable Python backup API. The release snapshot manifest was created successfully.

---

## [ERR-20260715-013] sqlite-migration-lock-under-live-api

**Logged**: 2026-07-15T09:35:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
Prisma could not initialize migration persistence because the live API held a lock on the SQLite database.

### Error
```text
Error: SQLite database error
database is locked
```

### Context
- The SQLite snapshot completed before the migration attempt.
- The release rollback restored the old links and restarted `qianfu-api`.
- The deployment must apply the new schema migration before activating code that depends on it.

### Suggested Fix
Quiesce only `qianfu-api` immediately before `prisma migrate deploy`, then start the process from the new link after migration. Restart the old link automatically on failure.

### Metadata
- Reproducible: yes
- Related Files: scripts/linux/publish-baota-release.sh

### Resolution
- **Resolved**: 2026-07-15T06:05:48+08:00
- **Notes**: The publisher stops only `qianfu-api` for `prisma migrate deploy`, then restores or starts the appropriate release. The Marketplace migration applied in release `20260715-053624`.

---

## [ERR-20260715-012] vitest-worker-start-timeout

**Logged**: 2026-07-15T09:25:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The focused Vitest run timed out while starting a fork worker before any test executed.

### Error
```text
Failed to start forks worker
Timeout waiting for worker to respond
```

### Context
- No assertions, source changes, or remote operations ran in the failed test attempt.
- A completed local Vite smoke server was still running and will be stopped before retrying.

### Suggested Fix
Release the local smoke server and retry the focused test with a single worker.

### Metadata
- Reproducible: unknown
- Related Files: tests/unit/baota-release-contract.test.ts

### Resolution
- **Resolved**: 2026-07-15T06:08:20+08:00
- **Notes**: `npx vitest run tests/unit/baota-release-contract.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism` passed 3 of 3 tests.

---

## [ERR-20260715-014] combined-postchange-probe-timeout

**Logged**: 2026-07-15T06:05:48+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A combined post-change command exceeded the local orchestration time budget even though the independent TCP, public HTTPS, and remote health probes completed successfully.

### Error
```text
command timed out after 10201 milliseconds
```

### Context
- The firewall change had already completed and persisted before the combined verification started.
- Independent probes confirmed the intended ports were blocked and the public web/API endpoints returned 200.
- No server configuration was changed by the timed-out verification command.

### Suggested Fix
Keep production verification gates independent so a slow probe cannot hide completed results from unrelated checks.

### Metadata
- Reproducible: yes
- Related Files: output/prod-launch/aliyun-baota-cutover.json

### Resolution
- **Resolved**: 2026-07-15T06:05:48+08:00
- **Notes**: Subsequent isolated TCP, HTTPS, and SSH/PM2 checks all completed successfully.

---

## [ERR-20260715-015] vitest-full-suite-no-progress

**Logged**: 2026-07-15T06:24:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
The complete Vitest suite exceeded the five-minute execution budget without emitting a completed test result while its worker remained active.

### Error
```text
command timed out after 304049 milliseconds
```

### Context
- The affected command was `npm run test:run -- --pool=forks --maxWorkers=1 --no-file-parallelism`.
- The NPM and Vitest processes launched by this run were terminated after the timeout to prevent lingering database or worker contention.
- The focused Baota release contract suite had already passed, so this is a full-suite progress issue rather than a known assertion failure.

### Suggested Fix
Run the authentication, promotion, marketplace, payment, and security suites independently to identify the blocking test or fixture, then restore a bounded full-suite gate.

### Metadata
- Reproducible: unknown
- Related Files: tests, vitest.config.ts

---

## [ERR-20260715-006] npm-audit-registry-mirror

**Logged**: 2026-07-15T03:53:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
The configured npm mirror does not implement the advisory bulk endpoint required by `npm audit`.

### Error
```text
404 Not Found: /-/npm/v1/security/advisories/bulk not implemented by the configured registry mirror
```

### Context
- Dependency audit was read-only and did not change dependencies or lockfiles.
- The production dependency audit must use the official npm registry in this environment.

### Suggested Fix
Run `npm --registry=https://registry.npmjs.org audit --omit=dev --json` for security audits when the active registry mirror lacks advisory support.

### Metadata
- Reproducible: yes
- Related Files: package-lock.json

### Resolution
- **Resolved**: 2026-07-15T03:53:00+08:00
- **Notes**: Switched the audit command to the official read-only registry endpoint.

---

## [ERR-20260714-004] production-smoke-user-cleanup

**Logged**: 2026-07-14T18:09:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
Direct deletion of isolated production smoke users was rejected by SQLite foreign-key constraints.

### Error
```text
FOREIGN KEY constraint failed
```

### Context
- The isolated marketplace product, order, and payment were removed successfully.
- Three uniquely prefixed smoke users remain until their dependent authentication and audit rows are removed in schema-defined order.
- SQLite integrity remained healthy and no non-smoke records were targeted.

### Suggested Fix
Inspect live foreign-key metadata and delete only dependent rows belonging to the unique smoke-user IDs before deleting the users.

### Metadata
- Reproducible: yes
- Related Files: prisma/schema.prisma

### Resolution
- **Resolved**: 2026-07-14T18:21:35+08:00
- **Notes**: Deleted only restrictive child rows belonging to the three uniquely prefixed smoke users, then deleted the users. Final production verification returned remaining=0 and PRAGMA quick_check=ok with exit code 0.

---

## [ERR-20260714-011] aliyun-command-editor-residual-content

**Logged**: 2026-07-14T18:20:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
Alibaba Cloud Command Assistant kept its default shebang after browser-driven editor replacement.

### Error
```text
The submitted command ended with an unexpected #!/bin/bash token and returned exit code 1.
```

### Context
- The cleanup transaction had already committed and printed remaining=0 and ok.
- A separate read-only verification also printed remaining=0 and ok before the appended token caused a non-zero exit.
- No production record outside the unique smoke-user prefix was targeted.

### Suggested Fix
End browser-filled command content with a newline and comment marker so any retained editor template is harmless.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T18:21:35+08:00
- **Notes**: Re-ran the verification with a trailing comment marker; Command Assistant returned exit code 0, remaining=0, and quick_check=ok.

---

## [ERR-20260714-003] production-probe-tooling

**Logged**: 2026-07-14T17:12:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
Two read-only production probes failed because of local tooling limits.

### Error
```text
Node rejected mixed CommonJS and top-level await syntax; the first large browser snapshot timed out.
```

### Context
- The TCP exposure probe used an ambiguous inline Node module format.
- A large Baota panel DOM snapshot exceeded the browser execution timeout.
- Neither failure changed local or production state.

### Suggested Fix
Use an explicit ESM import for inline Node probes and inspect the panel in bounded, targeted reads.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T17:12:00+08:00
- **Notes**: Switched to explicit ESM and smaller browser observations.

---

## [ERR-20260714-002] powershell-login-profile-timeout

**Logged**: 2026-07-14T17:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
PowerShell login-shell commands timed out while the local profile waited for Docker startup.

### Error
```text
command timed out after 10 seconds while starting dockerd
```

### Context
- Read-only workspace initialization and skill reads were attempted through a login shell.
- No project, production, or credential state was changed.

### Suggested Fix
Use non-login PowerShell for bounded repository checks when profile initialization is unrelated.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T17:00:00+08:00
- **Notes**: Retried subsequent repository checks with login-shell initialization disabled.

---

## [ERR-20260714-010] paramiko-release-upload

**Logged**: 2026-07-14T15:41:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
Two pre-transfer issues blocked the first release upload attempts: literal newline escaping and non-recursive SFTP directory creation.

### Error
```text
SyntaxError before connection; then FileNotFoundError while creating a nested remote directory
```

### Context
- Neither failed attempt uploaded a release file or changed the running application.
- A trailing PowerShell cleanup command initially masked the Python exit code.

### Suggested Fix
Use actual newlines, preserve the child exit code, and create nested remote directories through SSH before SFTP transfer.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T15:43:00+08:00
- **Notes**: Uploaded 99,421,642 bytes and verified the remote SHA-256 against the local archive.

---

## [ERR-20260714-009] powershell-archive-command-quoting

**Logged**: 2026-07-14T15:39:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
The first release archive command was rejected by the orchestration JavaScript parser before PowerShell ran.

### Error
```text
SyntaxError: Invalid or unexpected token
```

### Context
- Nested double quotes in the command string made the tool source invalid.
- No archive or project mutation occurred during the failed attempt.

### Suggested Fix
Use a raw template literal for multiline PowerShell commands.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T15:39:00+08:00
- **Notes**: Re-ran the archive command with unambiguous raw-string quoting.

---

## [ERR-20260714-008] server-build-prisma-copy

**Logged**: 2026-07-14T15:14:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
The server build reached Prisma generation and TypeScript compilation but failed during the final client copy on Windows.

### Error
```text
UNKNOWN: unknown error, copyfile prisma/generated/client/index.d.ts to dist-server/prisma/generated/client/index.d.ts
```

### Context
- The source and destination files remained present with equal size after the failure.
- Generated PostgreSQL, MySQL, and local clients contained the RHEL engine.
- The production SQLite client did not because the server build did not regenerate it.

### Suggested Fix
Regenerate the production SQLite client in the build, then rerun the full build to determine whether the copy error was transient.

### Metadata
- Reproducible: unknown
- Related Files: package.json, scripts/sync-prisma-client-to-dist.mjs

### Resolution
- **Resolved**: 2026-07-14T15:18:00+08:00
- **Notes**: Added production SQLite client generation to the build; the full build then completed and copied all four clients.

---

## [ERR-20260714-007] auto-pull-codex-stack

**Logged**: 2026-07-14T15:10:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
The session synchronization script exceeded the command timeout while starting the local Docker daemon.

### Error
```text
command timed out while WSL2Docker was starting dockerd
```

### Context
- The required session initialization script was invoked before project work.
- The timeout occurred in local tooling; no project or production state was changed.

### Suggested Fix
Run later shell checks without the login profile and keep Docker startup outside short command timeouts.

### Metadata
- Reproducible: unknown
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T15:10:00+08:00
- **Notes**: Continued project checks with the PowerShell login profile disabled.

---

## [ERR-20260714-006] paramiko-output-gbk

**Logged**: 2026-07-14T14:57:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
PM2 status output contained Unicode symbols that the local GBK console could not encode.

### Error
```text
UnicodeEncodeError while printing remote PM2 output
```

### Context
- The SSH session was read-only and the known host key matched.
- No server state changed before the local rendering failure.

### Suggested Fix
Configure Python stdout as UTF-8 before printing remote command output.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T14:57:00+08:00
- **Notes**: Re-ran the remote inspection with UTF-8 stdout.

---

## [ERR-20260714-005] bash-heredoc-in-powershell

**Logged**: 2026-07-14T14:17:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
A Bash here-string was used in a PowerShell command while probing SQLite metadata.

### Error
```text
Missing file specification after redirection operator
```

### Context
- The failed command was read-only and did not modify the database.

### Suggested Fix
Use PowerShell-native piping or query SQLite through Node's structured database API.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T14:17:00+08:00
- **Notes**: The parity test now uses node:sqlite directly.

---

## [ERR-20260714-004] npm-audit-fix-peer-conflict

**Logged**: 2026-07-14T14:09:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: dependencies

### Summary
The lock-only audit fix was blocked by an existing ESLint peer mismatch unrelated to the vulnerable packages being updated.

### Error
```text
@eslint/js 10 expects ESLint 10, while this repository still runs ESLint 8 with legacy eslintrc mode
```

### Context
- The command used package-lock-only mode and did not run lifecycle scripts.
- No dependency update was applied by the failed command.

### Suggested Fix
Use legacy peer resolution for the scoped lock refresh, and migrate the lint stack separately with its own tests.

### Metadata
- Reproducible: yes
- Related Files: package.json, package-lock.json

### Resolution
- **Resolved**: 2026-07-14T14:09:00+08:00
- **Notes**: Continued with a scoped lock-only refresh using the repository's currently installed peer-resolution mode.

---

## [ERR-20260714-003] powershell-login-profile-timeout

**Logged**: 2026-07-14T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
Login-shell commands were delayed by an unrelated WSL Docker startup hook and timed out before project checks ran.

### Error
```text
command timed out while the PowerShell profile was starting a local container runtime
```

### Context
- Read-only repository and skill checks were launched with login-shell semantics.
- No project mutation occurred during the failed calls.

### Suggested Fix
Use `login: false` for workspace commands that do not require profile initialization.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T00:00:00+08:00
- **Notes**: Re-ran the checks in a non-login PowerShell process.

---

## [ERR-20260714-004] codegraph-sync-timeout

**Logged**: 2026-07-14T13:18:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
Full CodeGraph synchronization exceeded the two-minute command budget.

### Error
```text
command timed out after 124 seconds
```

### Context
- The existing graph remained readable and reported only two pending files afterward.
- Targeted source searches were sufficient for the implementation plan.

### Suggested Fix
Use targeted CodeGraph queries and source searches during active deployment work; schedule full sync separately.

### Metadata
- Reproducible: unknown
- Related Files: .codegraph

### Resolution
- **Resolved**: 2026-07-14T13:18:00+08:00
- **Notes**: Continued with the existing index and authoritative current files.

---

## [ERR-20260714-005] npm-mirror-audit-endpoint

**Logged**: 2026-07-14T13:22:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
The configured npm mirror does not implement the security audit endpoint.

### Error
```text
[NOT_IMPLEMENTED] /-/npm/v1/security/* not implemented yet
```

### Context
- An empty parsed result from the mirror was not valid security evidence.
- No dependency files were changed by the audit.

### Suggested Fix
Run audits with `--registry=https://registry.npmjs.org` and keep the project registry unchanged.

### Metadata
- Reproducible: yes
- Related Files: package-lock.json, qianfu-liandeng/package-lock.json

### Resolution
- **Resolved**: 2026-07-14T13:23:00+08:00
- **Notes**: Official audit reported 17 root and 35 frontend production findings.

---

## [ERR-20260714-003] staged-diff-check-flow

**Logged**: 2026-07-14T12:52:00+08:00
**Priority**: low
**Status**: resolved
**Area**: docs

### Summary
The commit command ran after `git diff --cached --check` reported trailing whitespace.

### Error
```text
trailing whitespace
```

### Context
- PowerShell statement separators allowed the commit command to continue after the check returned non-zero.
- Only the new design document was committed.

### Suggested Fix
Set fail-fast behavior or gate the commit explicitly on a successful staged diff check.

### Metadata
- Reproducible: yes
- Related Files: docs/superpowers/specs/2026-07-14-aliyun-baota-production-design.md

### Resolution
- **Resolved**: 2026-07-14T12:52:00+08:00
- **Notes**: Removed the whitespace and amended the same scoped commit.

---

## [ERR-20260714-002] git-check-ignore

**Logged**: 2026-07-14T12:49:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A combined repository inspection returned non-zero because `git check-ignore` uses exit code 1 for an unignored path.

### Error
```text
Exit code: 1
```

### Context
- The staged file list was empty and the requested spec directory did not yet exist.
- No repository mutation occurred.

### Suggested Fix
Treat `git check-ignore` exit code 1 as an expected negative result or run it separately.

### Metadata
- Reproducible: yes
- Related Files: .gitignore

### Resolution
- **Resolved**: 2026-07-14T12:49:00+08:00
- **Notes**: Continued with an explicitly scoped design-file commit.

---

## [ERR-20260714-001] public-port-probe

**Logged**: 2026-07-14T12:45:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
Sequential TCP probes exceeded the command timeout when several ports were filtered.

### Error
```text
command timed out after 60 seconds
```

### Context
- A public exposure check probed several ports one after another.
- Filtered ports consumed the timeout budget before the result table was printed.
- TLS and DNS checks completed and remained usable.

### Suggested Fix
Use concurrent probes with a short per-port socket timeout and print each result independently.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-07-14T12:45:00+08:00
- **Notes**: Switched the deployment audit design to bounded concurrent port probes.

---
## [ERR-20260714-012] powershell-rg-glob

**Logged**: 2026-07-14T19:10:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
PowerShell passed an unexpanded wildcard path to ripgrep, causing the parallel source inspection to fail.

### Error
```text
rg: prisma/schema*.prisma: IO error ... (os error 123)
```

### Context
- The command used `rg ... prisma/schema*.prisma` under PowerShell.
- No files were modified by the failed inspection.

### Suggested Fix
Search the directory and use ripgrep's `-g 'schema*.prisma'` file filter.

### Metadata
- Reproducible: yes
- Related Files: prisma/schema.prisma

### Resolution
- **Resolved**: 2026-07-14T19:10:00+08:00
- **Notes**: Replaced the wildcard path with a directory target plus `-g` filter.

---
## [ERR-20260714-013] codegraph-context-option

**Logged**: 2026-07-14T19:13:00+08:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
The installed CodeGraph CLI does not support the assumed `context --max-tokens` option.

### Error
```text
error: unknown option '--max-tokens'
```

### Context
- The local CLI supports `--max-nodes` and `--max-code` for context bounds.
- No repository files were changed by the failed command.

### Suggested Fix
Inspect `codegraph context --help` and use version-supported bounds.

### Metadata
- Reproducible: yes
- Related Files: .codegraph/codegraph.db

### Resolution
- **Resolved**: 2026-07-14T19:13:00+08:00
- **Notes**: Switched to `--max-nodes 50 --max-code 10`.

---
## [ERR-20260714-014] npm-audit-mirror

**Logged**: 2026-07-14T20:02:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
The configured npm mirror does not implement the npm security audit endpoint.

### Error
```text
404 Not Found - POST https://registry.npmmirror.com/-/npm/v1/security/advisories/bulk
```

### Context
- `npm audit --omit=dev --json` could not retrieve advisory data.
- No dependency or lockfile changes were made.

### Suggested Fix
Run the audit against the official npm registry or a configured internal proxy that supports the advisories API.

### Metadata
- Reproducible: yes
- Related Files: package-lock.json

---

### Resolution
- **Resolved**: 2026-07-14T20:04:00+08:00
- **Notes**: Re-ran `npm audit` against `https://registry.npmjs.org`; production and full dependency trees reported zero advisories.
## [ERR-20260714-015] local-smoke-wallet-secret

**Logged**: 2026-07-14T20:06:00+08:00
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
The local production-mode smoke runner exits before health checks when `WALLET_SECRET` is absent.

### Error
```text
[Wallet] FATAL: WALLET_SECRET environment variable is required in production mode
```

### Context
- `npm run smoke:api:local` started the SQLite server and failed during module initialization.
- No smoke user or business row was created.

### Suggested Fix
Provide a disposable test-only wallet secret in the process environment for local smoke, while keeping production secrets out of scripts and source.

### Metadata
- Reproducible: yes
- Related Files: server/lib/wallet.ts, scripts/smoke-api-local.ts

---

## [ERR-20260714-016] browser-control-aliyun-terminal

**Logged**: 2026-07-14T21:50:13+08:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
The browser control channel could not reliably claim the existing BaoTa panel tab for the production server.

### Error
```text
Browser page inspection and tab claiming timed out; the browser session reset.
```

### Context
- The existing BaoTa panel remained visible in the user Chrome session.
- No panel action or server-side change was made before the timeout.

### Suggested Fix
Use SSH as the primary deployment path and treat browser panel access as a monitoring fallback until the control channel is stable.

### Metadata
- Reproducible: yes
- Related Files: deployment workflow

---

## [ERR-20260714-017] baota-release-health-gate

**Logged**: 2026-07-14T22:11:00+08:00
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
The first two protected release attempts rolled back despite a healthy candidate because the gate checked readiness too early and used an unsafe manifest pipeline.

### Error
```text
Immediate Nginx probe returned 502 during API startup.
curl returned 23 after grep -q closed the manifest-validation pipe.
```

### Context
- The host uses BaoTa's Nginx binary, not a systemd-managed nginx.service.
- The API became healthy on the second two-second probe after PM2 restart.
- Database snapshots and symlink rollback restored the prior release before the successful retry.

### Suggested Fix
Wait for API readiness with a bounded retry loop, use /www/server/nginx/sbin/nginx for validation and reload, and validate downloaded manifests from a temporary file.

### Metadata
- Reproducible: yes
- Related Files: deployment workflow

### Resolution
- **Resolved**: 2026-07-14T22:08:32+08:00
- **Notes**: Applied the retry and temporary-file checks; the release, migration, public health checks, and frontend manifest verification succeeded.

---

## [ERR-20260715-001] codegraph-sync

**Logged**: 2026-07-15T01:44:58+08:00
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
CodeGraph synchronization exceeded the local three-minute command budget during deployment verification.

### Error
```text
codegraph sync . timed out after 184 seconds
```

### Context
- The existing index was usable but reported 74 modified and 80 added files.
- No source files or remote server state changed while the index command ran.

### Suggested Fix
Run indexing outside the deployment critical path or raise the timeout only when an updated graph is required.

### Metadata
- Reproducible: unknown
- Related Files: .codegraph

---

## [ERR-20260715-002] nested-deployment-script

**Logged**: 2026-07-15T02:05:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A nested Python here-document for the remote Nginx patch was parsed locally before any SSH action could run.

### Error
```text
SyntaxError: invalid decimal literal at proxy_read_timeout 10s
```

### Context
- The outer command contained nested triple-quoted Python source.
- The failure happened before establishing the remote edit command, so the BaoTa configuration remained unchanged.

### Suggested Fix
Encode nested remote patch source before transmission or use one scripting language per command layer.

### Metadata
- Reproducible: yes
- Related Files: deployment workflow

### Resolution
- **Resolved**: 2026-07-15T02:05:00+08:00
- **Notes**: Switched the remote patch transport to a base64-encoded Python payload.

---

## [ERR-20260715-003] npm-audit-mirror

**Logged**: 2026-07-15T02:28:00+08:00
**Priority**: low
**Status**: in_progress
**Area**: infra

### Summary
The configured npm mirror does not implement the security advisory audit endpoint.

### Error
```text
POST /-/npm/v1/security/advisories/bulk returned NOT_IMPLEMENTED
```

### Context
- `npm audit --omit=dev --json` could not provide dependency vulnerability evidence.
- The application source and production runtime were not changed.

### Suggested Fix
Run the audit through the official npm registry or a mirror that supports the advisory endpoint.

### Metadata
- Reproducible: yes
- Related Files: package-lock.json

---

## [ERR-20260715-004] powershell-static-scan-quoting

**Logged**: 2026-07-15T02:31:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A combined static-scan command failed to parse because its regular expressions contained nested shell quotes.

### Error
```text
ParserError: An empty pipe element is not allowed.
```

### Context
- The command failed before ripgrep was invoked.
- No source, build artifact, or remote state was changed.

### Suggested Fix
Run each scan category with simple single-quoted patterns instead of composing multiple quote-heavy regular expressions in one PowerShell command.

### Metadata
- Reproducible: yes
- Related Files: security audit workflow

### Resolution
- **Resolved**: 2026-07-15T02:31:00+08:00
- **Notes**: Replaced the combined command with independently quoted scans.

---

## [ERR-20260715-005] powershell-range-helper

**Logged**: 2026-07-15T02:34:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A generic PowerShell line-range helper failed when mixed range arrays were passed to it.

### Error
```text
OperationStopped: Argument types do not match
```

### Context
- Only local source inspection was attempted.
- Partial output was discarded and no project or deployment state changed.

### Suggested Fix
Use direct `Select-Object -Skip/-First` reads for audit slices instead of dynamic array-based range helpers.

### Metadata
- Reproducible: yes
- Related Files: security audit workflow

### Resolution
- **Resolved**: 2026-07-15T02:34:00+08:00
- **Notes**: Replaced the generic helper with direct fixed-range reads.

---

## [ERR-20260715-018] registration-email-runtime-timeout

**Logged**: 2026-07-15T14:31:00+08:00
**Priority**: high
**Status**: in_progress
**Area**: backend

### Summary
The local registration endpoint returned HTTP 504 while awaiting the configured email runtime.

### Error
```text
POST /api/v1/auth/register -> HTTP 504
```

### Context
- The request used a fresh test user and a valid CSRF token against the local API on port 3050.
- The account was removed during test cleanup.
- The verification workflow cannot close while outbound email can hold the registration request past the API timeout.

### Suggested Fix
Bound the mail transport send duration and ensure registration returns a clear delivery failure or uses a durable delivery queue.

### Metadata
- Reproducible: unknown
- Related Files: server/controllers/registerController.ts, server/services/emailService.ts

### Resolution
- **Resolved**: 2026-07-15T14:50:00+08:00
- **Notes**: Added a seven-second end-to-end mail send timeout, closed timed-out transports, propagated delivery failures, and rolled back pending registration rows. The real API now returns 503 in 8.9 seconds with no residual user.

---

## [ERR-20260715-019] powershell-start-process-log-redirection

**Logged**: 2026-07-15T15:06:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Windows rejected a background test command when standard output and standard error targeted the same log file.

### Error
```text
RedirectStandardOutput and RedirectStandardError cannot be the same path
```

### Context
- The full test suite needed a background process because foreground execution exceeds the terminal time slice.
- No application source, database state, or deployment state was changed by the failed process start.

### Suggested Fix
Use separate stdout and stderr log paths when starting npm through PowerShell Start-Process.

### Metadata
- Reproducible: yes
- Related Files: test execution workflow

### Resolution
- **Resolved**: 2026-07-15T15:06:00+08:00
- **Notes**: Switched the test runner to separate output logs and poll the child process exit code.

---

## [ERR-20260715-020] deployment-terminal-time-slice

**Logged**: 2026-07-15T16:21:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
The foreground release preflight exceeded the local terminal time slice while uploading the release bundle.

### Error
```text
command timed out after 120 seconds
```

### Context
- The release runner pins the SSH host key and stages before publication.
- A follow-up staged-publish probe confirmed the remote release directory was not created, so production was unchanged.

### Suggested Fix
Run the upload and preflight in a controlled background process with separate logs, then publish only after its successful exit.

### Metadata
- Reproducible: yes
- Related Files: scripts/deploy-baota-release.py

### Resolution
- **Resolved**: 2026-07-15T16:21:00+08:00
- **Notes**: Switched the long-running preflight to a background process and retained the staged-publish guard.

---

## [ERR-20260715-021] npm-mirror-audit-endpoint

**Logged**: 2026-07-15T16:49:00+08:00
**Priority**: low
**Status**: resolved
**Area**: security

### Summary
The configured npm mirror does not implement the advisory endpoint required by npm audit.

### Error
```text
POST /-/npm/v1/security/advisories/bulk returned NOT_IMPLEMENTED
```

### Context
- The command was read-only and did not modify dependencies or lockfiles.
- The failure is specific to the configured registry, not an audit finding.

### Suggested Fix
Run npm audit against the official npm registry for the vulnerability result.

### Metadata
- Reproducible: yes
- Related Files: package-lock.json

### Resolution
- **Resolved**: 2026-07-15T16:49:00+08:00
- **Notes**: Retried the same read-only audit with the official npm registry.

---

## [ERR-20260715-022] powershell-http-redirect-probe

**Logged**: 2026-07-15T16:52:00+08:00
**Priority**: low
**Status**: resolved
**Area**: security

### Summary
Invoke-WebRequest treated the expected HTTP-to-HTTPS 301 response as an exception and did not retain a response object.

### Error
```text
301 Moved Permanently followed by a null response object
```

### Context
- The command inspected redirect behavior only and did not change remote state.
- The status indicates nginx served the expected redirect.

### Suggested Fix
Use curl with header output for non-followed redirect assertions.

### Metadata
- Reproducible: yes
- Related Files: public security probe workflow

### Resolution
- **Resolved**: 2026-07-15T16:52:00+08:00
- **Notes**: Switched the redirect probe to curl so 301 headers are captured directly.

---

## [ERR-20260716-001] powershell-parallel-audit-memory

**Logged**: 2026-07-16T09:10:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Four broad PowerShell source scans exhausted the shell process memory while audit agents were active.

### Error
```text
System.OutOfMemoryException in PowerShell ConsoleHost
```

### Context
- The operation was read-only and did not change application or production state.
- The searches covered large marketplace, moderation, frontend, and Prisma source sets concurrently.

### Suggested Fix
Keep broad repository scans sequential or limit each query to a narrow file set while parallel agents are active.

### Metadata
- Reproducible: unknown
- Related Files: audit workflow

### Resolution
- **Resolved**: 2026-07-16T09:10:00+08:00
- **Notes**: Switched the main-thread audit to bounded sequential reads.

---
