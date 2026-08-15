import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('mobile core UX contracts', () => {
  it('defines an accessible selection sheet primitive', () => {
    const sheet = read('qianfu-liandeng/src/components/mobile/MobileSelectSheet.tsx');

    expect(sheet).toContain('role="dialog"');
    expect(sheet).toContain('aria-modal="true"');
    expect(sheet).toContain('aria-label="关闭"');
    expect(sheet).toContain('onKeyDown');
    expect(sheet).toContain('aria-pressed');
  });

  it('keeps the mobile shell as the single scroll root', () => {
    const shell = read('qianfu-liandeng/src/components/mobile/MobileLayout.tsx');

    expect(shell).toContain('data-mobile-scroll-root="true"');
    expect(shell).toContain('env(safe-area-inset-bottom)');
    expect(shell).toContain('<MobileBottomNav />');
  });

  it('keeps the mobile home first fold free of viewport-dependent spacer hacks', () => {
    const home = read('qianfu-liandeng/src/pages/MobileHome.tsx');

    expect(home).not.toContain('pt-32');
    expect(home).toContain('精选推荐');
    expect(home).toContain('重新加载');
  });

  it('keeps detail actions reachable inside the bottom safe area', () => {
    const detail = read('qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx');

    expect(detail).toContain('data-testid="server-detail-actions"');
    expect(detail).toContain('pb-[calc(1rem+env(safe-area-inset-bottom))]');
  });

  it('keeps the mobile editor task flow explicit and native-select free', () => {
    const editor = read('qianfu-liandeng/src/pages/ServerEditor.tsx');
    const mobileEditor = read('qianfu-liandeng/src/components/mobile/MobileEditor.tsx');

    expect(editor).toContain('data-testid="mobile-editor-actions"');
    expect(editor).toContain('发布步骤');
    expect(editor).toContain('MobileSelectSheet');
    expect(editor).not.toContain('<select');
    expect(mobileEditor).toContain('data-mobile-editor="true"');
  });

  it('keeps account actions touch-sized while preserving failure recovery', () => {
    const center = read('qianfu-liandeng/src/components/mobile/MobileUserCenter.tsx');

    expect(center).toContain('summaryUnavailable');
    expect(center).toContain('重新加载统计');
    expect(center).toContain('min-h-16 items-center gap-3');
    expect(center).toContain('登录后使用');
  });
});
