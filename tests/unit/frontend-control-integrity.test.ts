import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('frontend control integrity', () => {
  it('implements server sharing and removes decorative comment toolbar buttons', () => {
    const page = read('qianfu-liandeng/src/pages/ServerDetail.tsx');

    expect(page).toContain('const shareServer = async () =>');
    expect(page).toContain('navigator.share');
    expect(page).toContain('onClick={() => { void shareServer(); }}');
    expect(page).not.toContain("const SAFE_IMAGE_PROTOCOLS = new Set(['https:', 'data:'])");
    expect(page).not.toContain('<button type="button" className="p-4 hover:text-black transition-colors"><Zap');
  });

  it('renders the actual schema in form preview mode', () => {
    const builder = read('qianfu-liandeng/src/forms/FormBuilder.tsx');

    expect(builder).toContain("import FormRenderer from './FormRenderer'");
    expect(builder).toContain('<FormRenderer<Record<string, unknown>>');
    expect(builder).not.toContain('预览模式 - 可在此处渲染实际表单');
  });

  it('gives promotion verification and metric note controls visible labels', () => {
    const landing = read('qianfu-liandeng/src/pages/PromotionLanding.tsx');
    const claimDetail = read('qianfu-liandeng/src/pages/admin/components/AdminPromoClaimDetail.tsx');

    expect(landing).toContain('{getPromoPlatformLabel(item.platform)}公开页面链接');
    expect(landing).toContain('aria-describedby={`promo-binding-verification-hint-${item.id}`}');
    expect(claimDetail).toContain('数据来源或人工核验说明（可选）');
    expect(claimDetail).toContain('placeholder="填写数据来源或人工核验说明"');
  });
});
