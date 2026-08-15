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
});
