import { describe, expect, it } from 'vitest';

import {
  CHECKIN_REWARD_POLICY,
  getCheckinBaseReward,
  getCheckinStreakBonus,
} from '../../server/services/checkinRewardPolicy';

describe('check-in reward policy', () => {
  it('keeps the daily reward within the low-value wallet range', () => {
    expect(getCheckinBaseReward(0)).toBe(CHECKIN_REWARD_POLICY.baseMinYuan);
    expect(getCheckinBaseReward(1)).toBe(CHECKIN_REWARD_POLICY.baseMaxYuan);
  });

  it('caps the weekly streak bonus and only grants it every seven days', () => {
    expect(getCheckinStreakBonus(6, 1)).toBe(0);
    expect(getCheckinStreakBonus(7, 0)).toBe(CHECKIN_REWARD_POLICY.streakBonusMinYuan);
    expect(getCheckinStreakBonus(7, 1)).toBe(CHECKIN_REWARD_POLICY.streakBonusMaxYuan);
  });
});
