import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/db', () => ({
  default: {
    user: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
  },
}));

vi.mock('supertokens-node/recipe/session', () => ({
  default: {
    createNewSession: vi.fn(),
  },
}));

vi.mock('supertokens-node/lib/build/recipeUserId', () => ({
  default: class RecipeUserId {
    constructor(public id: string) {}
  },
}));

vi.mock('../../server/services/superTokensUser', () => ({
  getOrCreateSuperTokensUser: vi.fn(),
}));

vi.mock('../../server/services/emailService', () => ({
  sendEmailLoginCode: vi.fn(),
}));

vi.mock('../../server/utils/securityConfig', () => ({
  getJwtSecret: () => 'register-verification-test-secret',
}));

vi.mock('../../server/utils/localAuth', () => ({
  setLocalAuthCookie: vi.fn(),
  signLocalAuthToken: vi.fn(() => 'registered-local-token'),
}));

vi.mock('../../server/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../server/utils/response', () => ({
  sendSuccess: vi.fn(),
  toSafeUser: vi.fn((user) => user),
}));

import bcrypt from 'bcrypt';
import Session from 'supertokens-node/recipe/session';
import prisma from '../../server/db';
import { registerUser } from '../../server/controllers/registerController';
import { getOrCreateSuperTokensUser } from '../../server/services/superTokensUser';
import { sendEmailLoginCode } from '../../server/services/emailService';
import { setLocalAuthCookie, signLocalAuthToken } from '../../server/utils/localAuth';
import { sendSuccess } from '../../server/utils/response';

const mockPrisma = prisma as unknown as {
  user: {
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const newUser = {
  id: 23,
  email: 'new@example.test',
  username: 'new_user',
  display_name: 'new_user',
  password_hash: 'hash',
  email_verified: false,
  role: 'USER',
  created_at: new Date('2026-07-14T00:00:00.000Z'),
};

describe('registration verification gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(newUser);
    mockPrisma.user.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue(newUser);
    (bcrypt.hash as any).mockResolvedValue('hash');
    (getOrCreateSuperTokensUser as any).mockResolvedValue('st-user-23');
    (sendEmailLoginCode as any).mockResolvedValue(undefined);
  });

  it('returns a pending verification response without creating any authenticated session', async () => {
    const next = vi.fn();

    await registerUser({
      body: {
        email: newUser.email,
        username: newUser.username,
        password: 'long-enough-password',
      },
    } as any, {} as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(sendEmailLoginCode).toHaveBeenCalled();
    expect(getOrCreateSuperTokensUser).not.toHaveBeenCalled();
    expect(Session.createNewSession).not.toHaveBeenCalled();
    expect(signLocalAuthToken).not.toHaveBeenCalled();
    expect(setLocalAuthCookie).not.toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        user: newUser,
        pendingVerification: true,
      }),
      expect.any(String),
      200,
      undefined,
      expect.anything(),
    );

    const responseData = (sendSuccess as any).mock.calls[0][1];
    expect(responseData).not.toHaveProperty('token');
    expect(responseData).not.toHaveProperty('accessToken');
    expect(responseData).not.toHaveProperty('refreshToken');
  });

  it('rolls back a pending account when its verification code cannot be delivered', async () => {
    const next = vi.fn();
    (sendEmailLoginCode as any).mockRejectedValueOnce(new Error('SMTP connection timed out'));

    await registerUser({
      body: {
        email: newUser.email,
        username: newUser.username,
        password: 'long-enough-password',
      },
    } as any, {} as any, next);

    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: newUser.id } });
    expect(sendSuccess).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
      }),
    );
  });

  it('does not return session bearer tokens in the registration response source', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile('server/controllers/registerController.ts', 'utf8'));
    expect(source).not.toContain('accessToken,');
    expect(source).not.toContain('refreshToken,');
    expect(source).toContain('Session.createNewSession');
  });

  it('allows an existing unverified account to complete verification', async () => {
    const pendingUser = {
      ...newUser,
      email_verified: false,
      verification_token: 'pending-token',
      token_expiry: new Date(Date.now() + 60_000),
      supertokens_user_id: 'st-user-23',
    };
    mockPrisma.user.findFirst.mockResolvedValue(pendingUser);
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser);
    const next = vi.fn();
    const code = '123456';
    const secret = 'register-verification-test-secret';
    pendingUser.verification_token = (await import('node:crypto')).createHmac('sha256', secret)
      .update(`${newUser.email}:${code}`)
      .digest('hex');

    await registerUser({
      body: {
        email: newUser.email,
        username: newUser.username,
        password: 'long-enough-password',
        code,
      },
    } as any, {} as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(Session.createNewSession).toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: expect.objectContaining({ id: newUser.id }) }),
      'Code verified and logged in',
    );
  });

  it('fails registration when the verified account session cannot be created', async () => {
    const pendingUser = {
      ...newUser,
      email_verified: false,
      verification_token: 'pending-token',
      token_expiry: new Date(Date.now() + 60_000),
      supertokens_user_id: 'st-user-23',
    };
    mockPrisma.user.findFirst.mockResolvedValue(pendingUser);
    mockPrisma.user.findUnique.mockResolvedValue(pendingUser);
    (Session.createNewSession as any).mockRejectedValueOnce(new Error('session unavailable'));
    const next = vi.fn();
    const code = '123456';
    pendingUser.verification_token = (await import('node:crypto')).createHmac('sha256', 'register-verification-test-secret')
      .update(`${newUser.email}:${code}`)
      .digest('hex');

    await registerUser({
      body: {
        email: newUser.email,
        username: newUser.username,
        password: 'long-enough-password',
        code,
      },
    } as any, {} as any, next);

    expect(sendSuccess).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }));
  });
});
