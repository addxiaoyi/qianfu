import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd());

describe('public promotion overview contract', () => {
  it('does not expose a public promotion overview in personal filing mode', () => {
    const app = readFileSync(resolve(root, 'qianfu-liandeng/src/App.tsx'), 'utf8');

    expect(app).not.toContain('const PromotionOverview = lazy(() => import("./pages/PromotionOverview"));');
    expect(app).not.toContain('<Route path="/promotion" element={<PromotionOverview />} />');
  });

  it('keeps the retired promotion module as an explicit closure page', () => {
    const pagePath = resolve(root, 'qianfu-liandeng/src/pages/PromotionOverview.tsx');
    expect(existsSync(pagePath)).toBe(true);
    if (!existsSync(pagePath)) return;

    const page = readFileSync(pagePath, 'utf8');
    expect(page).toContain("from './CommercialFeatureDisabled'");
    expect(page).toContain('<CommercialFeatureDisabled />');
  });
});
