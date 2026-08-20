import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

type ApiResponse<T = any> = {
  status: number;
  ok: boolean;
  data: T | null;
  text: string;
};

type SessionState = {
  cookie: string;
};

type OrderStatusData = {
  paymentId?: string;
  orderId?: string;
  projectKey?: string;
  amountFen?: number;
  amountYuan?: number;
  status?: string;
  planId?: string;
  paymentMethod?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
};

const BASE_URL = (process.env.SMOKE_WEB_BASE_URL || 'https://mc-u.top').replace(/\/+$/, '');
const ADMIN_IDENTIFIER = process.env.PAYMENT_ADMIN_IDENTIFIER || 'dev_local';
const ADMIN_PASSWORD = process.env.PAYMENT_ADMIN_PASSWORD || 'dev123456';
const PROJECT_KEY = process.env.PAYMENT_PROJECT_KEY || 'qianfu';
const ORDER_ID = (process.env.PAYMENT_ORDER_ID || '').trim();
const EXPECT_UPSTREAM_ORDER_ID = (process.env.PAYMENT_UPSTREAM_ORDER_ID || '').trim();
const POLL_INTERVAL_MS = Math.max(1000, Number(process.env.PAYMENT_POLL_INTERVAL_MS || '15000'));
const POLL_MAX_ATTEMPTS = Math.max(1, Number(process.env.PAYMENT_POLL_MAX_ATTEMPTS || '1')); // Audited env fallback
const REQUIRE_COMPLETED = String(process.env.PAYMENT_REQUIRE_COMPLETED || 'false').toLowerCase() === 'true';
const REPORT_PATH =
  process.env.PAYMENT_REPORT_PATH ||
  `logs/payment-order-status-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

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
    const setCookie = (res.headers as any).getSetCookie?.().join(',') || res.headers.get('set-cookie');
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
  };
}

function safeMsg(resp: ApiResponse<any>): string {
  return (
    resp.data?.error?.message ||
    resp.data?.message ||
    resp.text.slice(0, 180) ||
    `HTTP ${resp.status}`
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(session: SessionState): Promise<string> {
  const loginResp = await requestJson(
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: ADMIN_IDENTIFIER,
        password: ADMIN_PASSWORD,
      }),
    },
    session,
  );
  if (!loginResp.ok) {
    throw new Error(`admin login failed: ${safeMsg(loginResp)}`);
  }
  const token = loginResp.data?.data?.token || '';
  if (!token) {
    throw new Error('admin login response missing token');
  }
  return token;
}

async function queryOrder(session: SessionState, token: string): Promise<ApiResponse<{ data?: OrderStatusData }>> {
  return requestJson(
    `/api/v1/admin/payment-projects/${encodeURIComponent(PROJECT_KEY)}/orders/${encodeURIComponent(ORDER_ID)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    session,
  );
}

async function main(): Promise<number> {
  if (!ORDER_ID) {
    throw new Error('PAYMENT_ORDER_ID is required');
  }

  const session: SessionState = { cookie: '' };
  const token = await login(session);

  const attempts: Array<{
    attempt: number;
    queriedAt: string;
    httpStatus: number;
    ok: boolean;
    message: string;
    order: OrderStatusData | null;
  }> = [];

  let finalStatus = 'UNKNOWN';
  let finalResp: ApiResponse<{ data?: OrderStatusData }> | null = null;

  for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
    const resp = await queryOrder(session, token);
    finalResp = resp;
    const order = (resp.data?.data || null) as OrderStatusData | null;
    const status = String(order?.status || 'UNKNOWN').toUpperCase();
    finalStatus = status;
    attempts.push({
      attempt,
      queriedAt: new Date().toISOString(),
      httpStatus: resp.status,
      ok: resp.ok,
      message: resp.ok ? 'OK' : safeMsg(resp),
      order,
    });

    if (!resp.ok) {
      break;
    }
    if (status === 'COMPLETED') {
      break;
    }
    if (attempt < POLL_MAX_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  const latest = attempts[attempts.length - 1];
  const order = latest?.order || null;

  const upstreamOrderIdFromOrder = String((order as any)?.upstreamOrderId || '').trim();
  const upstreamMatch =
    EXPECT_UPSTREAM_ORDER_ID.length === 0
      ? null
      : upstreamOrderIdFromOrder.length === 0
        ? null
        : upstreamOrderIdFromOrder === EXPECT_UPSTREAM_ORDER_ID;

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    projectKey: PROJECT_KEY,
    orderId: ORDER_ID,
    expectedUpstreamOrderId: EXPECT_UPSTREAM_ORDER_ID || null,
    requireCompleted: REQUIRE_COMPLETED,
    poll: {
      maxAttempts: POLL_MAX_ATTEMPTS,
      intervalMs: POLL_INTERVAL_MS,
    },
    final: {
      status: finalStatus,
      httpStatus: finalResp?.status ?? 0,
      ok: Boolean(finalResp?.ok),
      message: finalResp ? safeMsg(finalResp) : 'no response',
      amountFen: order?.amountFen ?? null,
      amountYuan: order?.amountYuan ?? null,
      paymentMethod: order?.paymentMethod ?? null,
      upstreamOrderId: upstreamOrderIdFromOrder || null,
      updatedAt: order?.updatedAt ?? null,
      createdAt: order?.createdAt ?? null,
      upstreamMatch,
    },
    attempts,
  };

  const fullReportPath = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(fullReportPath), { recursive: true });
  writeFileSync(fullReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[payment:order-status] Base URL: ${BASE_URL}`);
  console.log(`[payment:order-status] Project: ${PROJECT_KEY}`);
  console.log(`[payment:order-status] Order: ${ORDER_ID}`);
  console.log(`[payment:order-status] Final status: ${report.final.status}`);
  console.log(`[payment:order-status] HTTP: ${report.final.httpStatus}`);
  console.log(`[payment:order-status] Report written to: ${fullReportPath}`);

  if (!report.final.ok) {
    return 1;
  }
  if (REQUIRE_COMPLETED && report.final.status !== 'COMPLETED') {
    return 2;
  }
  return 0;
}

main()
  .then((code) => {
    if (code !== 0) {
      process.exitCode = code;
    }
  })
  .catch((error) => {
    console.error('[payment:order-status] Unexpected error:', error);
    process.exitCode = 1;
  });
