import { describe, expect, it } from 'vitest';

import { CHECKIN_REWARD_POLICY } from '../../server/services/checkinRewardPolicy';

describe('check-in reward increase', () => {
  it('uses a modest higher reward range', () => {
    expect(CHECKIN_REWARD_POLICY.baseMinYuan).toBe(0.2);
    expect(CHECKIN_REWARD_POLICY.baseMaxYuan).toBe(0.5);
    expect(CHECKIN_REWARD_POLICY.streakBonusMinYuan).toBe(1);
    expect(CHECKIN_REWARD_POLICY.streakBonusMaxYuan).toBe(3);
  });
});
