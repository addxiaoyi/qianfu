import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbMock } = vi.hoisted(() => ({
  dbMock: { $transaction: vi.fn() },
}));

vi.mock('../../server/db', () => ({ default: dbMock }));
vi.mock('../../server/services/redisService', () => ({
  redisService: { del: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

import {
  XP_CHECKIN,
  XP_COMMENT,
  XP_LIKE,
  getEffectivePermissions,
  getLevelRules,
  getNextLevelUnlock,
  grantFirstLikeExperience,
} from '../../server/services/userLevelService';
import { hasPermission, type AuthRequest } from '../../server/middleware/auth';

describe('level rules gameplay loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes one rules contract for XP sources and unlocks', () => {
    const rules = getLevelRules();

    expect(rules.xpSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'checkin', xp: XP_CHECKIN, dailyLimit: 1 }),
      expect.objectContaining({ key: 'like', xp: XP_LIKE, firstOnly: true }),
      expect.objectContaining({ key: 'comment', xp: XP_COMMENT }),
    ]));
    expect(rules.unlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 3, permission: 'rate_servers' }),
      expect.objectContaining({ level: 5, permission: 'comment_servers' }),
    ]));
    expect(getNextLevelUnlock(1)?.level).toBe(3);
  });

  it('allows a level-granted permission through auth middleware', () => {
    const user = {
      id: 7,
      role: 'NORMAL',
      permissions: '[]',
      experience_points: 225,
    } as AuthRequest['user'];
    const req = { user, isAdmin: false } as AuthRequest;
    const next = vi.fn();

    expect(getEffectivePermissions(user!)).toContain('rate_servers');
    hasPermission(['rate_servers'])(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('grants like XP only once for the same user and server', async () => {
    const tx = {
      userExperienceEvent: {
        create: vi.fn()
          .mockResolvedValueOnce({ id: 1 })
          .mockRejectedValueOnce({ code: 'P2002' }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ experience_points: 0 }),
        update: vi.fn().mockResolvedValue({ experience_points: XP_LIKE }),
      },
    };
    dbMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const first = await grantFirstLikeExperience(7, 42);
    const second = await grantFirstLikeExperience(7, 42);

    expect(first?.added).toBe(XP_LIKE);
    expect(second?.added).toBe(0);
    expect(tx.user.update).toHaveBeenCalledOnce();
  });

  it('mounts the rules endpoint under the user API namespace used by the frontend', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/routes/user.ts'), 'utf8');

    expect(source).toContain("router.get('/user/level/rules'");
  });
});
