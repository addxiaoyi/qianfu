import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('marketplace seller workflow closure', () => {
  it('routes retired seller and shop links to the explicit closure page', () => {
    const app = read('qianfu-liandeng/src/App.tsx');

    for (const path of ['/marketplace/*', '/seller/*', '/shop/*']) {
      expect(app).toContain(`path="${path}"`);
    }
    expect(app).toMatch(/path="\/marketplace\/\*" element={<CommercialFeatureDisabled \/>} \/>/);
  });

  it('does not leave seller or marketplace navigation in the mobile shell', () => {
    const home = read('qianfu-liandeng/src/pages/MobileHome.tsx');
    const navbar = read('qianfu-liandeng/src/components/layout/Navbar.tsx');

    expect(home).not.toMatch(/\/marketplace\/|\/seller\/|商城/);
    expect(navbar).not.toMatch(/\/marketplace\/|\/seller\/|商城/);
  });

  it('keeps legacy seller modules out of the active route table', () => {
    const app = read('qianfu-liandeng/src/App.tsx');

    expect(app).not.toContain('const MarketplaceEdit = lazy');
    expect(app).not.toContain('const MarketplaceManage = lazy');
    expect(app).not.toContain('const MarketplaceOrderDetail = lazy');
  });
});
