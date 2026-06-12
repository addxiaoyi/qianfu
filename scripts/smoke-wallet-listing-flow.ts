import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
const ADMIN_IDENTIFIER = process.env.SMOKE_ADMIN_IDENTIFIER || 'dev_local';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'dev123456';
const LISTING_USER_EMAIL = process.env.SMOKE_LISTING_USER_EMAIL || '';
const LISTING_USER_PASSWORD = process.env.SMOKE_LISTING_USER_PASSWORD || '';
const RECHARGE_AMOUNT = Number(process.env.SMOKE_LISTING_RECHARGE_AMOUNT || '10');
const LISTING_PLAN = process.env.SMOKE_LISTING_PLAN || 'basic-monthly';
const THUMBNAIL_PATH = process.env.SMOKE_LISTING_THUMBNAIL || '/uploads/probe.png';
const REPORT_PATH =
  process.env.SMOKE_REPORT_PATH ||
  `logs/smoke-wallet-listing-flow-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const PLAN_PRICE_MAP: Record<string, number> = {
  'basic-monthly': 7,
  'pro-quarterly': 20,
  'vip-yearly': 90,
};

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

function add(checks: Check[], name: string, status: Status, detail: string, code?: number) {
  checks.push({ name, status, detail, code });
}

function safeMsg(resp: ApiResponse<any>): string {
  return (
    resp.data?.error?.message ||
    resp.data?.message ||
    resp.text.slice(0, 180) ||
    `HTTP ${resp.status}`
  );
}

function _requireEnv(value: string, name: string) {
  if (!value.trim()) {
    throw new Error(`${name} is required for this smoke script`);
  }
}

async function createVerifiedListingUser(adminSession: SessionState, adminAuth: { token: string; csrfToken: string }) {
  const now = Date.now();
  const email = `listing_${now}_${crypto.randomBytes(4).toString('hex')}@example.com`;
  const username = `listing_${now.toString().slice(-8)}_${crypto.randomBytes(2).toString('hex')}`.slice(0, 28);
  const password = `List_${crypto.randomBytes(4).toString('hex')}_A1`;

  const register = await requestJson('/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': adminAuth.csrfToken,
    },
    body: JSON.stringify({ email, username, password }),
  }, adminSession);
  if (!register.ok) {
    throw new Error(`listing bootstrap register failed: ${safeMsg(register)}`);
  }

  const _adminHeaders = {
    Authorization: `Bearer ${adminAuth.token}`,
  };
  const createdUserId = Number(register.data?.data?.user?.id || register.data?.user?.id || 0);
  if (!createdUserId) {
    throw new Error(`listing bootstrap missing created user id for ${email}`);
  }

  const verify = await requestJson(`/api/v1/admin/users/${createdUserId}/email-verification`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAuth.token}`,
      'x-csrf-token': adminAuth.csrfToken,
    },
    body: JSON.stringify({ email_verified: true }),
  }, adminSession);
  if (!verify.ok) {
    throw new Error(`listing bootstrap verify flag update failed: ${safeMsg(verify)}`);
  }

  return { email, password, username };
}

