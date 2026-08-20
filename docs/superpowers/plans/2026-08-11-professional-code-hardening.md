# Professional Code Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将千服后端的缓存、异步资源、上传和生产运行时保护收敛为有边界、可清理、可观测且可验证的实现。

**Architecture:** 先保留现有路由和服务接口，在边界层补上有限容量、TTL、并发去重、Abort/close 清理和统一错误响应；每个改造批次只触碰一个责任域，并以行为测试锁定回归条件。生产进程继续由 PM2 管理，384 MB old-space 只作为最后一道熔断保护，不能替代对象生命周期治理。

**Tech Stack:** TypeScript, Express, Vitest, Prisma, Redis, Multer, PM2, PowerShell.

---

### Task 1: 收敛进程内缓存的容量、TTL 和并发回源

**Files:**
- Modify: `server/services/cache.ts:1-540`
- Test: `tests/unit/cache-bounds.test.ts`
- Test: `tests/unit/cache-concurrency.test.ts`

- [x] **Step 1: Write the failing test**

在 `tests/unit/cache-concurrency.test.ts` 中验证同一 key 的并发请求只允许一次 fetcher，并在 fetcher 失败时不会留下未完成缓存：

```ts
it('coalesces concurrent misses without caching a rejected fetch', async () => {
  const { withCache, clearAllCaches, stopAllCacheCleanup } = await import('../../server/services/cache');
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    throw new Error('upstream unavailable');
  };

  try {
    await expect(Promise.all([
      withCache('test:coalesce', fetcher),
      withCache('test:coalesce', fetcher),
    ])).rejects.toThrow('upstream unavailable');
    expect(calls).toBe(1);
    await expect(withCache('test:coalesce', async () => 'ok')).resolves.toBe('ok');
  } finally {
    clearAllCaches();
    stopAllCacheCleanup();
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/cache-concurrency.test.ts`

Expected: FAIL because the current `withCache` starts one upstream fetch per concurrent miss.

- [x] **Step 3: Write minimal implementation**

在 `server/services/cache.ts` 增加 `pendingFetches: Map<string, Promise<unknown>>`，在 `withCache` 的 Redis miss 后先复用同 key Promise；以 `finally` 删除 map 项，成功时才写入内存和 Redis，失败时原样抛出。为 `ttl`、`maxSize` 做正整数归一化，拒绝 0、负数和非有限值，且仍受实例硬上限约束。

