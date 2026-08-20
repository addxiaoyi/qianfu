import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('administrator entry navigation contracts', () => {
  it('keeps the live admin shell grouped and connected to both public shells', () => {
    const layout = read('qianfu-liandeng/src/components/layout/AdminLayout.tsx');

    expect(layout).toContain('const adminNavGroups');
    expect(layout).toContain('工作台');
    expect(layout).toContain('用户与内容');
    expect(layout).toContain('审计与安全');
    expect(layout).toContain('系统设置');
    expect(layout).not.toContain('运营与财务');
    expect(layout).not.toMatch(/支付|钱包|推广|商城/);
    expect(layout).toContain('to="/dashboard"');
    expect(layout).toContain('to="/"');
    expect(layout).toContain('data-admin-entry="admin-layout"');
  });

  it('exposes the admin entry only to administrators in the global shell', () => {
    const navbar = read('qianfu-liandeng/src/components/layout/Navbar.tsx');

    expect(navbar).toContain('const isAdmin = String(user?.role || \'\').toUpperCase() === \'ADMIN\';');
    expect(navbar).toContain('isAdmin &&');
    expect(navbar).toContain('data-admin-entry="navbar"');
    expect(navbar).toContain('to="/admin"');
  });

  it('puts a prominent admin entry at the top of the administrator dashboard sidebar', () => {
    const dashboard = read('qianfu-liandeng/src/pages/Dashboard.tsx');

    expect(dashboard).toContain('{isSuperAdmin ? (');
    expect(dashboard).toContain('data-admin-entry="dashboard"');
    expect(dashboard).toContain('管理后台');
    expect(dashboard).toContain('to="/admin"');
  });
});
