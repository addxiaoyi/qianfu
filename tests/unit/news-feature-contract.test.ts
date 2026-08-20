import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('news feature contract', () => {
  it('exposes a public list endpoint and filters it to active published items', () => {
    const service = read('server/services/announcementService.ts');
    const controller = read('server/controllers/announcementController.ts');
    const routes = read('server/routes/announcements.ts');

    expect(service).toContain('export function filterPublicAnnouncements');
    expect(service).toContain('export async function listPublicAnnouncements');
    expect(controller).toContain('export async function getPublicAnnouncements');
    expect(routes).toContain("router.get('/', getPublicAnnouncements)");
  });

  it('connects the public news page to both desktop and mobile navigation', () => {
    const api = read('qianfu-liandeng/src/api/announcementApi.ts');
    const page = read('qianfu-liandeng/src/pages/News.tsx');
    const app = read('qianfu-liandeng/src/App.tsx');
    const navbar = read('qianfu-liandeng/src/components/layout/Navbar.tsx');

    expect(api).toContain("publicList: () => api.get<Announcement[]>('/announcements', undefined, { useAuth: false })");
    expect(page).toContain('announcementApi.publicList');
    expect(app).toContain('path="/news"');
    expect(app).toContain('<News />');
    expect(navbar).toContain("{ key: 'nav.news', path: '/news'");
  });

  it('gives the public page a featured story, newsroom metrics and a chronological feed', () => {
    const page = read('qianfu-liandeng/src/pages/News.tsx');

    expect(page).toContain('data-testid="news-featured"');
    expect(page).toContain('data-testid="news-metrics"');
    expect(page).toContain('data-testid="news-feed"');
    expect(page).toContain('最新更新');
    expect(page).toContain('共');
  });

  it('renders a newspaper masthead and long-form reading structure', () => {
    const page = read('qianfu-liandeng/src/pages/News.tsx');

    expect(page).toContain('data-testid="news-masthead"');
    expect(page).toContain('data-testid="news-contents"');
    expect(page).toContain('data-testid="news-longform"');
    expect(page).toContain('id="news-longform"');
    expect(page).toContain('阅读时间');
    expect(page).toContain('首发');
    expect(page).toContain('first-letter:mr-3');
    expect(page).toContain('border-l-2 border-accent');
  });

  it('keeps publishing protected by the existing administrator route', () => {
    const routes = read('server/routes/announcementAdmin.ts');
    const adminPage = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');
    const layout = read('qianfu-liandeng/src/components/layout/AdminLayout.tsx');

    expect(routes).toContain("router.use(hasPermission(['admin']))");
    expect(adminPage).toContain('新闻管理');
    expect(layout).toContain("{ label: '新闻管理', path: '/admin-announcements'");
  });
});
