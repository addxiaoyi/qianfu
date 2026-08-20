import { describe, expect, it } from 'vitest';
import {
  getGitHubOAuthCookieOptions,
  getGitHubPkceCookieName,
  getGitHubStateCookieName,
  matchesGitHubOAuthState,
} from '../../server/controllers/githubAuthController';

describe('GitHub OAuth state cookies', () => {
  it('keeps simultaneous OAuth flows isolated by state', () => {
    const firstState = '11111111-1111-4111-8111-111111111111';
    const secondState = '22222222-2222-4222-8222-222222222222';
    const cookies = {
      [getGitHubStateCookieName(firstState)]: firstState,
      [getGitHubStateCookieName(secondState)]: secondState,
    };

    expect(getGitHubStateCookieName(firstState)).not.toBe(getGitHubStateCookieName(secondState));
    expect(matchesGitHubOAuthState(firstState, cookies)).toBe(true);
    expect(matchesGitHubOAuthState(secondState, cookies)).toBe(true);
    expect(matchesGitHubOAuthState('33333333-3333-4333-8333-333333333333', cookies)).toBe(false);
  });

  it('uses browser-compatible and production-safe state cookie attributes', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousForceHttps = process.env.FORCE_HTTPS;
    const previousCookieDomain = process.env.COOKIE_DOMAIN;

    try {
      process.env.NODE_ENV = 'production';
      process.env.FORCE_HTTPS = 'false';
      process.env.COOKIE_DOMAIN = 'mc-u.top';

      expect(getGitHubOAuthCookieOptions()).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        domain: 'mc-u.top',
      });
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousForceHttps === undefined) delete process.env.FORCE_HTTPS;
      else process.env.FORCE_HTTPS = previousForceHttps;
      if (previousCookieDomain === undefined) delete process.env.COOKIE_DOMAIN;
      else process.env.COOKIE_DOMAIN = previousCookieDomain;
    }
  });

  it('uses a separate per-state PKCE cookie name', () => {
    const state = '11111111-1111-4111-8111-111111111111';
    expect(getGitHubPkceCookieName(state)).toBe(`github_oauth_pkce_${state}`);
    expect(getGitHubPkceCookieName(state)).not.toBe(getGitHubStateCookieName(state));
  });
});