- [x] **Step 4: Run focused tests and existing cache tests**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/cache-concurrency.test.ts tests/unit/cache-bounds.test.ts tests/unit/probe-cache-bounds.test.ts`

Expected: all focused cache tests PASS with no worker warnings.

- [x] **Step 5: Refactor and verify static gates**

删除测试中的重复清理逻辑，保持导出的缓存 API 不变；运行 `npm run typecheck:server` 和 `npm run lint`，两者必须分别以 0 错误、0 warnings 结束。

### Task 2: 统一后台任务的启动/停止生命周期

**Files:**
- Modify: `server/services/memoryPressureService.ts`
- Modify: `server/services/cleanupService.ts`
- Modify: `server/services/notificationQueue.ts`
- Modify: `server/services/metricsService.ts`
- Modify: `server/routes/events.ts`
- Modify: `server/index.ts`
- Modify: `vitest.config.ts`
- Modify: `server/core/service-container.ts`
- Test: `tests/unit/cleanup-scheduler-lifecycle.test.ts`
- Test: `tests/unit/service-container-lifecycle.test.ts`
- Test: `tests/unit/service-lifecycle-cleanup-contract.test.ts`
- Test: `tests/unit/events-sse-lifecycle.test.ts`

- [x] **Step 1: Write the failing SSE lifecycle test**

断言连接关闭后轮询 timer 被清除，且不会继续向已关闭响应写入：

```ts
it('clears the event stream timer when the client disconnects', () => {
  const source = read('server/routes/events.ts');
  expect(source).toContain('req.on(\'close\'');
  expect(source).toMatch(/clearInterval\(timer\)/);
  expect(source).toContain('res.end()');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/events-sse-lifecycle.test.ts`

Expected: FAIL if the current event route does not clear its interval on request close.

- [x] **Step 3: Write minimal implementation**

在 `server/routes/events.ts` 让 `send` 在 `res.writableEnded` 或 `res.destroyed` 时直接返回；注册 `req.once('close', stop)`，由 `stop` 清除 interval、移除 close listener 并结束响应。所有进程级服务暴露幂等 `stop()`，`server/index.ts` 在 shutdown 顺序中统一调用并等待异步 flush。

- [x] **Step 4: Run lifecycle tests**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/service-lifecycle-cleanup-contract.test.ts tests/unit/events-sse-lifecycle.test.ts tests/unit/payment-polling-lifecycle.test.ts tests/unit/use-sse-lifecycle.test.ts`

Expected: all lifecycle tests PASS.

- [x] **Step 5: Run type and lint gates**

Run: `npm run typecheck:server` then `npm run lint`.

Expected: 0 errors and 0 warnings from both commands.

- [x] **Additional lifecycle closure: notification queue, cleanup scheduler, and service registry**

验证命令：

```text
npx vitest run --maxWorkers=1 --pool=threads --no-file-parallelism tests/unit/notification-queue.test.ts tests/unit/cleanup-scheduler-lifecycle.test.ts tests/unit/service-container-lifecycle.test.ts
```

结果：通知队列 9/9、清理调度器 2/2、ServiceRegistry 4/4 通过；ServiceRegistry 的 shutdown 失败会在完成其它服务清理后明确抛出失败服务名。

### Task 3: 将大文件上传从内存缓冲迁移为磁盘/R2 流程

**Files:**
- Modify: `server/routes/upload.ts`
- Modify: `server/services/uploadService.ts`
- Modify: `server/services/r2StorageService.ts`
- Modify: `server/middleware/upload.ts`
- Test: `tests/unit/legacy-upload-storage.test.ts`
- Test: `tests/unit/upload-storage-contract.test.ts`

- [ ] **Step 1: Write the failing upload-storage test**

断言生产上传配置不使用 `multer.memoryStorage()`，并且请求大小在 multipart 解析前受到限制：

```ts
it('does not buffer production uploads in process memory', () => {
  const source = read('server/routes/upload.ts');
  expect(source).not.toContain('multer.memoryStorage()');
  expect(source).toMatch(/limits\s*:\s*\{[\s\S]*fileSize/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/legacy-upload-storage.test.ts tests/unit/upload-storage-contract.test.ts`

Expected: FAIL on any remaining memory-storage upload path.

- [ ] **Step 3: Write minimal implementation**

统一使用受限的 disk storage 或流式 R2 uploader；上传控制器只接收临时文件路径/流，不把完整文件复制到 JSON、日志或缓存；成功和异常分支都删除临时文件。保留图片 MIME、扩展名、魔数和单文件大小校验。

- [ ] **Step 4: Run upload tests**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/legacy-upload-storage.test.ts tests/unit/upload-storage-contract.test.ts tests/unit/upload-archive-security.test.ts tests/unit/r2-storage-service.test.ts`

Expected: all upload-focused tests PASS.

- [ ] **Step 5: Run full static gates**

Run: `npm run typecheck:server` then `npm run lint`.

Expected: both PASS without relaxing compiler or lint rules.

### Task 4: 固化生产内存和磁盘保护的可验证配置

**Files:**
- Modify: `ecosystem.config.js`
- Modify: `ecosystem.config.cjs`
- Modify: `scripts/diagnose-memory.mjs`
- Modify: `scripts/cleanup-production-disk.ps1`
- Test: `tests/unit/pm2-memory-config.test.ts`
- Test: `tests/unit/diagnose-memory-script.test.ts`
- Test: `tests/unit/production-disk-cleanup-script.test.ts`

- [ ] **Step 1: Write failing configuration tests**

断言所有生产 PM2 app 都有 `--max-old-space-size=384`，诊断脚本能输出 heap snapshot/采样入口，磁盘清理默认只处理已确认的备份目录且保留最新可回滚包。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/pm2-memory-config.test.ts tests/unit/diagnose-memory-script.test.ts tests/unit/production-disk-cleanup-script.test.ts`

Expected: FAIL for each missing contract.

- [ ] **Step 3: Write minimal implementation**

将 PM2 参数和 heap sampling 命令写入正式运维脚本；清理脚本采用 dry-run 默认、显式目录白名单、按时间保留最新回滚包和明确的删除清单，不扫描或删除工作区根目录。

- [ ] **Step 4: Run operations tests**

Run: `npx vitest run --maxWorkers=2 --pool=threads --no-file-parallelism tests/unit/pm2-memory-config.test.ts tests/unit/diagnose-memory-script.test.ts tests/unit/production-disk-cleanup-script.test.ts`.

Expected: all PASS and destructive targets remain allowlisted.

- [ ] **Step 5: Final verification**

Run: `npm run typecheck:server`, `npm run lint`, `npm run test:intelligent-probe`, and the focused suites from Tasks 1–4.

Expected: existing gates remain green; live deployment and real browser acceptance are reported separately from local proof.

---

## Self-review

- Cache growth is bounded by TTL and hard capacity; concurrent misses are coalesced.
- SSE and process timers have explicit shutdown ownership.
- Uploads do not require holding a full large file in the Node heap.
- PM2 and disk cleanup protections are explicit, tested, and fail closed.
- No task changes compiler strictness, disables lint rules, or treats local tests as production acceptance.
