#!/usr/bin/env node
type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
const XPAY_URL = process.env.XPAY_URL || 'http://127.0.0.1:8888';

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
  const callbackLooksValid = callbackUrl.includes('/api/payment/xpay/notify') || callbackUrl.includes('/api/qianfu/xpay/notify');
  results.push({
    name: 'env-xpay-notify-url',
    ok: callbackLooksValid,
    detail: callbackLooksValid
      ? `XPAY_NOTIFY_URL=${callbackUrl}`
      : 'XPAY_NOTIFY_URL missing or does not point to notify endpoint',
  });

  return results;
}

async function safeFetch(url: string, timeoutMs = 5000): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
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
    return {
      name: 'backend-health',
      ok: status === 'ok',
      detail: status === 'ok' ? 'backend health JSON ok' : `unexpected status field: ${String(status)}`,
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
  const candidates = ['/api/auth/csrf-token', '/api/csrf-token'];

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
  try {
    const res = await safeFetch(`${XPAY_URL}/starmc/pay`);
    if (!res.ok) {
      return {
        name: 'xpay-page',
        ok: false,
        detail: `GET /starmc/pay => ${res.status}`,
      };
    }

    const text = await res.text();
    const htmlLike = /<html|<!doctype html/i.test(text);
    return {
      name: 'xpay-page',
      ok: htmlLike,
      detail: htmlLike ? 'xpay pay page reachable' : 'xpay response is not an HTML pay page',
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
  try {
    const res = await safeFetch(`${BACKEND_URL}/api/qianfu/health`);
    if (!res.ok) {
      return {
        name: 'qianfu-health',
        ok: false,
        detail: `GET /api/qianfu/health => ${res.status}`,
      };
    }

    const parsed = await parseJsonResponse(res);
    if (!parsed.ok) {
      return {
        name: 'qianfu-health',
        ok: false,
        detail: `/api/qianfu/health invalid response: ${parsed.detail}`,
      };
    }

    // 后端统一响应格式：{ success: true, data: { status: 'ok', ... } }
    const status = parsed.data?.status ?? parsed.data?.data?.status;
    return {
      name: 'qianfu-health',
      ok: status === 'ok',
      detail: status === 'ok' ? 'qianfu health JSON ok' : `unexpected status field: ${String(status)}`,
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
  const checks = [...envChecks, ...runtimeChecks];

  const failed = checks.filter((item) => !item.ok);
  for (const item of checks) {
    const icon = item.ok ? '[OK]' : '[FAIL]';
    console.log(`${icon} ${item.name} - ${item.detail}`);
  }

  if (failed.length > 0) {
    console.error(`\nLocal closed loop verification failed: ${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log('\nLocal closed loop verification passed.');
}

main().catch((error) => {
  console.error('Verification crashed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
