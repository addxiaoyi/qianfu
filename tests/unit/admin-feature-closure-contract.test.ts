import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('administrator feature closure contracts', () => {
  it('names the news image picker for keyboard and assistive access', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');

    expect(page).toContain('aria-label="选择新闻图片"');
    expect(page).toContain("uploadImageFile(file, 'announcement-image')");
  });

  it('shows an actionable XPay tenant query failure state', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminPaymentConfig.tsx');

    expect(page).toContain('xpayTenantQuery.isError');
    expect(page).toContain('xpayTenantQuery.refetch()');
    expect(page).toContain('租户状态读取失败');
  });
});
