import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('announcement feature contract', () => {
  it('mounts public and administrator announcement routes', () => {
    const routes = read('server/routes/index.ts');
    expect(routes).toContain("app.use(`${V1}/announcements`, announcementRoutes)");
    expect(routes).toContain("app.use(`${V1}/admin/announcements`, announcementAdminRoutes)");
  });

  it('protects administrator mutations with auth, CSRF and idempotency', () => {
    const routes = read('server/routes/announcementAdmin.ts');
    expect(routes).toContain("router.use(authenticate)");
    expect(routes).toContain("router.use(hasPermission(['admin']))");
    expect(routes).toContain('csrfProtection');
    expect(routes).toContain('createIdempotencyMiddleware');
  });

  it('connects the banner and administrator page to real APIs', () => {
    const banner = read('qianfu-liandeng/src/components/business/AnnouncementBanner.tsx');
    const page = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');
    const api = read('qianfu-liandeng/src/api/announcementApi.ts');
    const app = read('qianfu-liandeng/src/App.tsx');

    expect(banner).toContain('announcementApi.current');
    expect(page).toContain('announcementApi.list');
    expect(api).toContain("'/announcements/current'");
    expect(api).toContain("'/admin/announcements'");
    expect(app).toContain('path="/admin-announcements"');
    expect(app).toContain('<AdminAnnouncements />');
  });

  it('refreshes the public news query after an administrator edit', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');

    expect(page).toContain("queryClient.invalidateQueries({ queryKey: ['public-news'] })");
  });

  it('uses the shared accessible select for editor option fields', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');

    expect(page).toContain("import CustomSelect from '@/components/ui/CustomSelect'");
    expect(page).toContain('<CustomSelect');
    expect(page).not.toContain('<select');
  });

  it('keeps administrator publishing aligned with the newspaper reading experience', () => {
    const page = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');

    expect(page).toContain('联灯日报编辑部');
    expect(page).toContain('MAX_NEWS_MESSAGE_LENGTH');
    expect(page).toContain('maxLength={MAX_NEWS_MESSAGE_LENGTH}');
    expect(page).toContain('data-testid="newspaper-preview"');
    expect(page).toContain('parseAnnouncementMessage');
    expect(page).toContain('阅读时间约');
  });
});
