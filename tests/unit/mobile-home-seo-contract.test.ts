import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile home SEO contract', () => {
  it('uses the canonical home title after the mobile redirect', () => {
    const seo = readFileSync(
      resolve(process.cwd(), 'qianfu-liandeng/src/components/ui/SeoHead.tsx'),
      'utf8',
    );

    expect(seo).toContain("'/mobile': {");
    expect(seo).toContain("title: '千服联灯 - Minecraft 服务器发现与发布平台'");
    expect(seo).not.toContain("title: '千服联灯移动端 - Minecraft 服务器入口'");
  });
});
