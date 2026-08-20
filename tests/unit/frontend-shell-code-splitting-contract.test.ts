import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('frontend shell code splitting', () => {
  it('keeps route-specific shells out of the synchronous application entry', () => {
    const app = read('qianfu-liandeng', 'src', 'App.tsx');

    expect(app).toContain('const Navbar = lazy(() => import("@/components/layout/Navbar"))');
    expect(app).toContain('const Footer = lazy(() => import("@/components/layout/Footer"))');
    expect(app).toContain('const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"))');
    expect(app).toContain('const MobileWrapperPage = lazy(() => import("@/components/mobile/MobileWrapperPage"))');
    expect(app).toContain('const AnnouncementBanner = lazy(() => import("@/components/business/AnnouncementBanner"))');
    expect(app).toContain('const DynamicBranding = lazy(() => import("@/components/business/DynamicBranding"))');
    expect(app).not.toContain('import Navbar from "@/components/layout/Navbar"');
    expect(app).not.toContain('import MobileWrapperPage from "@/components/mobile/MobileWrapperPage"');
    expect(app).toContain('{!isMobileShell ? (');
  });

  it('loads the heavy AI assistant panel only after idle time or explicit interaction', () => {
    const loader = read('qianfu-liandeng', 'src', 'components', 'form', 'GlobalSettingsPanel.tsx');
    const panel = read('qianfu-liandeng', 'src', 'components', 'form', 'GlobalAssistantPanel.tsx');

    expect(loader).toContain("lazy(() => import('./GlobalAssistantPanel'))");
    expect(loader).toContain('requestIdleCallback');
    expect(loader).toContain('setOpenOnMount(true)');
    expect(loader).not.toContain("from 'gsap'");
    expect(loader).not.toContain("from 'markdown-it'");
    expect(panel).toContain("from 'gsap'");
    expect(panel).toContain("from 'markdown-it'");
    expect(panel).toContain('initialOpen?: boolean');
  });
});
