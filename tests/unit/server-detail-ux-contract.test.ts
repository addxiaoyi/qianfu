import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const detailPath = path.join(
  process.cwd(),
  'qianfu-liandeng',
  'src',
  'components',
  'mobile',
  'MobileServerDetail.tsx',
);

const readDetail = () => fs.readFileSync(detailPath, 'utf8');

describe('mobile server detail first-screen UX', () => {
  it('surfaces submitted server facts before the detail tabs', () => {
    const detail = readDetail();
    const tabsIndex = detail.indexOf('aria-label="服务器详情分区"');
    const firstScreenIndex = detail.indexOf('data-testid="server-detail-first-screen"');
    const firstScreen = detail.slice(firstScreenIndex, tabsIndex);

    expect(firstScreenIndex).toBeGreaterThan(-1);
    expect(tabsIndex).toBeGreaterThan(firstScreenIndex);

    for (const marker of [
      '服务器标签',
      'data-testid="server-detail-copy-address"',
      '复制地址',
    ]) {
      expect(firstScreen).toContain(marker);
    }
  });

  it('does not render observed status or engagement metrics as publication data', () => {
    const detail = readDetail();

    expect(detail).not.toContain('getServerPlayersOnline');
    expect(detail).not.toContain('server?.status?.online');
    expect(detail).not.toContain('收藏热度');
    expect(detail).not.toContain('审核状态');
    expect(detail).not.toContain('更新时间');
  });

  it('keeps the existing detail workflows and personal filing boundary', () => {
    const detail = readDetail();

    expect(detail).toContain('收藏该服务器');
    expect(detail).toContain('分享该服务器');
    expect(detail).toContain('相似服务器加载失败');
    expect(detail).toContain('暂无相似服务器');
    expect(detail).not.toContain('支付');
    expect(detail).not.toContain('钱包');
    expect(detail).not.toContain('商城');
  });
});
