import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('administrator server review detail contracts', () => {
  it('exposes the submitted server fields needed for a real review', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminReview.tsx');

    expect(page).toContain('content_html?: string | null');
    expect(page).toContain('thumbnail?: string | null');
    expect(page).toContain('platform?: string | null');
    expect(page).toContain('category?: string | null');
    expect(page).toContain('tags?: string | null');
    expect(page).toContain('network_env?: string | null');
    expect(page).toContain('listing_plan?: string | null');
  });

  it('provides a safe, reachable detail view before approval actions', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminReview.tsx');

    expect(page).toContain('data-review-detail');
    expect(page).toContain("createPortal(");
    expect(page).toContain('查看详情');
    expect(page).toContain('服务器详情');
    expect(page).toContain('stripHtml');
    expect(page).toContain('isImageUrlSafe');
    expect(page).toContain('setDetailAudit(audit)');
    expect(page).toContain('const detailTarget = reviewDetail ?? detailAudit;');
    expect(page).toContain('打开审核操作');
  });

  it('loads full server details when an audit item is opened', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminReview.tsx');
    const routes = read('server/routes/review.ts');
    const controller = read('server/controllers/reviewController.ts');

    expect(page).toContain("['admin-review-detail', detailAudit?.id]");
    expect(page).toContain('/review/${detailAudit!.id}/detail');
    expect(page).toContain('完整详情补充失败');
    expect(routes).toContain("router.get('/:serverId/detail'");
    expect(routes).toContain('getReviewDetail');
    expect(controller).toContain('export const getReviewDetail');
    expect(controller).toContain('content_html: true');
  });

  it('keeps pending server details available to authorized administrators', () => {
    const controller = read('server/controllers/servers/versions.ts');

    expect(controller).toContain("if (server.review_status !== 'APPROVED')");
    expect(controller).toContain("hasAuthorizedPermission(user.role, user.permissions, 'manage_content')");
    expect(controller).toContain('return sendSuccess(res, server, \'Success\')');
  });

  it('keeps the detail panel fields typed and addressable for browser review', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminReview.tsx');

    expect(page).toContain('type ReviewDetailField =');
    expect(page).toContain('const reviewDetailFields =');
    expect(page).toContain('data-review-detail-trigger');
    expect(page).toContain('data-review-detail-dialog');
  });
});