function normalizeListData(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function roundCurrency(input: number): number {
  return Math.round(input * 100) / 100;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitPublicCleared(marker: string, maxAttempts = 8, intervalMs = 1500) {
  let lastResponse: ApiResponse<any> | null = null;
  let lastCount = -1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const resp = await requestJson(`/api/v1/public/servers?page=1&limit=20&search=${encodeURIComponent(marker)}`);
    lastResponse = resp;
    const items = normalizeListData(resp.data);
    lastCount = items.length;
    if (resp.ok && items.length === 0) {
      return { cleared: true, attempts: attempt, response: resp, count: 0 };
    }
    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }
  return {
    cleared: false,
    attempts: maxAttempts,
    response: lastResponse,
    count: lastCount,
  };
}

async function loginWithSession(session: SessionState, identifier: string, password: string) {
  const login = await requestJson('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  }, session);
  if (!login.ok) {
    throw new Error(`Login failed for ${identifier}: ${safeMsg(login)}`);
  }
  const token = login.data?.data?.token || '';
  if (!token) {
    throw new Error(`Login token missing for ${identifier}`);
  }
  const csrf = await requestJson('/api/v1/csrf-token', {}, session);
  if (!csrf.ok) {
    throw new Error(`CSRF token request failed for ${identifier}: ${safeMsg(csrf)}`);
  }
  const csrfToken = csrf.data?.data?.csrfToken || csrf.data?.csrfToken || '';
  if (!csrfToken) {
    throw new Error(`CSRF token missing for ${identifier}`);
  }
  return { token, csrfToken, login, csrf };
}

async function main() {
  const checks: Check[] = [];
  const adminSession: SessionState = { cookie: '' };
  const userSession: SessionState = { cookie: '' };
  const marker = `wallet-listing-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  let createdServerId: number | null = null;

  const adminAuth = await loginWithSession(adminSession, ADMIN_IDENTIFIER, ADMIN_PASSWORD);
  const listingUser = LISTING_USER_EMAIL && LISTING_USER_PASSWORD
    ? { email: LISTING_USER_EMAIL, password: LISTING_USER_PASSWORD }
    : await createVerifiedListingUser(adminSession, adminAuth);
  const userAuth = await loginWithSession(userSession, listingUser.email, listingUser.password);

  add(checks, 'admin-login', 'PASS', `admin=${ADMIN_IDENTIFIER}`, adminAuth.login.status);
  add(checks, 'user-login', 'PASS', `user=${listingUser.email}`, userAuth.login.status);

  const adminHeaders = {
    Authorization: `Bearer ${adminAuth.token}`,
    'Content-Type': 'application/json',
    'x-csrf-token': adminAuth.csrfToken,
  };
  const userHeaders = {
    Authorization: `Bearer ${userAuth.token}`,
    'Content-Type': 'application/json',
    'x-csrf-token': userAuth.csrfToken,
  };
  const userReadHeaders = {
    Authorization: `Bearer ${userAuth.token}`,
  };

  const quotaBefore = await requestJson('/api/v1/servers/me', {
    headers: userReadHeaders,
  }, userSession);
  const canPublish = quotaBefore.data?.data?.can_publish === true;
  const maxCards = Number(quotaBefore.data?.data?.max_cards ?? 0);
  add(
    checks,
    'user-quota',
    quotaBefore.ok && canPublish && maxCards >= 1 ? 'PASS' : 'FAIL',
    quotaBefore.ok
      ? `can_publish=${String(canPublish)} max_cards=${String(maxCards)}`
      : safeMsg(quotaBefore),
    quotaBefore.status,
  );

  const walletBeforeResp = await requestJson('/api/v1/wallet', {
    headers: userReadHeaders,
  }, userSession);
  const walletBefore = Number(walletBeforeResp.data?.data?.balance ?? NaN);
  add(
    checks,
    'wallet-before',
    walletBeforeResp.ok && Number.isFinite(walletBefore) ? 'PASS' : 'FAIL',
    walletBeforeResp.ok ? `balance=${walletBefore}` : safeMsg(walletBeforeResp),
    walletBeforeResp.status,
  );

  const createRecharge = await requestJson('/api/v1/payment/create', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      planId: 'custom',
      amount: RECHARGE_AMOUNT,
      paymentMethod: 'alipay',
    }),
  }, userSession);
  const rechargeOrderId = createRecharge.data?.data?.orderId || createRecharge.data?.data?.paymentId;
  add(
    checks,
    'create-recharge',
    createRecharge.ok && typeof rechargeOrderId === 'string' ? 'PASS' : 'FAIL',
    createRecharge.ok ? `orderId=${String(rechargeOrderId)}` : safeMsg(createRecharge),
    createRecharge.status,
  );

  const completeRecharge = await requestJson('/api/v1/payment/admin/complete-order', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ orderId: rechargeOrderId }),
  }, adminSession);
  add(
    checks,
    'complete-recharge',
    completeRecharge.ok ? 'PASS' : 'FAIL',
    completeRecharge.ok ? 'admin completed recharge order' : safeMsg(completeRecharge),
    completeRecharge.status,
  );

  const walletAfterRechargeResp = await requestJson('/api/v1/wallet', {
    headers: userReadHeaders,
  }, userSession);
  const walletAfterRecharge = Number(walletAfterRechargeResp.data?.data?.balance ?? NaN);
  const rechargeDelta = roundCurrency(walletAfterRecharge - walletBefore);
  add(
    checks,
    'wallet-after-recharge',
    walletAfterRechargeResp.ok && rechargeDelta === roundCurrency(RECHARGE_AMOUNT) ? 'PASS' : 'FAIL',
    walletAfterRechargeResp.ok
      ? `balance=${walletAfterRecharge} delta=${rechargeDelta}`
      : safeMsg(walletAfterRechargeResp),
    walletAfterRechargeResp.status,
  );

  const createServer = await requestJson('/api/v1/servers', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      name: `Smoke Listing ${marker}`,
      summary: 'wallet charged smoke listing',
      content_html: `This is an automated smoke listing payload for ${marker}.`,
      ip: `${marker}.example.com`,
      tags: JSON.stringify(['smoke', 'wallet', 'listing']),
      thumbnail: THUMBNAIL_PATH,
      supported_versions: JSON.stringify(['1.20.1']),
      listing_plan: LISTING_PLAN,
    }),
  }, userSession);
  createdServerId = Number(createServer.data?.data?.id || 0) || null;
  const expectedPrice = PLAN_PRICE_MAP[LISTING_PLAN];
  const listingPricePaid = Number(createServer.data?.data?.listing_price_paid ?? NaN);
  add(
    checks,
    'create-server',
    createServer.ok && createdServerId !== null && listingPricePaid === expectedPrice * 100 ? 'PASS' : 'FAIL',
    createServer.ok
      ? `serverId=${String(createdServerId)} listing_price_paid=${String(listingPricePaid)}`
      : safeMsg(createServer),
    createServer.status,
  );

  const walletAfterPublishResp = await requestJson('/api/v1/wallet', {
    headers: userReadHeaders,
  }, userSession);
  const walletAfterPublish = Number(walletAfterPublishResp.data?.data?.balance ?? NaN);
  const publishDelta = roundCurrency(walletAfterRecharge - walletAfterPublish);
  add(
    checks,
    'wallet-after-publish',
    walletAfterPublishResp.ok && publishDelta === expectedPrice ? 'PASS' : 'FAIL',
    walletAfterPublishResp.ok
      ? `balance=${walletAfterPublish} publish_delta=${publishDelta}`
      : safeMsg(walletAfterPublishResp),
    walletAfterPublishResp.status,
  );

  const approveServer = await requestJson(`/api/v1/review/${createdServerId}`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      status: 'APPROVED',
      notes: `smoke approved ${marker}`,
    }),
  }, adminSession);
  add(
    checks,
    'approve-server',
    approveServer.ok && approveServer.data?.data?.review_status === 'APPROVED' ? 'PASS' : 'FAIL',
    approveServer.ok
      ? `review_status=${String(approveServer.data?.data?.review_status)}`
      : safeMsg(approveServer),
    approveServer.status,
  );

  const publicList = await requestJson(`/api/v1/public/servers?page=1&limit=20&search=${encodeURIComponent(marker)}`);
  const publicItems = normalizeListData(publicList.data);
  const publicMatch = publicItems.find((item) => item?.id === createdServerId);
  add(
    checks,
    'public-visible',
    publicList.ok && Boolean(publicMatch) ? 'PASS' : 'FAIL',
    publicList.ok ? `public_matches=${String(publicItems.length)}` : safeMsg(publicList),
    publicList.status,
  );

  const deleteServer = await requestJson(`/api/v1/servers/${createdServerId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminAuth.token}`,
      'x-csrf-token': adminAuth.csrfToken,
    },
  }, adminSession);
  add(
    checks,
    'delete-server',
    deleteServer.ok ? 'PASS' : 'FAIL',
    deleteServer.ok ? 'test listing deleted' : safeMsg(deleteServer),
    deleteServer.status,
  );

  const ownedAfterDelete = await requestJson(`/api/v1/servers?page=1&limit=20&search=${encodeURIComponent(marker)}`, {
    headers: userReadHeaders,
  }, userSession);
  const ownedAfterDeleteItems = normalizeListData(ownedAfterDelete.data);
  const ownedCleared = ownedAfterDelete.ok && ownedAfterDeleteItems.length === 0;
  add(
    checks,
    'owned-cleared',
    ownedCleared ? 'PASS' : 'FAIL',
    ownedAfterDelete.ok ? `owned_matches=${String(ownedAfterDeleteItems.length)}` : safeMsg(ownedAfterDelete),
    ownedAfterDelete.status,
  );

  const publicAfterDelete = await waitPublicCleared(marker);
  const publicClearedStatus: Status = publicAfterDelete.cleared
    ? 'PASS'
    : deleteServer.ok && ownedCleared
      ? 'WARN'
      : 'FAIL';
  add(
    checks,
    'public-cleared',
    publicClearedStatus,
    publicAfterDelete.response?.ok
      ? `${publicClearedStatus === 'WARN' ? 'eventual-sync-pending' : 'public_matches'}=${String(publicAfterDelete.count)} attempts=${String(publicAfterDelete.attempts)}`
      : safeMsg(publicAfterDelete.response || { status: 0, ok: false, data: null, text: 'no response', headers: new Headers() }),
    publicAfterDelete.response?.status,
  );

  const failed = checks.filter((item) => item.status === 'FAIL');
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    listingPlan: LISTING_PLAN,
    rechargeAmount: RECHARGE_AMOUNT,
    marker,
    createdServerId,
    checks,
    failedCount: failed.length,
  };

  const fullReportPath = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(fullReportPath), { recursive: true });
  writeFileSync(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[smoke:wallet-listing] Base URL: ${BASE_URL}`);
  for (const check of checks) {
    console.log(`- ${check.status} ${check.name}: ${check.detail}`);
  }
  console.log(`[smoke:wallet-listing] Report written to: ${fullReportPath}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[smoke:wallet-listing] Unexpected error:', error);
  process.exit(1);
});
