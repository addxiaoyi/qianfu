import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('news submission feature contract', () => {
  it('stores an owned submission with an explicit moderation lifecycle', () => {
    const schema = read('prisma/schema.prisma');
    const service = read('server/services/newsSubmissionService.ts');

    expect(schema).toContain('model NewsSubmission');
    expect(schema).toContain('news_submissions');
    expect(schema).toContain('PENDING, REJECTED, APPROVED');
    expect(service).toContain('newsSubmissionCreateSchema');
    expect(service).toContain("status: 'PENDING'");
    expect(service).toContain('user_id: userId');
    expect(service).toContain('Only pending or rejected submissions can be edited');
  });

  it('protects user submission routes and keeps ownership in the service boundary', () => {
    const routes = read('server/routes/newsSubmissions.ts');
    const controller = read('server/controllers/newsSubmissionController.ts');
    const index = read('server/routes/index.ts');

    expect(index).toContain("app.use(`${V1}/news-submissions`, newsSubmissionRoutes)");
    expect(routes).toContain('router.use(authenticate)');
    expect(routes).toContain('requireVerifiedEmail');
    expect(routes).toContain('csrfProtection');
    expect(routes).toContain('createIdempotencyMiddleware');
    expect(controller).toContain('req.user?.id');
    expect(controller).toContain('updateOwnNewsSubmission');
  });

  it('exposes administrator review actions with a required rejection reason', () => {
    const routes = read('server/routes/newsSubmissionAdmin.ts');
    const service = read('server/services/newsSubmissionService.ts');
    const page = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');

    expect(routes).toContain("router.use(hasPermission(['admin']))");
    expect(routes).toContain('csrfProtection');
    expect(routes).toContain('createIdempotencyMiddleware');
    expect(routes).toContain("router.post('/:id/approve'");
    expect(routes).toContain("router.post('/:id/reject'");
    expect(service).toContain('rejectionReasonSchema');
    expect(service).toContain('rejectionReason.trim()');
    expect(service).toContain('createAnnouncement');
    expect(page).toContain('newsSubmissionApi.adminList');
    expect(page).toContain('newsSubmissionApi.approve');
    expect(page).toContain('newsSubmissionApi.reject');
    expect(page).toContain('驳回原因');
  });

  it('makes the personal center entry and user workflow reachable in both shells', () => {
    const api = read('qianfu-liandeng/src/api/newsSubmissionApi.ts');
    const page = read('qianfu-liandeng/src/pages/NewsSubmission.tsx');
    const profile = read('qianfu-liandeng/src/pages/Profile.tsx');
    const mobile = read('qianfu-liandeng/src/components/mobile/MobileUserCenter.tsx');
    const app = read('qianfu-liandeng/src/App.tsx');

    expect(api).toContain("'/news-submissions/me'");
    expect(api).toContain("'/news-submissions'");
    expect(page).toContain('newsSubmissionApi.create');
    expect(page).toContain('newsSubmissionApi.update');
    expect(page).toContain('我的投稿');
    expect(profile).toContain('投稿新闻');
    expect(profile).toContain('to="/me/news-submit"');
    expect(mobile).toContain("path: '/me/news-submit'");
    expect(app.match(/path="\/me\/news-submit"/g)).toHaveLength(2);
    expect(app).toContain('<NewsSubmission />');
  });
});
