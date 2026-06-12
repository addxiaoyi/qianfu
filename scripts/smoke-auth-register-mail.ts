import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import crypto from 'node:crypto';

type Status = 'PASS' | 'FAIL' | 'WARN';

type Check = {
  name: string;
  status: Status;
  detail: string;
  code?: number;
};

type ApiResponse<T = any> = {
  status: number;
  ok: boolean;
  data: T | null;
  text: string;
  headers: Headers;
};

type SessionState = {
  cookie: string;
};

const BASE_URL = (process.env.SMOKE_WEB_BASE_URL || 'https://mc-u.top').replace(/\/+$/, '');
const LOGIN_IDENTIFIER = process.env.SMOKE_LOGIN_IDENTIFIER || 'dev_local';
const LOGIN_PASSWORD = process.env.SMOKE_LOGIN_PASSWORD || 'dev123456';
const REGISTER_EMAIL_DOMAIN = process.env.SMOKE_REGISTER_EMAIL_DOMAIN || 'example.com';
const REPORT_PATH =
  process.env.SMOKE_REPORT_PATH ||
  `logs/smoke-auth-register-mail-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const browserHeaders: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="136", "Not.A/Brand";v="99", "Google Chrome";v="136"',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

function mergeCookies(existing: string, setCookie: string | null): string {
  if (!setCookie) return existing;
  const incoming = setCookie
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((cookiePart) => cookiePart.split(';')[0])
    .filter(Boolean);
  const currentMap = new Map<string, string>();
  if (existing) {
    for (const part of existing.split(';')) {
      const segment = part.trim();
      if (!segment) continue;
      const idx = segment.indexOf('=');
      if (idx <= 0) continue;
      currentMap.set(segment.slice(0, idx), segment.slice(idx + 1));
    }
  }
  for (const item of incoming) {
    const idx = item.indexOf('=');
    if (idx <= 0) continue;
    currentMap.set(item.slice(0, idx), item.slice(idx + 1));
  }
  return Array.from(currentMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function requestJson(
  path: string,
  init: RequestInit = {},
  session?: SessionState,
): Promise<ApiResponse<any>> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const mergedHeaders: Record<string, string> = {
    ...(browserHeaders as Record<string, string>),
    ...((init.headers || {}) as Record<string, string>),
  };
  if (session?.cookie) {
    mergedHeaders.Cookie = session.cookie;
  }
  const res = await fetch(url, {
    ...init,
    headers: mergedHeaders,
    signal: AbortSignal.timeout(20_000),
  });
  if (session) {
    const setCookie =
      (res.headers as any).getSetCookie?.().join(',') ||
      res.headers.get('set-cookie');
    session.cookie = mergeCookies(session.cookie, setCookie);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return {
    status: res.status,
    ok: res.ok,
    data,
    text,
    headers: res.headers,
  };
}

function safeMsg(resp: ApiResponse<any>): string {
  const candidates = [
    resp.data?.error?.detail,
    resp.data?.error?.message,
    resp.data?.error?.rawMessage,
    resp.data?.detail,
    resp.data?.message,
    resp.data?.data?.message,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  const message = candidates[0] || resp.text.slice(0, 180) || `HTTP ${resp.status}`;
  return `HTTP ${resp.status} ${message}`;
}

function compactJson(value: unknown, maxLength = 260): string {
  if (value == null) return '';
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return '';
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}...` : serialized;
  } catch {
    return '';
  }
}

function add(checks: Check[], name: string, status: Status, detail: string, code?: number) {
  checks.push({ name, status, detail, code });
}

function randomSuffix() {
  return crypto.randomBytes(4).toString('hex');
}

