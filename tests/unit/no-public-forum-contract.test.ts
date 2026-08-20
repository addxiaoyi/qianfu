import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');

describe('public forum removal', () => {
  it('does not expose public forum/comment UI', () => {
    const detail = read('qianfu-liandeng/src/pages/ServerDetail.tsx');
    const mobile = read('qianfu-liandeng/src/components/mobile/MobileServerDetail.tsx');
    const resources = read('qianfu-liandeng/src/pages/ResourceCenter.tsx');
    const seo = read('qianfu-liandeng/src/components/ui/SeoHead.tsx');

    expect(detail).not.toContain('Forum Navigation Tabs');
    expect(detail).not.toContain('commentMutation');
    expect(mobile).not.toContain('/comments');
    expect(resources).not.toContain('minecraftforum.net');
    expect(resources).not.toContain('minebbs.com');
    expect(seo).not.toContain('社区论坛');
    expect(seo).not.toContain('论坛');
  });
});
