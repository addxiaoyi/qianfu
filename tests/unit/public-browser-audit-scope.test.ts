import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const audit = readFileSync(resolve(process.cwd(), 'scripts/public-live-browser-audit.cjs'), 'utf8');

describe('public browser audit scope', () => {
  it('excludes payment by default and requires an explicit opt-in', () => {
    expect(audit).toContain('PUBLIC_BROWSER_AUDIT_INCLUDE_PAY');
    expect(audit).toContain('let skipPay = !includePay');
    expect(audit).toContain("token === '--include-pay'");
    expect(audit).toContain("token === '--skip-pay'");
  });
});
