import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('SEO contract', () => {
  it('uses the Google SearchAction variable and the frontend q query', () => {
    const seo = read('qianfu-liandeng/src/components/ui/SeoHead.tsx');
    expect(seo).toContain('q={search_term_string}');
    expect(seo).toContain('required name=search_term_string');
    expect(read('qianfu-liandeng/src/pages/Search.tsx')).toContain("searchParams.get('q')");
  });

  it('keeps social preview image as a bundled public asset', () => {
    expect(fs.existsSync(path.resolve(process.cwd(), 'qianfu-liandeng/public/logo.png'))).toBe(true);
    const html = read('qianfu-liandeng/index.html');
    expect(html).toContain('https://mc-u.top/logo.png');
  });

  it('keeps keywords concise', () => {
    const html = read('qianfu-liandeng/index.html');
    const keywords = html.match(/meta name="keywords" content="([^"]+)"/)?.[1] ?? '';
    expect(keywords.split(',')).toHaveLength(4);
  });
});
