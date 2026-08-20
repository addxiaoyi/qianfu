import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({
  default: {},
}));

vi.mock('../../server/services/redisService', () => ({
  redisService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import {
  canEditMarketplaceShop,
  getEffectiveMarketplaceVerificationStatus,
} from '../../server/services/marketplaceShopService';

describe('marketplace shop policy helpers', () => {
  it('allows only the exact seller to edit a shop', () => {
    expect(canEditMarketplaceShop(42, 42)).toBe(true);
    expect(canEditMarketplaceShop(7, 42)).toBe(false);
    expect(canEditMarketplaceShop(null, 42)).toBe(false);
  });

  it('expires a verified badge at the configured instant', () => {
    const expiry = new Date('2027-01-01T00:00:00.000Z');

    expect(getEffectiveMarketplaceVerificationStatus(
      'VERIFIED',
      expiry,
      new Date('2026-12-31T23:59:59.999Z'),
    )).toBe('VERIFIED');
    expect(getEffectiveMarketplaceVerificationStatus('VERIFIED', expiry, expiry)).toBe('EXPIRED');
  });

  it('does not treat unknown persisted values as verified', () => {
    expect(getEffectiveMarketplaceVerificationStatus('LEGACY_APPROVED', null)).toBe('UNVERIFIED');
  });
});
