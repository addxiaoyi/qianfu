import { describe, expect, it } from 'vitest';
import {
  formatLogTime,
  formatLogTimestamp,
  parseLogDate,
} from '../../qianfu-liandeng/src/pages/admin/adminLogTime';

describe('admin log time formatting', () => {
  it('parses ISO timestamps and formats a readable date', () => {
    const value = '2026-08-10T08:30:00.000Z';

    expect(parseLogDate(value)?.toISOString()).toBe(value);
    expect(formatLogTime(value)).not.toContain('Invalid Date');
    expect(formatLogTimestamp(value)).toBe(Date.parse(value));
  });

  it('accepts millisecond and second timestamps', () => {
    const milliseconds = Date.parse('2026-08-10T08:30:00.000Z');
    const seconds = milliseconds / 1000;

    expect(parseLogDate(milliseconds)?.getTime()).toBe(milliseconds);
    expect(parseLogDate(seconds)?.getTime()).toBe(milliseconds);
  });

  it('accepts Date objects', () => {
    const value = new Date('2026-08-10T08:30:00.000Z');

    expect(parseLogDate(value)).toEqual(value);
    expect(formatLogTimestamp(value)).toBe(value.getTime());
  });

  it('returns placeholders for missing or invalid values', () => {
    for (const value of [undefined, null, '', 'not-a-date', Number.NaN, Infinity]) {
      expect(parseLogDate(value)).toBeNull();
      expect(formatLogTime(value)).toBe('--');
      expect(formatLogTimestamp(value)).toBe('--');
    }
  });
});
