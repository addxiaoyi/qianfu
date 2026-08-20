import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'server/routes/promo.ts'), 'utf8');
const readController = readFileSync(
  resolve(process.cwd(), 'server/controllers/promoReadController.ts'),
  'utf8',
);
const legacyController = readFileSync(
  resolve(process.cwd(), 'server/controllers/promoController.ts'),
  'utf8',
);

const adminRoutes = [
  "router.post('/tasks', adminOnly, csrfProtection,",
  "router.patch('/tasks/:id', adminOnly, csrfProtection,",
  "router.post('/tasks/:id/publish', adminOnly, csrfProtection,",
  "router.post('/tasks/:id/pause', adminOnly, csrfProtection,",
  "router.post('/tasks/:id/disable', adminOnly, csrfProtection,",
  "router.get('/admin/tasks/:id', adminOnly,",
  "router.get('/admin/claims', adminOnly,",
  "router.get('/claims/:id/detail', adminOnly,",
  "router.post('/claims/:id/approve', adminOnly, csrfProtection,",
  "router.post('/claims/:id/reject', adminOnly, csrfProtection,",
  "router.get('/admin/summary', adminOnly,",
];

describe('promotion route security policy', () => {
  it.each(adminRoutes)('requires administrator access for %s', (declaration) => {
    expect(source).toContain(declaration);
  });

  it('keeps the user task detail projection private', () => {
    const userDetail = readController.slice(
      readController.indexOf('export const getUserPromoTask'),
      readController.indexOf('export const getAdminPromoTask'),
    );

    expect(userDetail).not.toContain('promoVerifyLog');
    expect(userDetail).not.toContain('include: { user: true }');
    expect(userDetail).not.toContain('verify_detail');
  });

  it('rate limits binding and claim mutations per authenticated user', () => {
    expect(source).toContain("router.post('/bindings', promoBindingLimiter, csrfProtection, bindPlatformAccount)")
    expect(source).toContain("router.post('/claims', promoClaimLimiter, csrfProtection, submitPromoClaim)")
  })

  it('has a single promotion claim handler on the production route', () => {
    expect(source).toContain("import { submitPromoClaim } from '../controllers/promoClaimController'");
    expect(legacyController).not.toContain('export const submitPromoClaim');
  });
});
