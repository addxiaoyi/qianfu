import { describe, expect, it } from 'vitest';

import { resolvePaymentProviderCandidates } from '../../server/services/paymentProviderSelection';

describe('payment provider selection', () => {
  it('pins PayPal payment intent to PayPal without cross-provider fallback', () => {
    expect(resolvePaymentProviderCandidates({
      paymentMethod: 'paypal',
      primaryProvider: 'xpay',
      backupProvider: 'creem',
    })).toEqual(['paypal']);
  });

  it('uses only the configured primary provider for local payment methods', () => {
    expect(resolvePaymentProviderCandidates({
      paymentMethod: 'alipay',
      requestedProvider: 'creem',
      primaryProvider: 'xpay',
      backupProvider: 'qiupay',
    })).toEqual(['xpay']);
  });

  it('returns no local provider when the primary provider is PayPal', () => {
    expect(resolvePaymentProviderCandidates({
      paymentMethod: 'wechat',
      primaryProvider: 'paypal',
      backupProvider: 'qiupay',
    })).toEqual([]);
  });
});
