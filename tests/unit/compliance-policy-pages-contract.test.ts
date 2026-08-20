import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const policyRoutes = [
  '/minor-protection',
  '/cookies-and-services',
  '/prohibited-items',
  '/ip-complaints',
  '/reporting-rules',
];

describe('compliance policy pages contract', () => {
  it('keeps the compliance center and every policy publicly routed', () => {
    const app = read('qianfu-liandeng/src/App.tsx');
    expect(app).toContain('path="/compliance"');
    expect(app).toContain('const compliancePolicyRoutes');
    for (const route of policyRoutes) {
      expect(app).toContain(`path: '${route}'`);
    }
    expect(app).not.toContain('path="/refund-policy"');
  });

  it('links every policy category from the public footer', () => {
    const footer = read('qianfu-liandeng/src/components/layout/Footer.tsx');
    expect(footer).toContain('to="/prohibited-items"');
    expect(footer).toContain('to="/ip-complaints"');
    expect(footer).toContain('to="/reporting-rules"');
    expect(footer).toContain('to="/compliance"');
    expect(footer).toContain('support@0st.top');
  });

  it('publishes information-service boundaries and evidence requirements', () => {
    const policies = read('qianfu-liandeng/src/pages/CompliancePolicy.tsx');
    expect(policies).toContain('平台不提供支付、充值、钱包、商城交易、数字商品交付、付费推广或返利服务');
    expect(policies).toContain('知识产权投诉规则');
    expect(policies).toContain('举报与内容处置规则');
  });

  it('keeps SEO and breadcrumb metadata for all compliance pages', () => {
    const seo = read('qianfu-liandeng/src/components/ui/SeoHead.tsx');
    const breadcrumb = read('qianfu-liandeng/src/components/layout/Breadcrumb.tsx');
    for (const route of ['/compliance', ...policyRoutes]) {
      expect(seo).toContain(`'${route}': {`);
    }
    expect(breadcrumb).toContain("compliance: '合规与信息服务规则'");
    expect(breadcrumb).not.toContain("'pricing-disclosure'");
  });
});
