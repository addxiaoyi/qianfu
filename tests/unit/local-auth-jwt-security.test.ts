import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { getJwtSecret } from '../../server/utils/securityConfig';
import {
  LOCAL_AUTH_AUDIENCE,
  LOCAL_AUTH_ISSUER,
  signLocalAuthToken,
  verifyLocalAuthToken,
} from '../../server/utils/localAuth';

process.env.JWT_SECRET ||= 'qianfu-test-jwt-secret-0123456789abcdef';

describe('local auth JWT policy', () => {
  it('round-trips a valid constrained token', () => {
    const payload = verifyLocalAuthToken(signLocalAuthToken(42));
    expect(payload).toMatchObject({ userId: 42, mode: 'local-auth', sub: '42' });
  });

  it('rejects a token signed with an unapproved algorithm', () => {
    const token = jwt.sign({ userId: 42, mode: 'local-auth' }, getJwtSecret(), {
      algorithm: 'HS384', issuer: LOCAL_AUTH_ISSUER, audience: LOCAL_AUTH_AUDIENCE, subject: '42',
    });
    expect(() => verifyLocalAuthToken(token)).toThrow();
  });

  it('rejects wrong issuer, audience, mode, and subject claims', () => {
    const options = { algorithm: 'HS256' as const, issuer: LOCAL_AUTH_ISSUER, audience: LOCAL_AUTH_AUDIENCE, subject: '42' };
    const wrongIssuer = jwt.sign({ userId: 42, mode: 'local-auth' }, getJwtSecret(), { ...options, issuer: 'other' });
    const wrongAudience = jwt.sign({ userId: 42, mode: 'local-auth' }, getJwtSecret(), { ...options, audience: 'other' });
    const wrongMode = jwt.sign({ userId: 42, mode: 'other' }, getJwtSecret(), options);
    const wrongSubject = jwt.sign({ userId: 42, mode: 'local-auth' }, getJwtSecret(), { ...options, subject: '7' });
    for (const token of [wrongIssuer, wrongAudience, wrongMode, wrongSubject]) {
      expect(() => verifyLocalAuthToken(token)).toThrow();
    }
  });
});
