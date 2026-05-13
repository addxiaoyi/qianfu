import { spawn } from 'node:child_process';

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

type ProbeAttempt = {
  url: string;
  detail: string;
};

const HEALTH_PATHS = ['/api/health', '/health'];
const DEFAULT_BASE =
  process.env.SMOKE_API_BASE_URL || process.env.SMOKE_BASE_URL || process.env.API_PUBLIC_URL || 'http://127.0.0.1:3000';
const STARTUP_TIMEOUT_MS = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 60000);
const POLL_INTERVAL_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeBase = (base: string) => base.replace(/\/+$/, '');
const waitForExit = (cp: ReturnType<typeof spawn>) =>
  new Promise<void>((resolve) => {
    cp.once('exit', () => resolve());
  });

const buildCandidateBases = (): string[] => {
  const envCandidates = [
    process.env.SMOKE_API_BASE_URL,
    process.env.SMOKE_BASE_URL,
    process.env.API_PUBLIC_URL,
  ].filter(Boolean) as string[];

  const defaults = [DEFAULT_BASE, 'http://127.0.0.1:3000', 'http://localhost:3000'];
  return [...new Set([...envCandidates.map(normalizeBase), ...defaults.map(normalizeBase)])];
};

const probeHealth = async (base: string): Promise<boolean> => {
  for (const p of HEALTH_PATHS) {
    try {
      const res = await fetch(`${normalizeBase(base)}${p}`);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return true;
    } catch {
      // ignore and continue probing
    }
  }
  return false;
};

async function checkEndpoint(name: string, paths: string[], allowedStatusCodes: number[] = [200]): Promise<CheckResult> {
  const bases = buildCandidateBases();
  const attempts: ProbeAttempt[] = [];

  for (const base of bases) {
    for (const path of paths) {
      const url = `${base}${path}`;
      try {
        const res = await fetch(url);
        if (!allowedStatusCodes.includes(res.status)) {
          attempts.push({ url, detail: `HTTP ${res.status}` });
          continue;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          attempts.push({ url, detail: `Unexpected content-type: ${contentType}` });
          continue;
        }

        await res.json();
        return { name, ok: true, detail: `OK (${url}, HTTP ${res.status})` };
      } catch (error) {
        attempts.push({
          url,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const summary = attempts.slice(0, 4).map((a) => `${a.url} -> ${a.detail}`).join(' | ');
  return { name, ok: false, detail: summary || 'No reachable endpoint' };
}

async function runSmokeChecks(): Promise<number> {
  const allowReady503 = process.env.SMOKE_ALLOW_READY_503 !== 'false';

  const checks = await Promise.all([
    checkEndpoint('health', ['/api/health', '/health']),
    checkEndpoint('ready', ['/api/ready'], allowReady503 ? [200, 503] : [200]),
    checkEndpoint('public-servers', [
      '/api/public/servers?page=1&limit=5',
      '/api/v1/public/servers?page=1&limit=5',
    ]),
  ]);

  let failed = 0;
  console.log('[smoke:api:local] Candidate bases:', buildCandidateBases().join(', '));
  console.log('[smoke:api:local] Results:');
  for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}: ${c.detail}`);
  }
  return failed;
}

const run = async (): Promise<number> => {
  const base = normalizeBase(DEFAULT_BASE);
  console.log(`[smoke:api:local] Probing ${base}`);

  // If API is already up, just run smoke checks directly.
  if (await probeHealth(base)) {
    console.log('[smoke:api:local] API already healthy, running smoke checks.');
    const failed = await runSmokeChecks();
    return failed > 0 ? 1 : 0;
  }

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const server = spawn(npxCommand, ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  let serverExited = false;
  server.on('exit', (code, signal) => {
    serverExited = true;
    console.error(`[smoke:api:local] Server process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
  });
  server.on('error', (err) => {
    console.error('[smoke:api:local] Failed to start local API server:', err);
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (serverExited) {
      console.error('[smoke:api:local] Server exited before becoming healthy.');
      return 1;
    }

    if (await probeHealth(base)) {
      console.log('[smoke:api:local] API became healthy, running smoke checks.');
      const failed = await runSmokeChecks();
      if (!server.killed) {
        server.kill('SIGTERM');
        await waitForExit(server);
      }
      return failed > 0 ? 1 : 0;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  if (!server.killed) {
    server.kill('SIGTERM');
    await waitForExit(server);
  }
  console.error(`[smoke:api:local] API did not become healthy within ${STARTUP_TIMEOUT_MS}ms at ${base}.`);
  return 1;
};

run().catch((err) => {
  console.error('[smoke:api:local] Unexpected error:', err);
  return 1;
}).then((code: number | void) => {
  process.exitCode = typeof code === 'number' ? code : 1;
});
