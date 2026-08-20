import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('legal policy pages contract', () => {
  it('keeps the interactive legal documents routed and linked from the footer', () => {
    const app = read('qianfu-liandeng/src/App.tsx');
    const footer = read('qianfu-liandeng/src/components/layout/Footer.tsx');

    expect(app).toContain('path="/terms"');
    expect(app).toContain('path="/privacy"');
    expect(footer).toContain('to="/terms"');
    expect(footer).toContain('to="/privacy"');
    expect(footer).toContain('隐私声明');
    expect(footer).not.toContain('退款政策');
  });

  it('keeps SEO metadata for public legal routes', () => {
    const seo = read('qianfu-liandeng/src/components/ui/SeoHead.tsx');

    expect(seo).toContain("'/terms': {");
    expect(seo).toContain("'/privacy': {");
    expect(seo).not.toContain("'/refund-policy': {");
  });

  it('keeps the rules page linked from the footer instead of the navbar', () => {
    const app = read('qianfu-liandeng/src/App.tsx');
    const navbar = read('qianfu-liandeng/src/components/layout/Navbar.tsx');
    const footer = read('qianfu-liandeng/src/components/layout/Footer.tsx');

    expect(app).toContain('path="/rules"');
    expect(navbar).not.toContain("key: 'nav.rules'");
    expect(navbar).not.toContain("'/team#community-rules'");
    expect(footer).toContain('to="/rules"');
  });

  it('preserves minimum payment, privacy and consumer-protection disclosures', () => {
    const terms = read('qianfu-liandeng/src/pages/Terms.tsx');
    const privacy = read('qianfu-liandeng/src/pages/Privacy.tsx');
    const refunds = read('qianfu-liandeng/src/pages/RefundPolicy.tsx');

    expect(terms).toContain('平台不提供交易');
    expect(privacy).toContain('平台不会出售个人信息');
    expect(privacy).toContain('您的个人信息权利');
    expect(refunds).toContain('个人备案模式');
    expect(refunds).toContain('不提供支付');
    expect(refunds).not.toMatch(/钱包充值|玩家市场数字商品|原支付方式/);
  });
});
