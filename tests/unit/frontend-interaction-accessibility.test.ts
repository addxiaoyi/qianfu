import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('frontend interaction accessibility', () => {
  it('keeps the interaction AST audit clean', () => {
    const output = execFileSync(process.execPath, ['scripts/audit-frontend-interactions.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(output).toContain('FRONTEND_INTERACTION_FINDINGS=0');
  }, 20_000);

  it('uses native pressed buttons for wallet plan and payment method choices', () => {
    const payment = read('qianfu-liandeng/src/pages/Payment.tsx');

    expect(payment.match(/aria-pressed=\{selectedPlan\.id === plan\.id\}/g)).toHaveLength(2);
    expect(payment).toContain("aria-pressed={paymentMethod === 'wechat'}");
    expect(payment).toContain("aria-pressed={paymentMethod === 'alipay'}");
    expect(payment).toContain('htmlFor="mobile-wallet-custom-amount"');
    expect(payment).toContain('htmlFor="desktop-wallet-custom-amount"');
  });

  it('requires names for form controls and disabled states for direct mutation buttons', () => {
    const audit = read('scripts/audit-frontend-interactions.mjs');
    const paymentConfig = read('qianfu-liandeng/src/pages/admin/AdminPaymentConfig.tsx');
    const announcements = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');
    const promoCreate = read('qianfu-liandeng/src/pages/admin/AdminPromoCreate.tsx');

    expect(audit).toContain("addFinding('form-control-missing-name'");
    expect(audit).toContain("addFinding('mutation-button-missing-disabled'");
    expect(paymentConfig).toContain("const MAIN_PROJECT_KEY = 'qianfu';");
    expect(paymentConfig).toContain('高级配置');
    expect(paymentConfig).toContain("import CustomSelect from '@/components/ui/CustomSelect';");
    expect(paymentConfig.match(/data-form-control-label-from-parent="true"/g)).toHaveLength(2);
    expect(announcements).toContain('const announcementActionPending = statusMutation.isPending || deleteMutation.isPending;');
    expect(announcements.match(/disabled=\{announcementActionPending\}/g)).toHaveLength(4);
    expect(promoCreate).toContain('const writePending = submitMutation.isPending || resetDraftMutation.isPending || saveDraftMutation.isPending;');
    expect(promoCreate.match(/disabled=\{writePending\}/g)).toHaveLength(3);
  });

  it('separates shop version selection and form-field editing from nested actions', () => {
    const shop = read('qianfu-liandeng/src/pages/MarketplaceShop.tsx');
    const builder = read('qianfu-liandeng/src/forms/FormBuilder.tsx');
    const dialog = read('qianfu-liandeng/src/components/form/MatrixDialog.tsx');

    expect(shop).toContain('aria-pressed={selectedVersion?.id === version.id}');
    expect(builder).toContain('aria-pressed={isSelected}');
    expect(builder).toContain('aria-label={`编辑字段：${field.label}`}');
    expect(dialog).toContain('data-noninteractive-click-surface="dismiss-dialog"');
  });
});
