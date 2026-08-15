import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = () => fs.readFileSync(
  path.resolve(process.cwd(), 'qianfu-liandeng/src/components/mobile/MobileSearch.tsx'),
  'utf8',
);

describe('mobile server discovery UX contract', () => {
  it('keeps intent entry points and URL-backed discovery state', () => {
    const source = read();

    expect(source).toContain('readDiscoveryFilters');
    expect(source).toContain('toDiscoverySearchParams');
    expect(source).toContain('现在就玩');
    expect(source).toContain('多人活跃');
    expect(source).toContain('刚刚加入');
    expect(source).toContain('清除筛选');
  });

  it('exposes platform, version, and online state controls', () => {
    const source = read();

    expect(source).toContain('服务器平台');
    expect(source).toContain('服务器版本');
    expect(source).toContain('在线状态');
    expect(source).toContain('MobileSelectSheet');
    expect(source).not.toContain('<select');
  });

  it('collapses secondary filters behind an accessible filter toggle', () => {
    const source = read();

    expect(source).toContain('filtersOpen');
    expect(source).toContain('aria-expanded={filtersOpen}');
    expect(source).toContain('>筛选');
  });

  it('keeps direct copy access beside each mobile server result', () => {
    const source = read();

    expect(source).toContain('copyText');
    expect(source).toContain('复制服务器地址');
    expect(source).toContain('服务器地址已复制');
  });
});
