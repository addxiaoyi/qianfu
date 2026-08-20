import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'scripts/verify-local-closed-loop.ts'), 'utf8');

describe('local closed-loop verifier environment contract', () => {
  it('loads the repository .env before evaluating readiness flags', () => {
    expect(source).toContain("import dotenv from 'dotenv';");
    expect(source).toContain('dotenv.config({ path: resolve(process.cwd(), \'.env\') });');
  });

  it('accepts the versioned payment callback route used by the backend', () => {
    expect(source).toContain("'/api/v1/payment/xpay/notify'");
  });

  it('uses the bundled XPay mock service defaults for its pay-page probe', () => {
    expect(source).toContain("const XPAY_URL = process.env.XPAY_URL || 'http://127.0.0.1:8080';");
    expect(source).toContain("const XPAY_PAY_PATH = process.env.XPAY_PAY_PATH || '/api/pay';");
    expect(source).toContain('`${XPAY_URL}${XPAY_PAY_PATH}`');
    expect(source).not.toContain("`${XPAY_URL}/starmc/pay`");
  });

  it('probes the versioned CSRF and QianFu health routes and accepts the current health shape', () => {
    expect(source).toContain("'/api/v1/csrf-token'");
    expect(source).toContain("'/api/v1/qianfu/health'");
    expect(source).toContain("status === 'ok' || status === 'healthy'");
    expect(source).toContain('const healthy = ready === true;');
    expect(source).not.toContain("`${BACKEND_URL}/api/qianfu/health`");
  });

  it('verifies payment creation, callback settlement, QR data, and replay-safe wallet credit', () => {
    expect(source).toContain("'/api/v1/payment/create'");
    expect(source).toContain('paymentUrl');
    expect(source).toContain('paymentQrContent');
    expect(source).toContain('/api/internal/simulate-callback/');
    expect(source).toContain("'/api/v1/payment/status/'");
    expect(source).toContain('COMPLETED');
    expect(source).toContain('wallet-after-callback');
    expect(source).toContain('wallet-after-replay');
    expect(source).toContain('replay-delta=0');
  });
});
