import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'qianfu-liandeng/src/pages/MarketplaceManage.tsx'),
  'utf8',
);

describe('marketplace seller upload contract', () => {
  it('uses the CSRF-aware API client for seller asset uploads', () => {
    expect(source).toMatch(/api\.post(?:<[^>]+>)?\('\/upload', form/);
    expect(source).not.toContain("fetch('/api/upload'");
  });
});
