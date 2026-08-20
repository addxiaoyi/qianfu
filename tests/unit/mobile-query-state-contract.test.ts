import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('mobile query state contract', () => {
  it('submits mobile search with the keyboard and distinguishes request failures from empty results', () => {
    const home = read('qianfu-liandeng/src/pages/MobileHome.tsx');

    expect(home).not.toContain("if (event.key === 'Enter')");
    expect(home).toContain('isError, refetch');
    expect(home).toContain('精选服务器暂时加载失败');
    expect(home).toContain('暂无已审核服务器');
  });

  it('does not present failed account summary requests as trustworthy zeroes', () => {
    const center = read('qianfu-liandeng/src/components/mobile/MobileUserCenter.tsx');

    expect(center).toContain('summaryUnavailable');
    expect(center).toContain('页面没有用 0 代替失败的数据');
    expect(center).toContain('重新加载统计');
    expect(center).toContain('checkinStatusError');
    expect(center).toContain("serverInfoError ? '—'");
    expect(center).toContain("ticketError ? '—'");
  });
});
