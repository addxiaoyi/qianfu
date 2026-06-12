import { execFile as execFileCallback } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

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
  let skipFrontendFreshness = false;

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
    if (args[i] === '--skip-frontend-freshness') {
      skipFrontendFreshness = true;
      continue;
    }
  }

  return { cliBase, strictReady, skipFrontendFreshness };
}

function buildCandidateBases(cliBase?: string): string[] {
  const envCandidates = [
    cliBase,
    process.env.SMOKE_API_BASE_URL,
    process.env.SMOKE_BASE_URL,
    process.env.API_PUBLIC_URL,
  ].filter(Boolean) as string[];

  const defaults = ['http://127.0.0.1:3000', 'http://localhost:3000'];
  if (envCandidates.length > 0) {
    return [...new Set(envCandidates.map(normalizeBase))];
  }

  return [...new Set(defaults.map(normalizeBase))];
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

function truncateText(text: string, max = 180): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function parseKv(text: string) {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    values[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1);
  }
  return values;
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

async function checkFrontendFreshness(cliBase?: string): Promise<CheckResult> {
  const frontendBase = normalizeBase(
    cliBase ||
      process.env.SMOKE_API_BASE_URL ||
      process.env.SMOKE_WEB_BASE_URL ||
      process.env.QIANFU_BASE_URL ||
      process.env.SMOKE_BASE_URL ||
      'https://mc-u.top',
  );
  const tsxCliPath = resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');

  try {
    if (!existsSync(tsxCliPath)) {
      throw new Error(`tsx cli not found at ${tsxCliPath}`);
    }

    const { stdout } = await execFile(
      process.execPath,
      [tsxCliPath, 'scripts/probe-frontend-deploy.ts', '--report-only', '--kv', '--base', frontendBase],
      {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024,
      },
    );
    const values = parseKv(stdout);
    const remoteUrl = values.remote_url || `${frontendBase}/`;
    const remoteStatus = Number(values.remote_root_status || '0');
    const attempts: ProbeAttempt[] = [
      {
        url: remoteUrl,
        ok: true,
        status: Number.isFinite(remoteStatus) && remoteStatus > 0 ? remoteStatus : undefined,
        detail: `remoteBundle=${values.remote_bundle || 'unknown'} localBundle=${values.local_bundle || 'unknown'} assets=${values.asset_content_match || 'unknown'}`,
      },
    ];

    if (values.remote_root_status !== '200') {
      return {
        name: 'frontend-freshness',
        ok: false,
        optional: false,
        status: remoteStatus || undefined,
        detail: `Frontend root ${remoteUrl} returned HTTP ${values.remote_root_status || 'unknown'}`,
        attempts,
      };
    }

    if (values.bundle_match === 'false') {
      return {
        name: 'frontend-freshness',
        ok: false,
        optional: false,
        status: remoteStatus || undefined,
        detail: `Remote bundle ${values.remote_bundle || 'unknown'} does not match local build ${values.local_bundle || 'unknown'}`,
        attempts,
      };
    }

    if (values.remote_legacy_hash_markers && values.remote_legacy_hash_markers !== 'none') {
      return {
        name: 'frontend-freshness',
        ok: false,
        optional: false,
        status: remoteStatus || undefined,
        detail: `Remote HTML still contains legacy hash-route markers: ${values.remote_legacy_hash_markers}`,
        attempts,
      };
    }

    if (values.search_target_match === 'false') {
      return {
        name: 'frontend-freshness',
        ok: false,
        optional: false,
        status: remoteStatus || undefined,
        detail: `Remote SearchAction target ${values.remote_search_target || 'unknown'} does not match local build ${values.local_search_target || 'unknown'}`,
        attempts,
      };
    }

    if (values.asset_reference_match === 'false') {
      return {
        name: 'frontend-freshness',
        ok: false,
        optional: false,
        status: remoteStatus || undefined,
        detail: 'Remote entry asset references do not match the local dist build',
        attempts,
      };
    }

    if (values.asset_content_match === 'false') {
      return {
        name: 'frontend-freshness',
        ok: false,
        optional: false,
        status: remoteStatus || undefined,
        detail: `Remote entry assets are missing or different: ${values.missing_or_mismatched_assets || 'unknown'}`,
        attempts,
      };
    }

    return {
      name: 'frontend-freshness',
      ok: true,
      optional: false,
      status: remoteStatus || undefined,
      detail: `Frontend root and entry assets match current build (${values.local_bundle || values.remote_bundle || 'unknown'})`,
      attempts,
    };
  } catch (error) {
    const stdout = typeof error === 'object' && error && 'stdout' in error ? String((error as { stdout?: string }).stdout || '') : '';
    return {
      name: 'frontend-freshness',
      ok: false,
      optional: false,
      detail: stdout ? `${error instanceof Error ? error.message : String(error)} | ${stdout}` : error instanceof Error ? error.message : String(error),
      attempts: [{ url: frontendBase, ok: false, detail: error instanceof Error ? error.message : String(error) }],
    };
  }
}

async function main() {
  const { cliBase, strictReady, skipFrontendFreshness } = parseArgs();
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
  if (!skipFrontendFreshness) {
    results.push(await checkFrontendFreshness(cliBase));
  }
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
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[smoke:deploy] Unexpected error:', error);
  process.exitCode = 1;
});
