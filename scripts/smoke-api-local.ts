import { spawn } from 'node:child_process';
import net from 'node:net';
import crypto from 'node:crypto';

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
const DEFAULT_HOST = '127.0.0.1';
const EXPLICIT_BASE_PROVIDED = Boolean(
  process.env.SMOKE_API_BASE_URL || process.env.SMOKE_BASE_URL || process.env.API_PUBLIC_URL,
);
const DEFAULT_LOCAL_PORT = Number(process.env.SMOKE_LOCAL_PORT || 13000);
const DEFAULT_BASE =
  process.env.SMOKE_API_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  process.env.API_PUBLIC_URL ||
  `http://${DEFAULT_HOST}:${DEFAULT_LOCAL_PORT}`;
const STARTUP_TIMEOUT_MS = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 60000);
const POLL_INTERVAL_MS = 1500;
const PROCESS_EXIT_TIMEOUT_MS = Number(process.env.SMOKE_PROCESS_EXIT_TIMEOUT_MS || 5000);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeBase = (base: string) => base.replace(/\/+$/, '');
const buildBaseFromPort = (port: number) => `http://${DEFAULT_HOST}:${port}`;
const buildProbeHeaders = (base: string): Record<string, string> => ({
  accept: 'application/json',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  referer: `${normalizeBase(base)}/`,
  'user-agent': 'Mozilla/5.0 QianfuSmoke/1.0',
});
const waitForExit = (
  cp: ReturnType<typeof spawn>,
  timeoutMs = PROCESS_EXIT_TIMEOUT_MS,
): Promise<boolean> => {
  if (cp.exitCode !== null || cp.signalCode !== null) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout;
    const finish = (exited: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cp.off('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref();
    cp.once('exit', onExit);
  });
};
const terminateProcessTree = async (cp: ReturnType<typeof spawn>): Promise<void> => {
  if (cp.exitCode !== null || cp.signalCode !== null) return;
  if (process.platform === 'win32') {
    try {
      const killer = spawn('taskkill', ['/pid', String(cp.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      await waitForExit(killer);
      if (await waitForExit(cp)) return;
    } catch {
      // fallback to default kill below
    }
  }

  if (cp.exitCode === null && cp.signalCode === null) {
    cp.kill('SIGTERM');
    if (!(await waitForExit(cp))) {
      console.warn('[smoke:api:local] Managed server did not exit before the cleanup timeout.');
    }
  }
};

const isPortAvailable = (port: number, host = DEFAULT_HOST): Promise<boolean> =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });

const findEphemeralPort = (host = DEFAULT_HOST): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to resolve ephemeral port')));
        return;
      }
      const { port } = address;
      server.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        resolve(port);
      });
    });
  });

const resolveLocalPort = async (preferredPort: number): Promise<number> => {
  if (await isPortAvailable(preferredPort)) return preferredPort;
  return findEphemeralPort();
};

const buildCandidateBases = (primaryBase: string): string[] => {
  const envCandidates = [
    process.env.SMOKE_API_BASE_URL,
    process.env.SMOKE_BASE_URL,
    process.env.API_PUBLIC_URL,
  ].filter(Boolean) as string[];

  if (!EXPLICIT_BASE_PROVIDED) {
    return [normalizeBase(primaryBase)];
  }

  const defaults = [DEFAULT_BASE, 'http://127.0.0.1:3000', 'http://localhost:3000'];
  return [...new Set([normalizeBase(primaryBase), ...envCandidates.map(normalizeBase), ...defaults.map(normalizeBase)])];
};

