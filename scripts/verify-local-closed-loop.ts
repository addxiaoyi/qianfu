#!/usr/bin/env node
import crypto from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { loginWithCsrf } from './lib/smoke-session-login';
import { createScriptPrismaClient } from './utils/prismaClient';

dotenv.config({ path: resolve(process.cwd(), '.env') });

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

type SessionState = {
  cookie: string;
};

type AuthState = {
  token: string;
  csrfToken: string;
};

type RuntimeUser = {
  id?: number;
  identifier: string;
  password: string;
  generated: boolean;
};

type PaymentProjectOverride = {
  db: any;
  original: any;
};

type LocalXpayMock = {
  baseUrl: string;
  server: Server;
};

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
const XPAY_URL = process.env.XPAY_URL || 'http://127.0.0.1:8080';
const XPAY_PAY_PATH = process.env.XPAY_PAY_PATH || '/api/pay';
const XPAY_SIMULATE_PATH = process.env.XPAY_SIMULATE_PATH || '/api/internal/simulate-callback/';
const PAYMENT_STATUS_PATH = '/api/v1/payment/status/';
const CLOSED_LOOP_AMOUNT = Number(process.env.LOCAL_CLOSED_LOOP_AMOUNT || '0.1');
const CLOSED_LOOP_PAYMENT_METHOD = process.env.LOCAL_CLOSED_LOOP_PAYMENT_METHOD || 'wechat';
const CLOSED_LOOP_USER_IDENTIFIER = process.env.LOCAL_CLOSED_LOOP_USER_IDENTIFIER?.trim() || '';
const CLOSED_LOOP_USER_PASSWORD = process.env.LOCAL_CLOSED_LOOP_USER_PASSWORD || '';

function isEnabled(value: string | undefined): boolean {
  return String(value || '').toLowerCase() === 'true';
}

function checkEnvReadiness(): CheckResult[] {
  const results: CheckResult[] = [];

  const qianfuEnabled = isEnabled(process.env.QIANFU_ENABLED);
  results.push({
    name: 'env-qianfu-enabled',
    ok: qianfuEnabled,
    detail: qianfuEnabled ? 'QIANFU_ENABLED=true' : 'QIANFU_ENABLED is not true',
  });

  const callbackUrl = process.env.XPAY_NOTIFY_URL || '';
  const callbackLooksValid = [
    '/api/v1/payment/xpay/notify',
    '/api/payment/xpay/notify',
    '/api/v1/qianfu/xpay/notify',
    '/api/qianfu/xpay/notify',
  ].some((path) => callbackUrl.includes(path));
  results.push({
    name: 'env-xpay-notify-url',
    ok: callbackLooksValid,
    detail: callbackLooksValid
      ? `XPAY_NOTIFY_URL=${callbackUrl}`
      : 'XPAY_NOTIFY_URL missing or does not point to notify endpoint',
  });

  return results;
}

async function safeFetch(url: string, timeoutMs = 5000, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function parseJsonResponse(res: Response): Promise<{ ok: boolean; data?: any; detail?: string }> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      detail: `expected application/json but got ${contentType || 'unknown'}`,
    };
  }

  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch {
    return { ok: false, detail: 'invalid JSON payload' };
  }
}

function mergeCookies(existing: string, setCookie: string | null): string {
  if (!setCookie) return existing;

  const current = new Map<string, string>();
  for (const part of existing.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0) current.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }

  const incoming = setCookie
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((part) => part.trim().split(';')[0])
    .filter(Boolean);
  for (const part of incoming) {
    const separator = part.indexOf('=');
    if (separator > 0) current.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }

  return Array.from(current.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
}

