import { describe, expect, it, vi } from 'vitest';
import { loginWithCsrf, type SmokeResponse } from '../../scripts/lib/smoke-session-login';

const response = (data: unknown): SmokeResponse => ({
  status: 200,
  ok: true,
  data,
  text: JSON.stringify(data),
});

describe('smoke session login', () => {
  it('fetches CSRF before login and sends the token with the login request', async () => {
    const session = { cookie: '' };
    const request = vi
      .fn()
      .mockResolvedValueOnce(response({ data: { csrfToken: 'csrf-test' } }))
      .mockResolvedValueOnce(response({ data: { token: 'access-test' } }));

    const auth = await loginWithCsrf(request, session, 'smoke-user', 'smoke-password');

    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/csrf-token', {}, session);
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': 'csrf-test',
        },
      }),
      session,
    );
    expect(auth.token).toBe('access-test');
    expect(auth.csrfToken).toBe('csrf-test');
  });
});
