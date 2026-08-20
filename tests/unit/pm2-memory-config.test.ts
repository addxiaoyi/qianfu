import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('production PM2 memory guardrails', () => {
  it('keeps every production ecosystem config at the 384MB heap restart limit', () => {
    const cjs = read('ecosystem.config.cjs');
    const jsonLike = read('ecosystem.config.js');

    for (const source of [cjs, jsonLike]) {
      expect(source).toContain('384M');
      expect(source).toContain('max-old-space-size=384');
      expect(source).not.toContain('max-old-space-size=1024');
      expect(source).not.toContain('"max_memory_restart": "1G"');
    }
  });
});
