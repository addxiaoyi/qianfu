import { describe, expect, it } from 'vitest';

import {
  evaluatePromoRewardTier,
  getPromoMaxRewardAmount,
  parsePromoRewardPolicy,
} from '../../server/services/promoRewardPolicyService';

describe('popular video tier reward policy', () => {
  const policy = parsePromoRewardPolicy({
    mode: 'POPULAR_VIDEO_TIERED',
    observationHours: 168,
    settlementMode: 'HIGHEST_TIER_DIFF',
    contentRequirements: { keywords: ['千服'], hashtags: ['STARMC'], disclosureRequired: true },
    tiers: [
      { key: 'basic', name: '基础传播', minViews: 1_000, rewardAmount: 500 },
      { key: 'hot', name: '热门作品', minViews: 10_000, minLikes: 300, rewardAmount: 5_000 },
      { key: 'viral', name: '爆款作品', minViews: 100_000, minLikes: 3_000, rewardAmount: 30_000 },
    ],
  }, 0);

  it('selects the highest fully qualified tier', () => {
    expect(policy.mode).toBe('POPULAR_VIDEO_TIERED');
    if (policy.mode !== 'POPULAR_VIDEO_TIERED') return;
    const result = evaluatePromoRewardTier(policy, { views: 15_000, likes: 500 });
    expect(result.qualifiedTier?.key).toBe('hot');
    expect(result.nextTier?.key).toBe('viral');
    expect(result.isHighestTier).toBe(false);
  });

  it('requires every configured threshold in a tier', () => {
    expect(policy.mode).toBe('POPULAR_VIDEO_TIERED');
    if (policy.mode !== 'POPULAR_VIDEO_TIERED') return;
    const result = evaluatePromoRewardTier(policy, { views: 20_000, likes: 20 });
    expect(result.qualifiedTier?.key).toBe('basic');
  });

  it('reports the maximum cumulative reward', () => {
    expect(getPromoMaxRewardAmount(policy)).toBe(30_000);
  });

  it('treats absent or blank legacy rule configs as fixed rewards', () => {
    expect(parsePromoRewardPolicy(undefined, 800)).toEqual({ mode: 'LEGACY_FIXED', rewardAmount: 800 });
    expect(parsePromoRewardPolicy(null, 800)).toEqual({ mode: 'LEGACY_FIXED', rewardAmount: 800 });
    expect(parsePromoRewardPolicy('   ', 800)).toEqual({ mode: 'LEGACY_FIXED', rewardAmount: 800 });
  });

  it('still rejects malformed non-empty rule configs', () => {
    expect(() => parsePromoRewardPolicy('{invalid', 800)).toThrow();
    expect(() => parsePromoRewardPolicy('[]', 800)).toThrow('object');
    expect(() => parsePromoRewardPolicy(42, 800)).toThrow('object');
  });

  it('rejects non-increasing rewards and threshold-free tiers', () => {
    expect(() => parsePromoRewardPolicy({
      mode: 'POPULAR_VIDEO_TIERED',
      observationHours: 24,
      settlementMode: 'HIGHEST_TIER_DIFF',
      contentRequirements: { keywords: [], hashtags: [], disclosureRequired: false },
      tiers: [
        { key: 'one', name: '一档', minViews: 100, rewardAmount: 1000 },
        { key: 'two', name: '二档', rewardAmount: 900 },
      ],
    }, 0)).toThrow();
  });
});