const probeHealth = async (base: string): Promise<boolean> => {
  for (const p of HEALTH_PATHS) {
    try {
      const res = await fetch(`${normalizeBase(base)}${p}`, {
        headers: buildProbeHeaders(base),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return true;
    } catch {
      // ignore and continue probing
    }
  }
  return false;
};

async function checkEndpoint(
  name: string,
  paths: string[],
  bases: string[],
  allowedStatusCodes: number[] = [200],
): Promise<CheckResult> {
  const attempts: ProbeAttempt[] = [];

  for (const base of bases) {
    for (const path of paths) {
      const url = `${base}${path}`;
      try {
        const res = await fetch(url, {
          headers: buildProbeHeaders(base),
        });
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

async function runSmokeChecksAgainstBase(base: string): Promise<number> {
  const bases = buildCandidateBases(base);
  const allowReady503 = process.env.SMOKE_ALLOW_READY_503 !== 'false';

  const checks = await Promise.all([
    checkEndpoint('health', ['/api/health', '/health'], bases),
    checkEndpoint('ready', ['/api/ready'], bases, allowReady503 ? [200, 503] : [200]),
    checkEndpoint('public-servers', [
      '/api/public/servers?page=1&limit=5',
      '/api/v1/public/servers?page=1&limit=5',
    ], bases),
  ]);

  let failed = 0;
  console.log('[smoke:api:local] Candidate bases:', bases.join(', '));
  console.log('[smoke:api:local] Results:');
  for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}: ${c.detail}`);
  }
  return failed;
}

const run = async (): Promise<number> => {
  const localPort = EXPLICIT_BASE_PROVIDED
    ? null
    : await resolveLocalPort(DEFAULT_LOCAL_PORT);
  const base = normalizeBase(
    EXPLICIT_BASE_PROVIDED ? DEFAULT_BASE : buildBaseFromPort(localPort as number),
  );

  if (!EXPLICIT_BASE_PROVIDED && localPort !== DEFAULT_LOCAL_PORT) {
    console.warn(
      `[smoke:api:local] Port ${DEFAULT_LOCAL_PORT} is busy, falling back to ${localPort}.`
    );
  }

  console.log(`[smoke:api:local] Probing ${base}`);

  const runWithSpawnedServer = async (): Promise<number> => {
    const spawnEnv: NodeJS.ProcessEnv = EXPLICIT_BASE_PROVIDED
      ? process.env
      : {
          ...process.env,
          PORT: String(localPort),
          API_PUBLIC_URL: base,
          // The smoke server runs with production checks enabled. Keep its
          // signing keys ephemeral and isolated from real wallet data.
          WALLET_SECRET: process.env.WALLET_SECRET || crypto.randomBytes(32).toString('hex'),
          MODERATION_ENCRYPTION_KEY: process.env.MODERATION_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'),
        };

    const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], {
      stdio: 'inherit',
      env: spawnEnv,
      windowsHide: true,
    });

    let serverExited = false;
    let cleanupRequested = false;
    server.on('exit', (code, signal) => {
      serverExited = true;
      if (!cleanupRequested) {
        console.error(`[smoke:api:local] Server process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`);
      }
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
        const failed = await runSmokeChecksAgainstBase(base);
        cleanupRequested = true;
        await terminateProcessTree(server);
        return failed > 0 ? 1 : 0;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    cleanupRequested = true;
    await terminateProcessTree(server);
    console.error(`[smoke:api:local] API did not become healthy within ${STARTUP_TIMEOUT_MS}ms at ${base}.`);
    return 1;
  };

  // If API is already up, run smoke checks directly.
  if (await probeHealth(base)) {
    console.log('[smoke:api:local] API already healthy, running smoke checks.');
    const failed = await runSmokeChecksAgainstBase(base);
    if (failed === 0) return 0;
    // Existing process might be stale/flaky; retry with a managed child process.
    console.warn('[smoke:api:local] Existing API failed smoke checks, retrying with managed local server.');
    return runWithSpawnedServer();
  }

  return runWithSpawnedServer();
};

run().catch((err) => {
  console.error('[smoke:api:local] Unexpected error:', err);
  return 1;
}).then((code: number | void) => {
  process.exitCode = typeof code === 'number' ? code : 1;
});
