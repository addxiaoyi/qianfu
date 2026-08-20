import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const profilePage = fs.readFileSync(
  path.resolve(process.cwd(), 'qianfu-liandeng/src/pages/Profile.tsx'),
  'utf8',
);

describe('profile page copy boundary', () => {
  it('does not render the personal filing mode promotion card', () => {
    expect(profilePage).not.toContain('平台模式');
    expect(profilePage).not.toContain('免费展示');
    expect(profilePage).not.toContain('个人备案模式');
    expect(profilePage).not.toContain('服务器审核通过后长期展示');
    expect(profilePage).not.toContain('发布免费服务器');
  });
});
