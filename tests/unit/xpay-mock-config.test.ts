import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'scripts/xpay-mock-server.cjs'), 'utf8');

describe('local XPay mock configuration', () => {
  it('allows an isolated port so the mock does not take over another local service', () => {
    expect(source).toContain("const PORT = Number(process.env.XPAY_MOCK_PORT || process.env.PORT || 8080);");
  });
});
