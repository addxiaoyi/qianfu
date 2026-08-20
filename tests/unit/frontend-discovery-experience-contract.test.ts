import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), 'utf8');

describe('public discovery experience contracts', () => {
  it('debounces server search and exposes meaningful empty states', () => {
    const source = read('qianfu-liandeng', 'src', 'pages', 'ServerList.tsx');

    expect(source).toContain('useDebouncedValue(search.trim(), 350)');
    expect(source).toContain("queryKey: ['servers', debouncedSearch, activeCategory]");
    expect(source).toContain('displayedServers.length === 0');
    expect(source).toContain('没有匹配的服务器');
    expect(source).toContain('aria-pressed={activeCategory === catKey}');
  });

  it('uses explicit marketplace sorting and pauses automatic rotation when needed', () => {
    const source = read('qianfu-liandeng', 'src', 'pages', 'MarketplaceShop.tsx');

    expect(source).toContain("useMediaQuery('(prefers-reduced-motion: reduce)')");
    expect(source).toContain('prefersReducedMotion || featured.length <= 1');
    expect(source).toContain('if (!document.hidden)');
    expect(source).toContain('aria-label="商品排序"');
    expect(source).toContain('该店铺暂时没有公开商品。');
  });

  it('provides accessible Chinese loading and error states', () => {
    const source = read('qianfu-liandeng', 'src', 'components', 'ui', 'StatusWrapper.tsx');

    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('role="alert"');
    expect(source).toContain('正在加载数据');
    expect(source).toContain('连接失败');
    expect(source).toContain('重新加载');
  });
});