async function requestJson(
  path: string,
  init: RequestInit = {},
  session?: SessionState,
): Promise<{ status: number; ok: boolean; data: any; text: string }> {
  const url = path.startsWith('http')
    ? path
    : `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (session?.cookie) headers.set('Cookie', session.cookie);

  const response = await safeFetch(url, 20_000, { ...init, headers });
  if (session) {
    const setCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.().join(',')
      || response.headers.get('set-cookie');
    session.cookie = mergeCookies(session.cookie, setCookie);
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Keep the raw response for diagnostics; callers decide whether JSON is required.
  }
  return { status: response.status, ok: response.ok, data, text };
}

function responseData(response: { data: any }): any {
  return response.data?.data ?? response.data;
}

function responseMessage(response: { data: any; text: string; status: number }): string {
  return response.data?.error?.message
    || response.data?.message
    || response.text.slice(0, 180)
    || `HTTP ${response.status}`;
}

function isLoopbackTarget(baseUrl = BACKEND_URL): boolean {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function startLocalXpayMock(notifyUrl: string): Promise<LocalXpayMock> {
  const token = process.env.XPAY_MOCK_TOKEN || '3f8e2c91b5a0d4f7e8a9c2b3d1e0f9a7';
  const orders = new Map<string, { type: string; money: string }>();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const path = url.pathname;

    if (path === XPAY_PAY_PATH && request.method === 'GET') {
      const type = url.searchParams.get('type') || '';
      const money = url.searchParams.get('money') || '';
      const mark = url.searchParams.get('mark') || '';
      if (!type || !money || !mark) {
        response.statusCode = 400;
        response.end('missing payment parameters');
        return;
      }
      orders.set(mark, { type, money });
      response.statusCode = 302;
      response.setHeader('Location', `/pay/${encodeURIComponent(mark)}`);
      response.end();
      return;
    }

    if (path.startsWith('/pay/')) {
      response.statusCode = orders.has(decodeURIComponent(path.slice('/pay/'.length))) ? 200 : 404;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html><body><h1>Local XPay payment page</h1></body></html>');
      return;
    }

    const callbackPrefix = '/api/internal/simulate-callback/';
    if (path.startsWith(callbackPrefix) && request.method === 'POST') {
      const paymentId = decodeURIComponent(path.slice(callbackPrefix.length));
      const order = orders.get(paymentId);
      if (!order) {
        response.statusCode = 404;
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ code: 404, msg: 'Order not found' }));
        return;
      }

      const dt = Date.now().toString();
      const sign = crypto.createHash('md5')
        .update(`${order.type}${order.money}${paymentId}${dt}${token}`)
        .digest('hex');
      const callback = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: order.type, money: order.money, mark: paymentId, dt, sign }),
      });
      const callbackBody = await callback.text();
      const accepted = callback.ok && callbackBody.trim() === 'success';
      response.statusCode = accepted ? 200 : 502;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ code: accepted ? 200 : 502, msg: callbackBody || `HTTP ${callback.status}` }));
      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    throw new Error('Local XPay mock did not expose a TCP port');
  }
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopLocalXpayMock(mock: LocalXpayMock | null): Promise<void> {
  if (!mock) return;
  await new Promise<void>((resolvePromise, rejectPromise) => {
    mock.server.close((error) => error ? rejectPromise(error) : resolvePromise());
  });
}

async function activateLocalMockPaymentProject(mockBaseUrl: string): Promise<PaymentProjectOverride | null> {
  if (!isLoopbackTarget() || process.env.LOCAL_CLOSED_LOOP_USE_MOCK === '0') {
    return null;
  }

  const db = createScriptPrismaClient();
  const key = 'payment_project:qianfu';
  try {
    const original = await db.systemConfig.findUnique({ where: { key } });
    const mockOrigin = new URL(mockBaseUrl).origin;
    const mockToken = process.env.XPAY_MOCK_TOKEN || '3f8e2c91b5a0d4f7e8a9c2b3d1e0f9a7';
    const mockConfig = {
      key: 'qianfu',
      displayName: 'QianFu Local Closed Loop',
      upstreamProvider: 'xpay',
      xpayApiUrl: `${mockOrigin}${XPAY_PAY_PATH}`,
      xpayToken: mockToken,
      xpayNotifyUrl: `${BACKEND_URL}/api/v1/payment/xpay/notify`,
    };

    await db.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify(mockConfig),
        is_secret: false,
        description: 'Temporary local closed-loop payment override',
      },
      update: {
        value: JSON.stringify(mockConfig),
        is_secret: false,
        description: 'Temporary local closed-loop payment override',
      },
    });
    return { db, original };
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}

async function restorePaymentProject(override: PaymentProjectOverride | null): Promise<void> {
  if (!override) return;
  const key = 'payment_project:qianfu';
  try {
    if (override.original) {
      await override.db.systemConfig.update({
        where: { key },
        data: {
          value: override.original.value,
          is_secret: override.original.is_secret,
          description: override.original.description,
        },
      });
    } else {
      await override.db.systemConfig.delete({ where: { key } });
    }
  } finally {
    await override.db.$disconnect();
  }
}

async function createEphemeralUser(): Promise<RuntimeUser> {
  const prisma = createScriptPrismaClient();
  const suffix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const identifier = `closed_loop_${suffix}@example.com`;
  const password = `Closed_${crypto.randomBytes(8).toString('hex')}_A1`;

  try {
    const user = await prisma.user.create({
      data: {
        email: identifier,
        username: `closed_${suffix}`.slice(0, 28),
        display_name: 'Local Closed Loop User',
        password_hash: await bcrypt.hash(password, 12),
        password_changed_at: new Date(),
        role: 'NORMAL',
        permissions: JSON.stringify([]),
        email_verified: true,
      },
      select: { id: true },
    });
    return { id: user.id, identifier, password, generated: true };
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanupEphemeralUser(userId: number): Promise<void> {
  const prisma = createScriptPrismaClient();
  try {
    await prisma.$transaction(async (tx: any) => {
      const wallets = await tx.wallet.findMany({ where: { user_id: userId }, select: { id: true } });
      const walletIds = wallets.map((wallet: { id: number }) => wallet.id);
      if (walletIds.length > 0) {
        await tx.transaction.deleteMany({ where: { wallet_id: { in: walletIds } } });
        await tx.wallet.deleteMany({ where: { id: { in: walletIds } } });
      }
      await tx.notification.deleteMany({ where: { user_id: userId } });
      await tx.payment.deleteMany({ where: { user_id: userId } });
      await tx.session.deleteMany({ where: { user_id: userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function readWalletBalance(session: SessionState, auth: AuthState): Promise<{ ok: boolean; balance: number; detail: string }> {
  const response = await requestJson('/api/v1/wallet', {
    headers: { Authorization: `Bearer ${auth.token}` },
  }, session);
  const balance = Number(responseData(response)?.balance ?? NaN);
  return {
    ok: response.ok && Number.isFinite(balance),
    balance,
    detail: response.ok ? `balance=${balance}` : responseMessage(response),
  };
}

async function waitForPaymentStatus(
  paymentId: string,
  session: SessionState,
  auth: AuthState,
  maxAttempts = 8,
): Promise<{ status: string; detail: string }> {
  let lastStatus = 'UNKNOWN';
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await requestJson(`${PAYMENT_STATUS_PATH}${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    }, session);
    const status = String(responseData(response)?.status || 'UNKNOWN');
    lastStatus = status;
    if (response.ok && status === 'COMPLETED') {
      return { status, detail: `status=${status} attempts=${attempt}` };
    }
    if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { status: lastStatus, detail: `status=${lastStatus} attempts=${maxAttempts}` };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

