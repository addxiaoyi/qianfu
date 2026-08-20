import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('personal filing closure order', () => {
  it('runs before anti-crawler so commercial APIs keep a stable closure error', () => {
    const source = read('server/bootstrap/middlewareLayers.ts');

    expect(source).toContain("import { commercialFeatureClosure } from '../middleware/commercialFeatureClosure';");

    const closureIndex = source.indexOf('app.use(commercialFeatureClosure);');
    const antiCrawlerIndex = source.indexOf('app.use(antiCrawler);');

    expect(closureIndex).toBeGreaterThan(-1);
    expect(antiCrawlerIndex).toBeGreaterThan(-1);
    expect(closureIndex).toBeLessThan(antiCrawlerIndex);
  });
});
