import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

describe('后台紧凑密度契约', () => {
  it('在后台布局作用域启用紧凑密度规则', () => {
    const layout = readSource('../../../../src/components/layout/AdminLayout.tsx');
    const styles = readSource('../../../../src/index.css');

    expect(layout).toContain('admin-density');
    expect(styles).toContain('.admin-density');
    expect(styles).toContain('.admin-density .p-16');
    expect(styles).toContain('.admin-density .space-y-16');
  });

  it('公共页头和统计卡不再使用展示型超大尺寸', () => {
    const header = readSource('../../../../src/components/ui/AdminPageHeader.tsx');
    const statCard = readSource('../../../../src/components/ui/AdminStatCard.tsx');

    expect(header).not.toContain('lg:text-8xl');
    expect(header).not.toContain('lg:gap-16');
    expect(statCard).not.toContain('lg:text-6xl');
    expect(statCard).not.toContain('p-12');
    expect(statCard).not.toContain('rounded-[4rem]');
  });
});
