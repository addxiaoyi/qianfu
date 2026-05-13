import { describe, it, expect } from 'vitest';
import { compareVersionsQuerySchema } from '../../server/utils/validation';

describe('compareVersionsQuerySchema', () => {
  it('parses valid old/new', () => {
    const r = compareVersionsQuerySchema.safeParse({ old: '1', new: '2' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.old).toBe(1);
      expect(r.data.new).toBe(2);
    }
  });

  it('rejects non-numeric', () => {
    const r = compareVersionsQuerySchema.safeParse({ old: 'a', new: '2' });
    expect(r.success).toBe(false);
  });
});
