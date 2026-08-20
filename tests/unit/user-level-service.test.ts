import { describe, expect, it } from 'vitest';

import { getLevelProgress, XP_CHECKIN, xpToNextFromLevel } from '../../server/services/userLevelService';

describe('user level progression', () => {
  it('slows early progression so 100 XP reaches level 2 instead of level 3', () => {
    expect(getLevelProgress(99).level).toBe(1);
    expect(getLevelProgress(100).level).toBe(2);
    expect(XP_CHECKIN * 9).toBeLessThan(xpToNextFromLevel(1));
    expect(XP_CHECKIN * 10).toBeGreaterThanOrEqual(xpToNextFromLevel(1));
  });
});
