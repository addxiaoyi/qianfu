import { describe, expect, it } from 'vitest';
import {
  buildDiscoverySeed,
  createSeededRandom,
  getDiscoveryWeight,
  isPromotionActive,
  weightedShuffle,
} from '../../server/services/serverDiscoveryService';

const now = Date.parse('2026-08-10T00:00:00.000Z');

describe('server discovery weighting', () => {
  it('keeps listing availability independent from promotion expiry', () => {
    const expiredPromotion = {
      listing_plan: 'basic-monthly',
      listing_expires_at: '2026-08-01T00:00:00.000Z',
    };

    expect(isPromotionActive(expiredPromotion, now)).toBe(false);
    expect(getDiscoveryWeight(expiredPromotion, now)).toBe(1);
  });

  it('weights discovery by heat and online players without legacy promotion multipliers', () => {
    const ordinary = { activity: 1, status: { online: false, playersOnline: 0 } };
    const popular = {
      activity: 100,
      like_count: 20,
      comment_count: 5,
      status: { online: true, playersOnline: 80 },
    };

    expect(getDiscoveryWeight(popular, now)).toBeGreaterThan(getDiscoveryWeight(ordinary, now));
  });

  it('keeps random ordering while favoring the heavier candidate', () => {
    const servers = [
      { activity: 100, status: { online: true, playersOnline: 80 } },
      { activity: 0, status: { online: false, playersOnline: 0 } },
    ];

    expect(weightedShuffle(servers, () => 0, now)[0]).toBe(servers[0]);
    expect(weightedShuffle(servers, () => 0.999999, now)[0]).toBe(servers[1]);
  });

  it('produces a repeatable order for pagination within one discovery window', () => {
    const servers = [
      { activity: 10 },
      { activity: 20 },
      { activity: 30 },
    ];

    const first = weightedShuffle(servers, createSeededRandom('window-a'), now);
    const second = weightedShuffle(servers, createSeededRandom('window-a'), now);
    const rotated = weightedShuffle(servers, createSeededRandom('window-b'), now);

    expect(second).toEqual(first);
    expect(rotated).not.toEqual(first);
  });

  it('does not apply a legacy paid multiplier to historical listing data', () => {
    const legacyPaid = {
      listing_plan: 'basic-monthly',
      listing_expires_at: '2026-09-01T00:00:00.000Z',
      activity: 10,
    };
    const ordinary = { activity: 10 };

    expect(isPromotionActive(legacyPaid, now)).toBe(false);
    expect(getDiscoveryWeight(legacyPaid, now)).toBe(getDiscoveryWeight(ordinary, now));
  });

  it('keeps pages from the same discovery window disjoint', () => {
    const servers = [
      { id: 1, activity: 50 },
      { id: 2, activity: 40 },
      { id: 3, activity: 30 },
      { id: 4, activity: 20 },
      { id: 5, activity: 10 },
    ];
    const pageSize = 2;
    const discoverySeed = 'same-discovery-window';
    const fullOrder = weightedShuffle(servers, createSeededRandom(discoverySeed));
    const page1 = fullOrder.slice(0, pageSize);
    const page2 = fullOrder.slice(pageSize, pageSize * 2);
    const page3 = fullOrder.slice(pageSize * 2, pageSize * 3);

    expect(new Set([...page1, ...page2, ...page3]).size).toBe(servers.length);
  });

  it('derives one discovery seed from filters, independent of pagination', () => {
    const window = 123;
    const filters = JSON.stringify(['keyword', 'tag', 'activity']);

    expect(buildDiscoverySeed(filters, window)).toBe(buildDiscoverySeed(filters, window));
  });
});