async function checkPaymentClosedLoop(): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  let runtimeUser: RuntimeUser | null = null;
  let paymentProjectOverride: PaymentProjectOverride | null = null;
  let localXpayMock: LocalXpayMock | null = null;

  try {
    if (!Number.isFinite(CLOSED_LOOP_AMOUNT) || CLOSED_LOOP_AMOUNT < 0.1 || CLOSED_LOOP_AMOUNT > 10_000) {
      throw new Error('LOCAL_CLOSED_LOOP_AMOUNT must be between 0.1 and 10000');
    }
    if (!['wechat', 'alipay'].includes(CLOSED_LOOP_PAYMENT_METHOD)) {
      throw new Error('LOCAL_CLOSED_LOOP_PAYMENT_METHOD must be wechat or alipay');
    }

    if (isLoopbackTarget() && process.env.LOCAL_CLOSED_LOOP_USE_MOCK !== '0') {
      localXpayMock = await startLocalXpayMock(`${BACKEND_URL}/api/v1/payment/xpay/notify`);
      paymentProjectOverride = await activateLocalMockPaymentProject(localXpayMock.baseUrl);
    }

    const hasConfiguredUser = CLOSED_LOOP_USER_IDENTIFIER && CLOSED_LOOP_USER_PASSWORD;
    if (hasConfiguredUser) {
      runtimeUser = {
        identifier: CLOSED_LOOP_USER_IDENTIFIER,
        password: CLOSED_LOOP_USER_PASSWORD,
        generated: false,
      };
    } else if (isLoopbackTarget()) {
      runtimeUser = await createEphemeralUser();
    } else {
      throw new Error('Set LOCAL_CLOSED_LOOP_USER_IDENTIFIER and LOCAL_CLOSED_LOOP_USER_PASSWORD for non-loopback verification');
    }

    const session: SessionState = { cookie: '' };
    const auth = await loginWithCsrf(requestJson as any, session, runtimeUser.identifier, runtimeUser.password) as AuthState;
    const authHeaders = {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      'x-csrf-token': auth.csrfToken,
    };

    const walletBefore = await readWalletBalance(session, auth);
    checks.push({
      name: 'wallet-before-payment',
      ok: walletBefore.ok,
      detail: walletBefore.detail,
    });

    const createResponse = await requestJson('/api/v1/payment/create', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        planId: 'custom',
        amount: CLOSED_LOOP_AMOUNT,
        paymentMethod: CLOSED_LOOP_PAYMENT_METHOD,
      }),
    }, session);
    const payment = responseData(createResponse) || {};
    const paymentId = String(payment.paymentId || payment.orderId || payment.id || '');
    const paymentUrl = String(payment.paymentUrl || payment.checkoutUrl || payment.checkout_url || '').trim();
    const paymentQrContent = String(payment.paymentQrContent || payment.qrImagePath || paymentUrl).trim();
    checks.push({
      name: 'create-payment-order',
      ok: createResponse.ok && Boolean(paymentId),
      detail: createResponse.ok ? `paymentId=${paymentId || 'missing'}` : responseMessage(createResponse),
    });
    checks.push({
      name: 'payment-url',
      ok: createResponse.ok && Boolean(paymentUrl),
      detail: paymentUrl ? `paymentUrl=${paymentUrl}` : 'paymentUrl missing',
    });
    checks.push({
      name: 'payment-qr-data',
      ok: createResponse.ok && Boolean(paymentQrContent),
      detail: paymentQrContent ? 'payment QR content returned' : 'payment QR content missing',
    });

    if (!createResponse.ok || !paymentId || !paymentUrl) {
      return checks;
    }

    const payPage = await safeFetch(paymentUrl, 20_000);
    const payPageText = await payPage.text();
    checks.push({
      name: 'xpay-order-page',
      ok: payPage.ok && /<html|<!doctype html/i.test(payPageText),
      detail: payPage.ok ? `payment page loaded (${payPage.url})` : `payment page HTTP ${payPage.status}`,
    });

    const paymentOrigin = new URL(paymentUrl).origin;
    const mockOrigin = localXpayMock?.baseUrl || new URL(XPAY_URL).origin;
    const canSimulate = paymentOrigin === mockOrigin;
    if (!canSimulate) {
      checks.push({
        name: 'xpay-callback',
        ok: false,
        detail: `payment provider is ${paymentOrigin}; expected local mock ${mockOrigin}`,
      });
      return checks;
    }

    const simulateCallback = async () => requestJson(
      `${mockOrigin}${XPAY_SIMULATE_PATH}${encodeURIComponent(paymentId)}`,
      { method: 'POST' },
    );

    const callbackResponse = await simulateCallback();
    checks.push({
      name: 'xpay-callback',
      ok: callbackResponse.ok && callbackResponse.data?.code === 200,
      detail: callbackResponse.ok ? 'mock callback accepted by backend' : responseMessage(callbackResponse),
    });

    const completed = await waitForPaymentStatus(paymentId, session, auth);
    checks.push({
      name: 'payment-completed',
      ok: completed.status === 'COMPLETED',
      detail: completed.detail,
    });

    const walletAfterCallback = await readWalletBalance(session, auth);
    const callbackDelta = roundCurrency(walletAfterCallback.balance - walletBefore.balance);
    checks.push({
      name: 'wallet-after-callback',
      ok: walletAfterCallback.ok && callbackDelta === roundCurrency(CLOSED_LOOP_AMOUNT),
      detail: walletAfterCallback.ok ? `balance=${walletAfterCallback.balance} delta=${callbackDelta}` : walletAfterCallback.detail,
    });

    const replayResponse = await simulateCallback();
    checks.push({
      name: 'xpay-callback-replay',
      ok: replayResponse.ok && replayResponse.data?.code === 200,
      detail: replayResponse.ok ? 'duplicate callback accepted idempotently' : responseMessage(replayResponse),
    });

    const walletAfterReplay = await readWalletBalance(session, auth);
    const replayDelta = roundCurrency(walletAfterReplay.balance - walletAfterCallback.balance);
    checks.push({
      name: 'wallet-after-replay',
      ok: walletAfterReplay.ok && replayDelta === 0,
      detail: walletAfterReplay.ok
        ? replayDelta === 0
          ? `balance=${walletAfterReplay.balance} replay-delta=0`
          : `balance=${walletAfterReplay.balance} replay-delta=${replayDelta}`
        : walletAfterReplay.detail,
    });
  } catch (error) {
    checks.push({
      name: 'payment-closed-loop',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    try {
      await restorePaymentProject(paymentProjectOverride);
    } catch (error) {
      checks.push({
        name: 'payment-project-restore',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    if (runtimeUser?.generated && runtimeUser.id) {
      try {
        await cleanupEphemeralUser(runtimeUser.id);
      } catch (error) {
        checks.push({
          name: 'payment-closed-loop-cleanup',
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
    try {
      await stopLocalXpayMock(localXpayMock);
    } catch (error) {
      checks.push({
        name: 'payment-mock-cleanup',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return checks;
}

async function checkBackendHealth(): Promise<CheckResult> {
  try {
    const res = await safeFetch(`${BACKEND_URL}/api/health`);
    if (!res.ok) {
      return {
        name: 'backend-health',
        ok: false,
        detail: `GET /api/health => ${res.status}`,
      };
    }

    const parsed = await parseJsonResponse(res);
    if (!parsed.ok) {
      return {
        name: 'backend-health',
        ok: false,
        detail: `/api/health invalid response: ${parsed.detail}`,
      };
    }

    // 后端统一响应格式：{ success: true, data: { status: 'ok', ... } }
    const status = parsed.data?.status ?? parsed.data?.data?.status;
    const ready = parsed.data?.ready ?? parsed.data?.data?.ready;
    const healthy = ready === true;
    const detail = healthy
      ? status === 'degraded'
        ? 'backend ready; health status degraded'
        : 'backend health JSON ok'
      : `unexpected status/ready fields: ${String(status)}/${String(ready)}`;
    return {
      name: 'backend-health',
      ok: healthy,
      detail,
    };
  } catch (error: any) {
    return {
      name: 'backend-health',
      ok: false,
      detail: error?.message || 'request failed'
    };
  }
}

async function checkCsrf(): Promise<CheckResult> {
  const candidates = ['/api/v1/csrf-token', '/api/v1/auth/csrf-token', '/api/auth/csrf-token', '/api/csrf-token'];

  for (const endpoint of candidates) {
    try {
      const res = await safeFetch(`${BACKEND_URL}${endpoint}`);
      if (!res.ok) {
        continue;
      }

      const parsed = await parseJsonResponse(res);
      if (!parsed.ok) {
        continue;
      }

      const data = parsed.data;
      const token = data?.data?.csrfToken || data?.csrfToken;
      if (token) {
        return {
          name: 'backend-csrf',
          ok: true,
          detail: `csrf token issued via ${endpoint}`,
        };
      }
    } catch {
      // try next candidate
    }
  }

  return {
    name: 'backend-csrf',
    ok: false,
    detail: 'csrf token endpoint unavailable or invalid response',
  };
}

async function checkXpayPage(): Promise<CheckResult> {
  if (isLoopbackTarget() && process.env.LOCAL_CLOSED_LOOP_USE_MOCK !== '0') {
    return {
      name: 'xpay-page',
      ok: true,
      detail: 'in-process XPay page is verified during the payment closed loop',
    };
  }

  try {
    const probe = new URL(`${XPAY_URL}${XPAY_PAY_PATH}`);
    probe.search = new URLSearchParams({
      money: '0.10',
      mark: `closed-loop-${Date.now()}`,
      type: 'wechat',
      dt: Date.now().toString(),
    }).toString();
    const res = await safeFetch(probe.toString());
    if (!res.ok) {
      return {
        name: 'xpay-page',
        ok: false,
        detail: `GET ${XPAY_PAY_PATH} => ${res.status}`,
      };
    }

    const text = await res.text();
    const htmlLike = /<html|<!doctype html/i.test(text);
    return {
      name: 'xpay-page',
      ok: htmlLike,
      detail: htmlLike ? `xpay pay page reachable via ${XPAY_PAY_PATH}` : 'xpay response is not an HTML pay page',
    };
  } catch (error: any) {
    return {
      name: 'xpay-page',
      ok: false,
      detail: error?.message || 'request failed'
    };
  }
}

async function checkQianfuHealth(): Promise<CheckResult> {
  const endpoint = '/api/v1/qianfu/health';
  try {
    const res = await safeFetch(`${BACKEND_URL}${endpoint}`);
    if (!res.ok) {
      return {
        name: 'qianfu-health',
        ok: false,
        detail: `GET ${endpoint} => ${res.status}`,
      };
    }

    const parsed = await parseJsonResponse(res);
    if (!parsed.ok) {
      return {
        name: 'qianfu-health',
        ok: false,
        detail: `${endpoint} invalid response: ${parsed.detail}`,
      };
    }

    // 后端统一响应格式：{ success: true, data: { status: 'ok', ... } }
    const status = parsed.data?.status ?? parsed.data?.data?.status;
    return {
      name: 'qianfu-health',
      ok: status === 'ok' || status === 'healthy',
      detail: status === 'ok' || status === 'healthy'
        ? 'qianfu health JSON ok'
        : `unexpected status field: ${String(status)}`,
    };
  } catch (error: any) {
    return {
      name: 'qianfu-health',
      ok: false,
      detail: error?.message || 'request failed'
    };
  }
}

async function main() {
  const envChecks = checkEnvReadiness();
  const runtimeChecks = await Promise.all([
    checkBackendHealth(),
    checkCsrf(),
    checkXpayPage(),
    checkQianfuHealth()
  ]);
  const paymentChecks = await checkPaymentClosedLoop();
  const checks = [...envChecks, ...runtimeChecks, ...paymentChecks];

  const failed = checks.filter((item) => !item.ok);
  for (const item of checks) {
    const icon = item.ok ? '[OK]' : '[FAIL]';
    console.log(`${icon} ${item.name} - ${item.detail}`);
  }

  if (failed.length > 0) {
    console.error(`\nLocal closed loop verification failed: ${failed.length} check(s) failed.`);
    process.exitCode = 1;
    return;
  }

  console.log('\nLocal closed loop verification passed.');
}

main().catch((error) => {
  console.error('Verification crashed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
