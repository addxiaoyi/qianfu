import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  announcementCreateSchema,
  filterPublicAnnouncements,
  MAX_ANNOUNCEMENT_MESSAGE_LENGTH,
  pickActiveAnnouncement,
  type AnnouncementRecord,
} from '../../server/services/announcementService.js';

const makeAnnouncement = (
  overrides: Partial<AnnouncementRecord> = {},
): AnnouncementRecord => ({
  id: '9d2da138-6e26-4bc4-a7be-a1c3c7af59f7',
  title: '系统公告',
  message: '平台维护已经完成。',
  tone: 'INFO',
  status: 'PUBLISHED',
  linkLabel: null,
  linkPath: null,
  startsAt: null,
  endsAt: null,
  priority: 50,
  dismissible: true,
  version: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
  createdBy: 1,
  updatedBy: 1,
  ...overrides,
});

describe('announcement service', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts safe plain-text announcements and trims their values', () => {
    const parsed = announcementCreateSchema.parse({
      title: '  维护公告  ',
      message: '  服务将在今晚恢复。  ',
      tone: 'WARNING',
      status: 'DRAFT',
      linkLabel: '  查看详情  ',
      linkPath: '/status',
      priority: 80,
      dismissible: false,
    });

    expect(parsed.title).toBe('维护公告');
    expect(parsed.message).toBe('服务将在今晚恢复。');
    expect(parsed.linkLabel).toBe('查看详情');
  });

  it('accepts newspaper-length articles and rejects content beyond the contract limit', () => {
    const articleSeed = '这是一段用于验证报纸长文发布能力的正文。';
    const longMessage = articleSeed.repeat(MAX_ANNOUNCEMENT_MESSAGE_LENGTH / articleSeed.length);

    expect(longMessage.length).toBe(MAX_ANNOUNCEMENT_MESSAGE_LENGTH);
    expect(announcementCreateSchema.safeParse({
      title: '长篇新闻',
      message: longMessage,
      status: 'DRAFT',
    }).success).toBe(true);

    expect(announcementCreateSchema.safeParse({
      title: '超限新闻',
      message: `${longMessage}超`,
      status: 'DRAFT',
    }).success).toBe(false);
  });

  it('rejects external and script-bearing announcement links', () => {
    expect(announcementCreateSchema.safeParse({
      title: '危险链接',
      message: '不要允许管理员账号被利用后跳转到钓鱼站点。',
      linkLabel: '打开',
      linkPath: 'javascript:alert(1)',
    }).success).toBe(false);

    expect(announcementCreateSchema.safeParse({
      title: '外链',
      message: '公告链接限定为站内路径。',
      linkLabel: '打开',
      linkPath: 'https://evil.example/phish',
    }).success).toBe(false);
  });

  it('selects the highest-priority currently active announcement', () => {
    const now = new Date('2026-07-18T12:00:00.000Z');
    const selected = pickActiveAnnouncement([
      makeAnnouncement({ id: crypto.randomUUID(), priority: 10 }),
      makeAnnouncement({ id: crypto.randomUUID(), priority: 90 }),
      makeAnnouncement({
        id: crypto.randomUUID(),
        priority: 100,
        startsAt: '2026-07-19T00:00:00.000Z',
      }),
      makeAnnouncement({
        id: crypto.randomUUID(),
        priority: 99,
        endsAt: '2026-07-18T11:59:59.000Z',
      }),
      makeAnnouncement({ id: crypto.randomUUID(), priority: 98, status: 'DRAFT' }),
    ], now);

    expect(selected?.priority).toBe(90);
  });

  it('filters commercial announcements from public output in personal filing mode', () => {
    vi.stubEnv('PERSONAL_FILING_MODE', 'true');
    const visible = filterPublicAnnouncements([
      makeAnnouncement({
        id: crypto.randomUUID(),
        message: '支付、钱包和推广服务已经上线。',
      }),
      makeAnnouncement({
        id: crypto.randomUUID(),
        message: '服务器展示、资料发布和工单支持正常开放。',
      }),
    ]);

    expect(visible).toHaveLength(1);
    expect(visible[0]?.message).toContain('资料发布');
  });

  it('keeps the personal filing service disclaimer visible', () => {
    vi.stubEnv('PERSONAL_FILING_MODE', 'true');
    const visible = filterPublicAnnouncements([
      makeAnnouncement({
        message: '平台现已切换为个人备案模式，提供服务器展示、资料发布、新闻和工单支持；不提供支付、钱包、商城或推广交易服务。',
      }),
    ]);

    expect(visible).toHaveLength(1);
  });

  it('requires the end time to be later than the start time', () => {
    const parsed = announcementCreateSchema.safeParse({
      title: '无效时间',
      message: '结束时间不能早于开始时间。',
      startsAt: '2026-07-19T10:00:00.000Z',
      endsAt: '2026-07-19T09:00:00.000Z',
    });

    expect(parsed.success).toBe(false);
  });
});
