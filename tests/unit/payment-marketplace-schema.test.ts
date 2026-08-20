import { describe, expect, it } from 'vitest';

import { paymentCreateSchema } from '../../server/utils/validation';

describe('marketplace payment creation schema', () => {
  it('accepts a marketplace checkout without a client-supplied amount', () => {
    expect(paymentCreateSchema.safeParse({
      planId: 'marketplace',
      marketplaceOrderId: 'ord_123',
      paymentMethod: 'alipay',
    }).success).toBe(true);
  });

  it('requires the order id for marketplace checkout', () => {
    expect(paymentCreateSchema.safeParse({
      planId: 'marketplace',
      paymentMethod: 'alipay',
    }).success).toBe(false);
  });

  it('still requires an amount for ordinary payment plans', () => {
    expect(paymentCreateSchema.safeParse({
      planId: 'custom',
      paymentMethod: 'alipay',
    }).success).toBe(false);
  });
});
