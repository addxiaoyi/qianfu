import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({ default: {} }));
vi.mock('../../server/services/redisService', () => ({
  redisService: { del: vi.fn() },
}));

import { adminOnly, hasPermission } from '../../server/middleware/auth';

const ownerRequest = {
  user: { role: 'OWNER', permissions: '[]' },
  isAdmin: false,
} as any;

describe('owner authorization', () => {
  it('allows an owner through administrator-only middleware', () => {
    const next = vi.fn();

    adminOnly(ownerRequest, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows an owner through permission middleware', () => {
    const next = vi.fn();

    hasPermission(['manage_users'])(ownerRequest, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });
});
