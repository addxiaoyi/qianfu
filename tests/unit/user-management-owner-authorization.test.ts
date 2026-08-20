import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userCount: vi.fn(),
  userGroupBy: vi.fn(),
}));

vi.mock('../../server/db', () => ({
  default: {
    user: {
      count: mocks.userCount,
      groupBy: mocks.userGroupBy,
    },
  },
}));

vi.mock('../../server/services/cache', () => ({
  withCache: vi.fn(async (_key: string, loader: () => Promise<unknown>) => loader()),
  cacheDelete: vi.fn(),
}));

vi.mock('../../server/services/redisService', () => ({
  redisService: {
    del: vi.fn(),
  },
}));

vi.mock('../../server/services/auditService', () => ({
  logDataChange: vi.fn(),
}));

import { getUserStats } from '../../server/controllers/userManagementController';

describe('OWNER user management authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userCount.mockResolvedValue(2);
    mocks.userGroupBy.mockResolvedValue([{ role: 'OWNER', _count: { id: 1 } }]);
  });

  it('allows an owner to read administrator statistics without an explicit permission entry', async () => {
    const req = {
      user: { id: 24, role: 'OWNER', permissions: '[]' },
      isAdmin: true,
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    } as any;
    const next = vi.fn();

    await getUserStats(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });
});
