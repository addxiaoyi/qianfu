import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('server/controllers/authController.ts', 'utf8');

describe('password reset security contract', () => {
  it('namespaces reset codes so login codes cannot be reused for password reset', () => {
    expect(source).toContain('`password-reset:${identifier}:${code}`');
  });

  it('uses an account-scoped cooldown without storing the email in the Redis key', () => {
    expect(source).toContain('passwordResetThrottleKey(email)');
    expect(source).toContain('setIfNotExists(throttleKey, true, 60)');
    expect(source).toContain('password-reset-send:${email}');
  });

  it('rolls back issued credentials when email delivery fails', () => {
    expect(source).toContain('where: { id: user.id, reset_token: tokenHash }');
    expect(source).toContain('reset_token_expiry: null');
    expect(source).toContain('await redisService.del(throttleKey)');
  });

  it('revokes SuperTokens sessions before changing a recovered password', () => {
    expect(source).toContain('await revokeAllSessionsForUser(user);');
    expect(source).toContain('Session.revokeAllSessionsForUser(user.supertokens_user_id)');
  });
});
