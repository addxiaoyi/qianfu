import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('qianfu-liandeng/src/pages/admin/AdminPaymentConfig.tsx', 'utf8');

describe('admin payment configuration surface', () => {
  it('keeps the qianfu project as the single primary editing surface', () => {
    expect(page).toContain("const MAIN_PROJECT_KEY = 'qianfu';");
    expect(page).toContain("data?.projects.find((item) => item.key === MAIN_PROJECT_KEY)");
    expect(page).not.toContain('新增支付项目');
    expect(page).not.toContain('搜索支付项目');
  });

  it('shows a single primary provider editor instead of a dual-channel switcher', () => {
    expect(page).toContain('主支付通道');
    expect(page).toContain('当前通道配置');
    expect(page).not.toContain('备用通道配置');
    expect(page).not.toContain('target ===');
    expect(page).not.toContain('backup-provider');
    expect(page).not.toContain('backupUpstreamProvider');
  });

  it('uses the shared custom select for payment provider choices', () => {
    expect(page).toContain("import CustomSelect from '@/components/ui/CustomSelect';");
    expect(page).not.toContain('<select');
  });

  it('keeps saving through the qianfu payment project API', () => {
    expect(page).toContain("api.put(`/admin/payment-projects/${MAIN_PROJECT_KEY}`");
    expect(page).toContain('key: MAIN_PROJECT_KEY');
  });

  it('starts test orders in custom mode so the default amount passes validation', () => {
    expect(page).toContain("useState('custom')");
    expect(page).toContain("useState('0.10')");
  });

  it('uses masked secret metadata when calculating provider completeness', () => {
    expect(page).toContain('const hasConfiguredValue =');
    expect(page).toContain('config.maskedSecrets?.[String(field)]');
    expect(page).toContain("hasConfiguredValue(config, 'qiupayKey')");
  });
});
