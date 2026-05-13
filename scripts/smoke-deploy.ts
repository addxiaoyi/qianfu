import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type EndpointCheck = {
  name: string;
  paths: string[];
  allowedStatusCodes?: number[];
  requireJson?: boolean;
  optional?: boolean;
};

type ProbeAttempt = {
  url: string;
  ok: boolean;
  detail: string;
  status?: number;
};

type CheckResult = {
  name: string;
  ok: boolean;
  optional: boolean;
  passedUrl?: string;
  status?: number;
  detail: string;
  attempts: ProbeAttempt[];
};

const normalizeBase = (base: string) => base.replace(/\/+$/, '');

function parseArgs() {
  const args = process.argv.slice(2);
  let cliBase: string | undefined;
  let strictReady = process.env.SMOKE_READY_STRICT === '1';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) {
      cliBase = args[i + 1];
      i++;
      continue;
    }
    if (args[i] === '--strict-ready') {
      strictReady = true;
      continue;
    }
  }

  return { cliBase, strictReady };
}

function buildCandidateBases(cliBase?: string): string[] {
  const envCandidates = [
    cliBase,
    process.env.SMOKE_API_BASE_URL,
    process.env.SMOKE_BASE_URL,
    process.env.API_PUBLIC_URL,
  ].filter(Boolean) as string[];

  const defaults = ['http://127.0.0.1:3000', 'http://localhost:3000'];
  return [...new Set([...envCandidates.map(normalizeBase), ...defaults])];
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

function truncateText(text: string, max = 180): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

async function checkEndpoint(check: EndpointCheck, bases: string[]): Promise<CheckResult> {
  const allowed = check.allowedStatusCodes ?? [200];
  const requireJson = check.requireJson ?? true;
  const attempts: ProbeAttempt[] = [];

  for (const base of bases) {
    for (const path of check.paths) {
      const url = `${base}${path}`;
      try {
        const res = await fetchWithTimeout(url);
        const contentType = res.headers.get('content-type') || '';
        const body = await res.text();
        const preview = truncateText(body);

        if (!allowed.includes(res.status)) {
          attempts.push({
            url,
            ok: false,
            status: res.status,
            detail: `HTTP ${res.status}; body=${preview}`,
          });
          continue;
        }

        if (requireJson && !contentType.includes('application/json')) {
          attempts.push({
            url,
            ok: false,
            status: res.status,
            detail: `Unexpected content-type=${contentType || 'unknown'}; body=${preview}`,
          });
          continue;
        }

        return {
          name: check.name,
          ok: true,
          optional: Boolean(check.optional),
          passedUrl: url,
          status: res.status,
          detail: `OK (${url}, HTTP ${res.status})`,
          attempts,
        };
      } catch (error) {
        attempts.push({
          url,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const detail = attempts.length
    ? attempts.slice(0, 4).map((a) => `${a.url} -> ${a.detail}`).join(' | ')
    : 'No attempt was made';

  return {
    name: check.name,
    ok: false,
    optional: Boolean(check.optional),
    detail,
    attempts,
  };
}

async function main() {
  const { cliBase, strictReady } = parseArgs();
  const bases = buildCandidateBases(cliBase);

  const checks: EndpointCheck[] = [
    {
      name: 'health',
      paths: ['/api/health', '/health'],
      allowedStatusCodes: [200],
      requireJson: true,
    },
    {
      name: 'ready',
      paths: ['/api/ready'],
      allowedStatusCodes: strictReady ? [200] : [200, 503],
      requireJson: true,
    },
    {
      name: 'oauth-status',
      paths: ['/api/auth/oauth-status'],
      allowedStatusCodes: [200],
      requireJson: true,
      optional: true,
    },
    {
      name: 'public-servers',
      paths: ['/api/v1/public/servers?page=1&limit=5', '/api/public/servers?page=1&limit=5'],
      allowedStatusCodes: [200],
      requireJson: true,
    },
    {
      name: 'profile-unauth',
      paths: ['/api/v1/profile'],
      allowedStatusCodes: [401],
      requireJson: false,
      optional: true,
    },
    {
      name: 'payment-my-unauth',
      paths: ['/api/v1/payment/my'],
      allowedStatusCodes: [401],
      requireJson: false,
      optional: true,
    },
    {
      name: 'wallet-unauth',
      paths: ['/api/v1/wallet'],
      allowedStatusCodes: [401],
      requireJson: false,
      optional: true,
    },
  ];

  const results = await Promise.all(checks.map((check) => checkEndpoint(check, bases)));
  const failedRequired = results.filter((r) => !r.ok && !r.optional);
  const failedOptional = results.filter((r) => !r.ok && r.optional);

  const report = {
    timestamp: new Date().toISOString(),
    strictReady,
    candidateBases: bases,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.ok).length,
      failedRequired: failedRequired.length,
      failedOptional: failedOptional.length,
    },
    results,
  };

  const reportPath = resolve(
    process.cwd(),
    process.env.SMOKE_REPORT_PATH || `logs/smoke-deploy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[smoke:deploy] Candidate bases:', bases.join(', '));
  for (const result of results) {
    const marker = result.ok ? 'PASS' : result.optional ? 'WARN' : 'FAIL';
    console.log(`- ${marker} ${result.name}: ${result.detail}`);
  }
  console.log(`[smoke:deploy] Report written to: ${reportPath}`);

  if (failedRequired.length > 0) {
    console.error(`[smoke:deploy] Required checks failed: ${failedRequired.map((r) => r.name).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[smoke:deploy] Unexpected error:', error);
  process.exit(1);
});