async function main() {
  const checks: Check[] = [];
  const session: SessionState = { cookie: '' };
  const now = Date.now();
  const email = `smoke_${now}_${randomSuffix()}@${REGISTER_EMAIL_DOMAIN}`;
  const username = `smoke_${now.toString().slice(-8)}_${randomSuffix()}`.slice(0, 28);
  const password = `Sm0ke_${randomSuffix()}_A1`;

  const oauthStatus = await requestJson('/api/v1/auth/oauth-status', {}, session);
  const oauthEnabled = oauthStatus.ok && oauthStatus.data?.providers?.github?.backendEnabled === true;
  add(
    checks,
    'oauth-status',
    oauthEnabled ? 'PASS' : 'FAIL',
    oauthEnabled ? 'GitHub OAuth backend enabled' : safeMsg(oauthStatus),
    oauthStatus.status,
  );

  const login = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: LOGIN_IDENTIFIER,
      password: LOGIN_PASSWORD,
    }),
  }, session);
  const token = login.data?.data?.token || '';
  const loginOk = login.ok && typeof token === 'string' && token.length > 0;
  add(
    checks,
    'password-login',
    loginOk ? 'PASS' : 'FAIL',
    loginOk ? 'Login successful' : safeMsg(login),
    login.status,
  );

  let csrfToken = '';
  const csrf = await requestJson('/api/v1/csrf-token', {}, session);
  if (csrf.ok) {
    csrfToken = csrf.data?.data?.csrfToken || csrf.data?.csrfToken || '';
  }
  add(
    checks,
    'csrf-token',
    csrf.ok && csrfToken ? 'PASS' : 'FAIL',
    csrf.ok ? 'CSRF token acquired' : safeMsg(csrf),
    csrf.status,
  );

  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const profile = await requestJson('/api/v1/profile', {
    headers: authHeaders,
  }, session);
  add(
    checks,
    'profile',
    profile.ok ? 'PASS' : 'FAIL',
    profile.ok ? `user=${profile.data?.data?.username || 'unknown'}` : safeMsg(profile),
    profile.status,
  );

  const checkUsername = await requestJson('/api/v1/auth/check-username', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({ username }),
  }, session);
  const usernameAvailable = checkUsername.ok && checkUsername.data?.data?.available === true;
  add(
    checks,
    'check-username',
    usernameAvailable ? 'PASS' : 'FAIL',
    usernameAvailable ? 'username available' : safeMsg(checkUsername),
    checkUsername.status,
  );

  const register = await requestJson('/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({
      email,
      username,
      password,
    }),
  }, session);
  const registerOk = register.ok && Boolean(register.data?.data?.user?.id);
  add(
    checks,
    'register',
    registerOk ? 'PASS' : 'FAIL',
    registerOk
      ? `registered user=${register.data?.data?.user?.username} verified=${register.data?.data?.user?.email_verified === true}`
      : safeMsg(register),
    register.status,
  );

  const loginNew = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      password,
    }),
  }, session);
  const loginNewToken = loginNew.data?.data?.token || '';
  const loginNewOk = loginNew.ok && Boolean(loginNewToken);
  add(
    checks,
    'login-new-user',
    loginNewOk ? 'PASS' : 'FAIL',
    loginNewOk ? 'new user can login with password' : safeMsg(loginNew),
    loginNew.status,
  );

  const sendCode = await requestJson('/api/v1/auth/send-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({ email }),
  }, session);
  const sendCodeOk = sendCode.ok || sendCode.status === 429;
  add(
    checks,
    'send-code-email',
    sendCodeOk ? 'PASS' : 'FAIL',
    sendCode.ok
      ? 'verification code API accepted request'
      : sendCode.status === 429
        ? 'registration already generated a verification code; immediate resend was rate limited'
        : safeMsg(sendCode),
    sendCode.status,
  );

  const mailConfig = await requestJson('/api/v1/admin/mail-config', {
    headers: authHeaders,
  }, session);
  add(
    checks,
    'mail-config',
    mailConfig.ok ? 'PASS' : 'FAIL',
    mailConfig.ok
      ? `smtpHost=${mailConfig.data?.data?.config?.smtpHost || 'n/a'}`
      : safeMsg(mailConfig),
    mailConfig.status,
  );

  const adminMailTo = process.env.SMOKE_TEST_MAIL_TO || email;
  const mailTest = await requestJson('/api/v1/admin/mail-config/test', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({
      to: adminMailTo,
      subject: `Smoke Test ${new Date().toISOString()}`,
      message: `Smoke mail from script at ${new Date().toISOString()}`,
    }),
  }, session);
  const mailTestPass = mailTest.ok;
  const mailTestContext = compactJson(mailTest.data) || compactJson({ text: mailTest.text.slice(0, 180) });
  add(
    checks,
    'mail-config-test-send',
    mailTestPass ? 'PASS' : 'FAIL',
    mailTestPass
      ? `mail sent to ${adminMailTo}`
      : `${safeMsg(mailTest)}${mailTestContext ? ` | response=${mailTestContext}` : ''}`,
    mailTest.status,
  );

  const warnNoInbox =
    REGISTER_EMAIL_DOMAIN === 'example.com' || REGISTER_EMAIL_DOMAIN.endsWith('.local');
  if (warnNoInbox) {
    add(
      checks,
      'email-inbox-delivery',
      'WARN',
      `register email domain=${REGISTER_EMAIL_DOMAIN}, this run validates API send success only, not inbox receipt`,
    );
  } else {
    add(
      checks,
      'email-inbox-delivery',
      'WARN',
      'inbox delivery must be manually verified in recipient mailbox',
    );
  }

  const failed = checks.filter((item) => item.status === 'FAIL');
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    registerProbe: {
      email,
      username,
      passwordMasked: `${password.slice(0, 3)}***`,
    },
    checks,
    failedCount: failed.length,
  };

  const fullReportPath = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(fullReportPath), { recursive: true });
  writeFileSync(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[smoke:auth-register-mail] Base URL: ${BASE_URL}`);
  for (const item of checks) {
    console.log(`- ${item.status} ${item.name}: ${item.detail}`);
  }
  console.log(`[smoke:auth-register-mail] Report written to: ${fullReportPath}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[smoke:auth-register-mail] Unexpected error:', error);
  process.exit(1);
});
