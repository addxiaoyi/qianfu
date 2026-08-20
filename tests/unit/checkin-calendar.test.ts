import { describe, expect, it } from 'vitest';

import {
  CHECKIN_TIME_ZONE,
  getDisplayedCheckinStreak,
  getCheckinDayKey,
  getNextCheckinStreak,
} from '../../server/services/checkinCalendar';

describe('check-in calendar', () => {
  it('uses the platform timezone for the daily boundary', () => {
    expect(CHECKIN_TIME_ZONE).toBe('Asia/Shanghai');
    expect(getCheckinDayKey(new Date('2026-08-10T15:59:59.999Z'))).toBe('2026-08-10');
    expect(getCheckinDayKey(new Date('2026-08-10T16:00:00.000Z'))).toBe('2026-08-11');
  });

  it('does not let a caller choose a different day boundary', () => {
    const beforeMidnight = new Date('2026-08-10T15:59:59.999Z');
    const afterMidnight = new Date('2026-08-10T16:00:00.000Z');

    expect(Reflect.apply(getCheckinDayKey, null, [beforeMidnight, 'Pacific/Honolulu'])).toBe('2026-08-10');
    expect(Reflect.apply(getCheckinDayKey, null, [afterMidnight, 'Pacific/Honolulu'])).toBe('2026-08-11');
  });

  it('continues a streak only across the next canonical day', () => {
    expect(getNextCheckinStreak('2026-08-10', 4, '2026-08-11')).toBe(5);
    expect(getNextCheckinStreak('2026-08-10', 4, '2026-08-12')).toBe(1);
    expect(getNextCheckinStreak('2026-08-10', 4, '2026-08-10')).toBe(1);
  });

  it('drops a stale streak after a missed day', () => {
    expect(getDisplayedCheckinStreak('2026-08-10', 4, '2026-08-10')).toBe(4);
    expect(getDisplayedCheckinStreak('2026-08-10', 4, '2026-08-11')).toBe(4);
    expect(getDisplayedCheckinStreak('2026-08-10', 4, '2026-08-12')).toBe(0);
  });
});
