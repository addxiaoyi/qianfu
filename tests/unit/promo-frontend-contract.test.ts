import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const api = read('qianfu-liandeng/src/api/promotionApi.ts');
const app = read('qianfu-liandeng/src/App.tsx');
const claims = read('qianfu-liandeng/src/pages/admin/AdminPromoClaims.tsx');
const taskDetail = read('qianfu-liandeng/src/pages/admin/AdminPromoDetail.tsx');
const taskEditor = read('qianfu-liandeng/src/pages/admin/AdminPromoCreate.tsx');
const mobileHome = read('qianfu-liandeng/src/pages/MobileHome.tsx');

describe('promotion frontend API contract', () => {
  it('uses a stable idempotency header for claim submission', () => {
    expect(api).toContain("headers: { 'Idempotency-Key': key }")
  })

  it('uses administrator-only read endpoints in administrator pages', () => {
    expect(claims).toContain("'/promo/admin/claims'")
    expect(claims).not.toContain("'/promo/claims/me'")
    expect(taskDetail).toContain('`/promo/admin/tasks/${taskId}?page=${page}&limit=${limit}`')
    expect(taskEditor).toContain('`/promo/admin/tasks/${taskId}`')
  })

  it('closes commercial promotion surfaces under the personal filing policy', () => {
    expect(app).toContain('<Route path="/promotion/*" element={<CommercialFeatureDisabled />} />')
    expect(app).not.toContain('<Route path="/promotion" element={<PromotionOverview />} />')
    expect(app).not.toContain('<Route path="/promotion/tasks-center" element={<RequireAuth><PromotionLanding /></RequireAuth>} />')
    expect(app).not.toContain('<RequireAdmin><AdminPromoTasks /></RequireAdmin>')
    expect(app).not.toContain('<RequireAdmin><AdminLayout><AdminPromoClaims /></AdminLayout></RequireAdmin>')
  })

  it('routes legacy promotion entries to the explicit closure page', () => {
    expect(app).toContain('<Route path="/promotion/*" element={<CommercialFeatureDisabled />} />')
    expect(app).not.toContain('Navigate to="/admin-promo/claims"')
    expect(app).not.toContain('path="/admin-promo/claims"')
  })

  it('accepts production administrator roles and explains denied access', () => {
    expect(app).toContain("String(user?.role || '').toUpperCase()")
    expect(app).toContain("['ADMIN', 'SUPER_ADMIN']")
    expect(app).toContain('你没有权限访问此页面')
  })

  it('keeps retired promotion links fail-closed in the mobile shell', () => {
    const mobileRoutes = app.slice(
      app.indexOf('const mobileRoutes'),
      app.indexOf('const desktopRoutes'),
    );

    expect(mobileRoutes).toContain('<Route path="/promotion/*" element={<CommercialFeatureDisabled />} />');
    expect(mobileRoutes).not.toContain('path="/promotion/tasks-center"');
    expect(mobileRoutes).not.toContain('path="/promotion/tasks"');
    expect(mobileRoutes).not.toContain('path="/promotion/claims"');
  })

  it('does not advertise retired commercial features from the mobile home', () => {
    expect(mobileHome).not.toContain("name: '推广'");
    expect(mobileHome).not.toContain("path: '/promotion'");
    expect(mobileHome).not.toContain("name: '支付'");
  })
})
