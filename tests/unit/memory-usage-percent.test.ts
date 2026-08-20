import { describe, expect, it } from 'vitest';

import { calculateHeapUsagePercent } from '../../server/utils/memoryUsage';

describe('heap usage percentage', () => {
  it('uses the V8 heap limit instead of the current allocation size', () => {
    expect(calculateHeapUsagePercent(85 * 1024 * 1024, 384 * 1024 * 1024)).toBe(22);
  });

  it('returns zero for an invalid heap limit', () => {
    expect(calculateHeapUsagePercent(85 * 1024 * 1024, 0)).toBe(0);
    expect(calculateHeapUsagePercent(85 * 1024 * 1024, Number.NaN)).toBe(0);
  });
});
