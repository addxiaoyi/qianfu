import { describe, expect, it } from 'vitest';
import { getServerSummary } from '../../qianfu-liandeng/src/utils/serverView';

describe('server summary display', () => {
  it('does not use a duplicated server name as its introduction', () => {
    expect(getServerSummary({
      name: '星光生存服',
      summary: '星光生存服',
      content_html: '<p>欢迎来到星光生存服，长期生存与社区活动。</p>',
    })).toBe('欢迎来到星光生存服，长期生存与社区活动。');
  });

  it('keeps a meaningful submitted summary when it differs from the name', () => {
    expect(getServerSummary({
      name: '星光生存服',
      summary: '纯净生存与社区活动。',
    })).toBe('纯净生存与社区活动。');
  });
});
