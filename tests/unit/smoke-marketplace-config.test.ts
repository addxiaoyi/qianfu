import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('marketplace smoke target defaults', () => {
  it('uses the product API port when no smoke base URL is configured', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/smoke-marketplace-closure.ts'), 'utf8');

    expect(source).toContain("process.env.SMOKE_WEB_BASE_URL || 'http://127.0.0.1:3000'");
    expect(source).not.toContain("process.env.SMOKE_WEB_BASE_URL || 'http://127.0.0.1:3001'");
  });
});
