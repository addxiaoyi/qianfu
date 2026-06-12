import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
  status?: number;
};

const BASE_URL = (process.env.SMOKE_WEB_BASE_URL || 'https://mc-u.top').replace(/\/+$/, '');
const LOGIN_IDENTIFIER = process.env.SMOKE_LOGIN_IDENTIFIER || 'dev_local';
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || 'dev123456';
const REPORT_PATH =
  process.env.SMOKE_REPORT_PATH ||
  `logs/smoke-web-flows-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const browserHeaders: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="136", "Not.A/Brand";v="99", "Google Chrome";v="136"',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

async function fetchText(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...browserHeaders,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.text();
  return { res, body };
}

async function main() {
  const results: CheckResult[] = [];

  const root = await fetchText(BASE_URL);
  results.push({
    name: 'root-html',
    ok: root.res.ok && root.body.includes('<div id="root"></div>'),
    status: root.res.status,
    detail: root.res.ok ? 'Root HTML loaded' : `HTTP ${root.res.status}`,
  });

  const oauthStatus = await fetchText(`${BASE_URL}/api/v1/auth/oauth-status`);
  let oauthJson: any = null;
  try {
    oauthJson = JSON.parse(oauthStatus.body);
  } catch {
    oauthJson = null;
  }
  results.push({
    name: 'oauth-status',
    ok: oauthStatus.res.ok && oauthJson?.providers?.github?.backendEnabled === true,
    status: oauthStatus.res.status,
    detail: oauthJson?.providers?.github?.loginUrl || oauthStatus.body.slice(0, 160),
  });

  const githubStart = await fetchText(`${BASE_URL}/api/v1/auth/github/start`, {
    redirect: 'manual',
  });
  results.push({
    name: 'github-start',
    ok:
      githubStart.res.status === 302 &&
      (githubStart.res.headers.get('location') || githubStart.body).includes('github.com/login/oauth/authorize'),
    status: githubStart.res.status,
    detail: githubStart.res.headers.get('location') || githubStart.body.slice(0, 200),
  });

  const githubCallbackError = await fetchText(
    `${BASE_URL}/api/v1/auth/github/callback?error=access_denied&error_description=smoke-test`,
    {
      redirect: 'manual',
    },
  );
  results.push({
    name: 'github-callback-error-redirect',
    ok:
      githubCallbackError.res.status === 302 &&
      (githubCallbackError.res.headers.get('location') || githubCallbackError.body).includes('#/oauth/callback/github'),
    status: githubCallbackError.res.status,
    detail: githubCallbackError.res.headers.get('location') || githubCallbackError.body.slice(0, 200),
  });

  const login = await fetchText(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: LOGIN_IDENTIFIER,
      password: LOGIN_PASSWORD,
    }),
  });
  let loginJson: any = null;
  try {
    loginJson = JSON.parse(login.body);
  } catch {
    loginJson = null;
  }
  const token = loginJson?.data?.token || '';
  results.push({
    name: 'password-login',
    ok: login.res.ok && Boolean(token) && Boolean(loginJson?.data?.user),
    status: login.res.status,
    detail: loginJson?.message || login.body.slice(0, 160),
  });

  const authedHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const profile = await fetchText(`${BASE_URL}/api/v1/profile`, {
    headers: authedHeaders,
  });
  let profileJson: any = null;
  try {
    profileJson = JSON.parse(profile.body);
  } catch {
    profileJson = null;
  }
  results.push({
    name: 'profile',
    ok: profile.res.ok && Boolean(profileJson?.data?.email || profileJson?.data?.username),
    status: profile.res.status,
    detail: profileJson?.data?.username || profile.body.slice(0, 160),
  });

  const mailConfig = await fetchText(`${BASE_URL}/api/v1/admin/mail-config`, {
    headers: authedHeaders,
  });
  let mailConfigJson: any = null;
  try {
    mailConfigJson = JSON.parse(mailConfig.body);
  } catch {
    mailConfigJson = null;
  }
  results.push({
    name: 'mail-config',
    ok: mailConfig.res.ok && Boolean(mailConfigJson?.data?.config?.smtpHost),
    status: mailConfig.res.status,
    detail: mailConfigJson?.data?.config?.smtpHost || mailConfig.body.slice(0, 160),
  });

  const mailLibrary = await fetchText(`${BASE_URL}/api/v1/admin/mail-config/library`, {
    headers: authedHeaders,
  });
  let mailLibraryJson: any = null;
  try {
    mailLibraryJson = JSON.parse(mailLibrary.body);
  } catch {
    mailLibraryJson = null;
  }
  results.push({
    name: 'mail-library',
    ok:
      mailLibrary.res.ok &&
      Array.isArray(mailLibraryJson?.data?.templates) &&
      Array.isArray(mailLibraryJson?.data?.recipientGroups) &&
      Array.isArray(mailLibraryJson?.data?.schedules),
    status: mailLibrary.res.status,
    detail: `templates=${mailLibraryJson?.data?.templates?.length ?? 'n/a'} groups=${mailLibraryJson?.data?.recipientGroups?.length ?? 'n/a'} schedules=${mailLibraryJson?.data?.schedules?.length ?? 'n/a'}`,
  });

  const paymentProjects = await fetchText(`${BASE_URL}/api/v1/admin/payment-projects`, {
    headers: authedHeaders,
  });
  let paymentProjectsJson: any = null;
  try {
    paymentProjectsJson = JSON.parse(paymentProjects.body);
  } catch {
    paymentProjectsJson = null;
  }
  results.push({
    name: 'payment-projects',
    ok: paymentProjects.res.ok && Array.isArray(paymentProjectsJson?.data?.projects),
    status: paymentProjects.res.status,
    detail: `projects=${paymentProjectsJson?.data?.projects?.length ?? 'n/a'}`,
  });

  const userPayments = await fetchText(`${BASE_URL}/api/v1/payment/my?page=1&limit=5`, {
    headers: authedHeaders,
  });
  let userPaymentsJson: any = null;
  try {
    userPaymentsJson = JSON.parse(userPayments.body);
  } catch {
    userPaymentsJson = null;
  }
  results.push({
    name: 'payment-my',
    ok: userPayments.res.ok && Boolean(userPaymentsJson?.success),
    status: userPayments.res.status,
    detail: userPaymentsJson?.message || userPayments.body.slice(0, 160),
  });

  const qiuPayHealth = await fetchText('http://mc-u.top:8001/health');
  results.push({
    name: 'qiupay-health',
    ok: qiuPayHealth.res.ok && qiuPayHealth.body.includes('"status":"ok"'),
    status: qiuPayHealth.res.status,
    detail: qiuPayHealth.body.trim(),
  });

  const failed = results.filter((item) => !item.ok);
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    results,
    failedCount: failed.length,
  };

  const fullReportPath = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(fullReportPath), { recursive: true });
  writeFileSync(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[smoke:web] Base URL: ${BASE_URL}`);
  for (const result of results) {
    console.log(`- ${result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.detail}`);
  }
  console.log(`[smoke:web] Report written to: ${fullReportPath}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[smoke:web] Unexpected error:', error);
  process.exit(1);
});
