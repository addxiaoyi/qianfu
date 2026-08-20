import { describe, expect, it } from 'vitest';

import { resolvePaymentProviderCandidates } from '../../server/services/paymentProviderSelection';

describe('primary payment provider mode', () => {
  it('does not silently fall back to a backup provider', () => {
    expect(resolvePaymentProviderCandidates({
      paymentMethod: 'wechat',
      primaryProvider: 'xpay',
      backupProvider: 'qiupay',
    })).toEqual(['xpay']);
  });
});
