import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({ default: {} }));

import { assertPromoClaimCapacity } from '../../server/controllers/promoController';

const availableCapacity = {
  claimLimitPerUser: 1,
  dailyLimit: 10,
  totalLimit: 100,
  userClaimCount: 0,
  dailyClaimCount: 2,
  totalClaimCount: 20,
};

describe('promotion claim capacity', () => {
  it('allows a claim when every configured limit has capacity', () => {
    expect(() => assertPromoClaimCapacity(availableCapacity)).not.toThrow();
  });

  it.each([
    [{ ...availableCapacity, userClaimCount: 1 }, 'Per-user claim limit reached'],
    [{ ...availableCapacity, dailyClaimCount: 10 }, 'Daily claim limit reached'],
    [{ ...availableCapacity, totalClaimCount: 100 }, 'Total claim limit reached'],
  ] as const)('rejects exhausted capacity', (capacity, message) => {
    expect(() => assertPromoClaimCapacity(capacity)).toThrow(message);
  });

  it('treats null daily and total limits as unlimited', () => {
    expect(() => assertPromoClaimCapacity({
      ...availableCapacity,
      dailyLimit: null,
      totalLimit: null,
      dailyClaimCount: 10_000,
      totalClaimCount: 10_000,
    })).not.toThrow();
  });
});
