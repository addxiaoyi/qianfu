import { describe, expect, it } from 'vitest';
import { maskData } from '../../server/utils/masking';

describe('response masking date preservation', () => {
  it('keeps Date values intact for JSON serialization', () => {
    const date = new Date('2026-08-10T08:30:00.000Z');
    const masked = maskData({ time: date }) as { time: Date };

    expect(masked.time).toBeInstanceOf(Date);
    expect(masked.time.toISOString()).toBe(date.toISOString());
    expect(JSON.stringify(masked)).toBe('{"time":"2026-08-10T08:30:00.000Z"}');
  });
});
