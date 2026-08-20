import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('server discovery list UX contract', () => {
  const list = read('qianfu-liandeng/src/pages/ServerList.tsx');

  it('keeps intent entry points and URL-backed filters visible', () => {
    expect(list).toContain('useSearchParams');
    expect(list).toContain('现在就玩');
    expect(list).toContain('多人活跃');
    expect(list).toContain('刚刚加入');
    expect(list).toContain('清除筛选');
    expect(list).toContain('当前筛选');
  });

  it('exposes platform, version, and online state controls', () => {
    expect(list).toContain('服务器平台');
    expect(list).toContain('服务器版本');
    expect(list).toContain('在线状态');
  });
});
