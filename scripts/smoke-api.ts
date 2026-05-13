type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

type ProbeAttempt = {
  url: string;
  ok: boolean;
  detail: string;
};

type EndpointCheckOptions = {
  allowedStatusCodes?: number[];
  requireJson?: boolean;
};

const normalizeBase = (base: string) => base.replace(/\/+$/, '');

const buildCandidateBases = (): string[] => {
  // 优先使用显式 API 地址，避免误把前端域名当作 API 目标导致命中 HTML fallback。
  const envCandidates = [
    process.env.SMOKE_API_BASE_URL,
    process.env.SMOKE_BASE_URL,
    process.env.API_PUBLIC_URL,
  ].filter(Boolean) as string[];

  const defaults = ['http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:4123'];
  return [...new Set([...envCandidates.map(normalizeBase), ...defaults])];
};

async function checkEndpoint(name: string, paths: string[], options: EndpointCheckOptions = {}): Promise<CheckResult> {
  const bases = buildCandidateBases();
  const attempts: ProbeAttempt[] = [];
  const allowedStatusCodes = options.allowedStatusCodes ?? [200];
  const requireJson = options.requireJson ?? true;

  for (const base of bases) {
    for (const path of paths) {
      const url = `${base}${path}`;
      try {
        const res = await fetch(url);
        if (!allowedStatusCodes.includes(res.status)) {
          attempts.push({ url, ok: false, detail: `HTTP ${res.status}` });
          continue;
        }

        if (requireJson) {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            attempts.push({ url, ok: false, detail: `Unexpected content-type: ${contentType}` });
            continue;
          }
          await res.json();
        }

        return { name, ok: true, detail: `OK (${url}, HTTP ${res.status})` };
      } catch (error) {
        attempts.push({
          url,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const firstFew = attempts.slice(0, 4).map((a) => `${a.url} -> ${a.detail}`).join(' | ');
  const overflow = attempts.length > 4 ? ` | ... +${attempts.length - 4} more` : '';
  return {
    name,
    ok: false,
    detail: `No matching endpoint. Attempts: ${firstFew}${overflow}`,
  };
}

async function main() {
  const allowReady503 = process.env.SMOKE_ALLOW_READY_503 !== 'false';

  const checks = await Promise.all([
    checkEndpoint('health', ['/api/health', '/health']),
    checkEndpoint('ready', ['/api/ready'], {
      allowedStatusCodes: allowReady503 ? [200, 503] : [200],
      requireJson: true,
    }),
    checkEndpoint('public-servers', [
      '/api/public/servers?page=1&limit=5',
      '/api/v1/public/servers?page=1&limit=5',
    ]),
  ]);

  let failed = 0;
  console.log('[smoke:api] Candidate bases:', buildCandidateBases().join(', '));
  console.log('[smoke:api] Results:');
  for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}: ${c.detail}`);
  }

  if (failed > 0) {
    console.error(`[smoke:api] ${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log('[smoke:api] All checks passed.');
}

main();
