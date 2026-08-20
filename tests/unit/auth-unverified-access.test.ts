import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    getSession: vi.fn(),
  },
}));

vi.mock('../../server/services/redisService', () => ({
  redisService: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../server/services/supertokensPrismaSync', () => ({
  repairPrismaUserIfMissing: vi.fn(),
}));

vi.mock('../../server/services/devAuth', () => ({
  getOrCreateDevAuthUser: vi.fn(),
  isDevAuthBypassEnabled: vi.fn(() => false),
  isDevAuthCookiePresent: vi.fn(() => false),
}));

vi.mock('../../server/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../server/utils/securityConfig', () => ({
  getJwtSecret: () => 'auth-unverified-test-secret',
}));

import prisma from '../../server/db';
import { authenticate, authenticateOptional } from '../../server/middleware/auth';
import { ErrorCode } from '../../server/utils/errors';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const tokenFor = (userId: number, issuedAtSeconds = Math.floor(Date.now() / 1000)) =>
  jwt.sign({ userId, mode: 'local-auth', iat: issuedAtSeconds }, 'auth-unverified-test-secret', {
    algorithm: 'HS256',
    issuer: 'qianfu-api',
    audience: 'qianfu-web',
    subject: String(userId),
  });

const unverifiedUser = {
  id: 41,
  email: 'pending@example.test',
  email_verified: false,
  role: 'USER',
  permissions: '[]',
};

describe('unverified account authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(unverifiedUser);
  });

  it('rejects an unverified account even when its local token is valid', async () => {
    const req = {
      headers: { authorization: `Bearer ${tokenFor(unverifiedUser.id)}` },
      cookies: {},
    } as any;
    const next = vi.fn();

    await authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      code: ErrorCode.EMAIL_NOT_VERIFIED,
    }));
    expect(req.user).toBeUndefined();
  });

  it('does not attach an unverified account during optional authentication', async () => {
    const req = {
      headers: { authorization: `Bearer ${tokenFor(unverifiedUser.id)}` },
      cookies: {},
    } as any;
    const next = vi.fn();

    await authenticateOptional(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('rejects a local token issued before the password changed', async () => {
    const changedAt = new Date();
    mockPrisma.user.findUnique.mockResolvedValue({
      ...unverifiedUser,
      email_verified: true,
      password_changed_at: changedAt,
    });
    const req = {
      headers: { authorization: `Bearer ${tokenFor(unverifiedUser.id, Math.floor(changedAt.getTime() / 1000) - 60)}` },
      cookies: {},
    } as any;
    const next = vi.fn();

    await authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: ErrorCode.UNAUTHORIZED,
    }));
    expect(req.user).toBeUndefined();
  });

  it('accepts a local token issued at or after the password changed', async () => {
    const changedAt = new Date();
    const verifiedUser = {
      ...unverifiedUser,
      email_verified: true,
      password_changed_at: changedAt,
    };
    mockPrisma.user.findUnique.mockResolvedValue(verifiedUser);
    const req = {
      headers: { authorization: `Bearer ${tokenFor(unverifiedUser.id, Math.floor(changedAt.getTime() / 1000))}` },
      cookies: {},
    } as any;
    const next = vi.fn();

    await authenticate(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(verifiedUser);
  });
});
