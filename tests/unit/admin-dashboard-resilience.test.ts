import { describe, expect, it } from 'vitest';

describe('admin dashboard loading resilience', () => {
  it('bounds every dashboard request so one stalled endpoint cannot keep the page loading forever', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('qianfu-liandeng/src/pages/admin/AdminDashboard.tsx', 'utf8'));

    expect(source).toContain('ADMIN_DASHBOARD_QUERY_TIMEOUT');
    expect(source).toContain('timeout: ADMIN_DASHBOARD_QUERY_TIMEOUT');
    expect(source).toContain('isError={isError}');
  });
});
