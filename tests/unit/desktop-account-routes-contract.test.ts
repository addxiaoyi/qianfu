import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const app = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/App.tsx'), 'utf8');
const desktopRoutes = app.slice(app.indexOf('const desktopRoutes'));

describe('desktop account routes', () => {
  it('renders protected message and notification pages instead of redirecting them away', () => {
    expect(desktopRoutes).toContain('path="/messages" element={<RequireAuth>');
    expect(desktopRoutes).toContain('<MobileMessages />');
    expect(desktopRoutes).toContain('path="/me/notifications" element={<RequireAuth>');
    expect(desktopRoutes).toContain('<MobileNotifications />');
    expect(desktopRoutes).not.toContain('path="/messages" element={<Navigate');
    expect(desktopRoutes).not.toContain('path="/me/notifications" element={<Navigate');
  });
});
