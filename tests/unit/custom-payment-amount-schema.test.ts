import { describe, expect, it } from 'vitest';

import { paymentCreateSchema } from '../../server/utils/validation';

const customPayment = (amount: number) => paymentCreateSchema.safeParse({
  planId: 'custom',
  paymentMethod: 'wechat',
  amount,
});

describe('custom payment amount schema', () => {
  it('only accepts wallet recharge amounts from 0.10 to 10,000 yuan', () => {
    expect(customPayment(0.09).success).toBe(false);
    expect(customPayment(0.1).success).toBe(true);
    expect(customPayment(10000).success).toBe(true);
    expect(customPayment(10000.01).success).toBe(false);
  });
});
