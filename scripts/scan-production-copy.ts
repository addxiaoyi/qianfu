import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type CheckResult = {
  path: string;
  keyword: string;
  found: boolean;
};

const BASE_URL = (process.env.SMOKE_WEB_BASE_URL || 'https://mc-u.top').replace(/\/+$/, '');
const REPORT_PATH =
  process.env.SMOKE_REPORT_PATH ||
  `logs/scan-production-copy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const ROUTES = ['/', '/#/mobile', '/#/login', '/#/register', '/#/dashboard', '/#/payment', '/#/rules'];
const KEYWORDS = [
  'BROADCAST',
  'Matrix',
  'Node_Alpha',
  'ACTIVITY_LOGS',
  'MU Alliance',
  'Discord Community',
  'QianFu API',
  'Signal Board',
  'Quick Relay',
  'Hero_Matrix',
];

async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(20_000),
  });
  return {
    status: res.status,
    ok: res.ok,
    text: await res.text(),
  };
}

async function main() {
  const results: CheckResult[] = [];

  for (const route of ROUTES) {
    const url = route.startsWith('http') ? route : `${BASE_URL}${route}`;
    const page = await fetchPage(url);
    const text = page.text;
    for (const keyword of KEYWORDS) {
      results.push({
        path: route,
        keyword,
        found: page.ok && text.includes(keyword),
      });
    }
  }

  const found = results.filter((item) => item.found);
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: ROUTES,
    keywords: KEYWORDS,
    results,
    foundCount: found.length,
  };

  const fullReportPath = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(fullReportPath), { recursive: true });
  writeFileSync(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[scan:copy] Base URL: ${BASE_URL}`);
  for (const item of found) {
    console.log(`- FOUND ${item.keyword} @ ${item.path}`);
  }
  console.log(`[scan:copy] Report written to: ${fullReportPath}`);

  if (found.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[scan:copy] Unexpected error:', error);
  process.exit(1);
});
