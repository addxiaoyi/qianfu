import { describe, expect, it } from 'vitest';
import { safeJsonParse } from '../../server/utils/json.js';

describe('safeJsonParse', () => {
  it('returns the typed fallback when JSON is malformed', () => {
    const fallback = { enabled: false };

    expect(safeJsonParse('{"enabled":', fallback)).toBe(fallback);
  });
});
