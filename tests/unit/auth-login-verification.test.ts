import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('../../server/utils/localAuth', () => ({
  LOCAL_AUTH_COOKIE_NAME: 'qf_auth_token',
  clearLocalAuthCookie: vi.fn(),
  setLocalAuthCookie: vi.fn(),
  signLocalAuthToken: vi.fn(() => 'signed-local-token'),
}));

vi.mock('../../server/services/devAuth', () => ({
  DEV_AUTH_COOKIE_NAME: 'qf_dev_auth',
  getDevAuthPassword: vi.fn(),
  getDevAuthUsername: vi.fn(),
  getOrCreateDevAuthUser: vi.fn(),
  isDevAuthBypassEnabled: vi.fn(() => false),
}));

vi.mock('../../server/services/auditService', () => ({
  logAction: vi.fn(),
  logDataChange: vi.fn(),
}));

vi.mock('../../server/services/cache', () => ({
  withCache: vi.fn(),
}));

vi.mock('../../server/services/emailService', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

import bcrypt from 'bcrypt';
import prisma from '../../server/db';
import { login } from '../../server/controllers/authController';
import { setLocalAuthCookie, signLocalAuthToken } from '../../server/utils/localAuth';
import { ErrorCode } from '../../server/utils/errors';

const mockPrisma = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const pendingUser = {
  id: 12,
  email: 'pending@example.test',
  username: 'pending_user',
  password_hash: 'hashed-password',
  email_verified: false,
  role: 'USER',
  created_at: new Date('2026-07-14T00:00:00.000Z'),
};

describe('password login verification gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue(pendingUser);
    (bcrypt.compare as any).mockResolvedValue(true);
  });

  it('does not mint a session for a password-valid but unverified account', async () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();

    await login({
      body: { identifier: pendingUser.email, password: 'correct-password' },
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 403,
      code: ErrorCode.EMAIL_NOT_VERIFIED,
    }));
    expect(signLocalAuthToken).not.toHaveBeenCalled();
    expect(setLocalAuthCookie).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
