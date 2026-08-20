import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  default: {
    promoTask: {
      create: mocks.createTask,
    },
  },
}));

vi.mock('../../server/services/promoBindingService', () => ({
  bindPromoPlatformAccount: vi.fn(),
}));

import { createPromoTask } from '../../server/controllers/promoController';

describe('OWNER promotion authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTask.mockResolvedValue({ id: 1, status: 'DRAFT' });
  });

  it('allows an owner to create a promotion task without a separate admin flag', async () => {
    const req = {
      user: { id: 24, role: 'OWNER', permissions: '[]' },
      isAdmin: false,
      body: {
        title: 'OWNER promotion smoke',
        platform: 'bilibili',
        targetId: 'BV1OWNER',
        targetUrl: 'https://www.bilibili.com/video/BV1OWNER',
        rewardAmount: 100,
        ruleConfig: { actions: { like: true } },
      },
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    } as any;
    const next = vi.fn();

    await createPromoTask(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.createTask).toHaveBeenCalledOnce();
    expect(res.send).toHaveBeenCalled();
  });
});
