import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'server/core/controller/QianFuController.ts'),
  'utf8',
);

describe('legacy QianFu callback security', () => {
  it('does not expose the retired payment callback controller', () => {
    expect(source).not.toContain("router.post('/xpay/notify'");
    expect(source).not.toContain('completePaymentWithSideEffects');
    expect(source).not.toContain('parseCallbackAmountFen');
  });
});
