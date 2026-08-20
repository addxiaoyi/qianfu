import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const payment = read('server/controllers/paymentController.ts');
const marketplaceOrderService = read('server/services/marketplaceOrderService.ts');

describe('payment marketplace completion contract', () => {
  it('keeps marketplace and payment amounts in fen', () => {
    expect(marketplaceOrderService).toContain('amount: totalPrice,');
    expect(marketplaceOrderService).not.toContain('amount: Math.round(totalPrice * 100),');
  });

  it('routes both completion entry points through one side-effect service', () => {
    expect(payment).toContain("from '../services/paymentCompletionService'");
    expect(payment).toContain('completePaymentWithSideEffects');
    expect(payment).toContain('manualCompletePayment');
    expect(payment).toContain('completeExternalPayment');
  });
});
