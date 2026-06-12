import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../db';
import { AppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';
import { isTrustedHost } from '../utils/securityConfig';
import { setLocalAuthCookie, signLocalAuthToken } from '../utils/localAuth';

const GITHUB_STATE_COOKIE = 'github_oauth_state';

function githubConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || process.env.API_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function _githubCallbackUrl(req?: Request) {
  const override = process.env.GITHUB_CALLBACK_URL?.trim();
  if (override) return override;
  if (req) {
    const host = req.get('host');
    const protocol = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() || req.protocol || 'http';
    if (host) {
      return `${protocol}://${host}${req.path}`;
    }
  }
  return '';
}

function githubCallbackUrlOverride() {
  return process.env.GITHUB_CALLBACK_URL?.trim() || '';
}

function oauthCookieOptions() {
  const isSecure = process.env.FORCE_HTTPS === 'true';
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 10 * 60 * 1000,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

const OAUTH_FETCH_TIMEOUT_MS = Number(process.env.OAUTH_HTTP_TIMEOUT_MS || 15000);
const OAUTH_FETCH_RETRY_TIMES = Number(process.env.OAUTH_HTTP_RETRIES || 2);

function isRetryableOAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('ecconnreset') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('socket hang up') ||
    message.includes('network')
  );
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: { retries?: number; timeoutMs?: number } = {},
): Promise<globalThis.Response> {
  const retries = options.retries ?? OAUTH_FETCH_RETRY_TIMES;
  const timeoutMs = options.timeoutMs ?? OAUTH_FETCH_TIMEOUT_MS;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastError = error;
      const shouldRetry = attempt < retries && isRetryableOAuthError(error);
      if (!shouldRetry) {
        throw error;
      }
      const delayMs = 250 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      logger.warn('[GitHubOAuth] transient request error, retrying', {
        url,
        attempt: attempt + 1,
        retries,
        delayMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('OAuth request failed');
}

async function resolveUniqueUsername(baseLogin: string | undefined) {
  const root = String(baseLogin || 'github').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24) || 'github';
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? root : `${root}_${index}`;
    const existing = await prisma.user.findFirst({ where: { username: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${root}_${crypto.randomUUID().slice(0, 8)}`;
}

async function exchangeGitHubCode(code: string, callbackUrl?: string) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    client_secret: process.env.GITHUB_CLIENT_SECRET!,
    code,
  });
  if (callbackUrl) {
    params.set('redirect_uri', callbackUrl);
  }

  let response: globalThis.Response;
  try {
    response = await fetchWithRetry(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'QianFu-GitHub-OAuth',
        },
        body: params,
      },
      {
        retries: OAUTH_FETCH_RETRY_TIMES,
        timeoutMs: OAUTH_FETCH_TIMEOUT_MS,
      },
    );
  } catch (error) {
    throw new AppError(
      'GitHub token exchange timed out, please try again',
      504,
      ErrorCode.AUTHENTICATION_FAILED,
    );
  }

  const payload = await response.json().catch(() => null) as
    | { access_token?: string; error?: string; error_description?: string }
    | null;

  if (!response.ok || !payload?.access_token) {
    throw new AppError(
      payload?.error_description || payload?.error || `GitHub token exchange failed (${response.status})`,
      502,
      ErrorCode.AUTHENTICATION_FAILED,
    );
  }

  return payload.access_token;
}

async function fetchGitHubProfile(accessToken: string) {
  const commonHeaders = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'QianFu-GitHub-OAuth',
  };

  let profileResponse: globalThis.Response;
  let emailsResponse: globalThis.Response;
  try {
    [profileResponse, emailsResponse] = await Promise.all([
      fetchWithRetry(
        'https://api.github.com/user',
        { headers: commonHeaders },
        { retries: OAUTH_FETCH_RETRY_TIMES, timeoutMs: OAUTH_FETCH_TIMEOUT_MS },
      ),
      fetchWithRetry(
        'https://api.github.com/user/emails',
        { headers: commonHeaders },
        { retries: OAUTH_FETCH_RETRY_TIMES, timeoutMs: OAUTH_FETCH_TIMEOUT_MS },
      ),
    ]);
  } catch {
    throw new AppError('GitHub profile request timed out, please try again', 504, ErrorCode.AUTHENTICATION_FAILED);
  }

  const profile = await profileResponse.json().catch(() => null) as
    | { id?: number; login?: string; name?: string; avatar_url?: string; email?: string | null }
    | null;
  const emails = await emailsResponse.json().catch(() => []) as Array<{
    email?: string;
    primary?: boolean;
    verified?: boolean;
  }>;

  if (!profileResponse.ok || !profile?.id) {
    throw new AppError('Failed to fetch GitHub profile', 502, ErrorCode.AUTHENTICATION_FAILED);
  }

  const verifiedPrimary =
    emails.find((item) => item.verified && item.primary)?.email ||
    emails.find((item) => item.verified)?.email ||
    profile.email ||
    '';

  if (!verifiedPrimary) {
    throw new AppError('GitHub account did not provide a verified email', 400, ErrorCode.VALIDATION_ERROR);
  }

  return {
    githubId: String(profile.id),
    email: verifiedPrimary.toLowerCase(),
    username: profile.login || undefined,
    displayName: profile.name || profile.login || undefined,
    avatarUrl: profile.avatar_url || undefined,
  };
}

async function upsertUserFromGitHubProfile(profile: {
  githubId: string;
  email: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}) {
  const existingByEmail = await prisma.user.findFirst({
    where: { email: profile.email },
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        email_verified: true,
        avatar_url: existingByEmail.avatar_url || profile.avatarUrl,
        display_name: existingByEmail.display_name || profile.displayName,
        username: existingByEmail.username || (await resolveUniqueUsername(profile.username)),
        last_login_at: new Date(),
        login_count: { increment: 1 },
      },
    });
  }

  return prisma.user.create({
    data: {
      email: profile.email,
      email_verified: true,
      username: await resolveUniqueUsername(profile.username),
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      role: 'NORMAL',
      last_login_at: new Date(),
      login_count: 1,
    },
  });
}

function buildFrontendCallbackUrl(params: Record<string, string>) {
  const base = frontendBaseUrl();
  const query = new URLSearchParams(params).toString();
  const hash = `/oauth/callback/github${query ? `?${query}` : ''}`;
  try {
    const callback = new URL(base);
    if (process.env.NODE_ENV === 'production' && !isTrustedHost(callback.host)) {
      logger.error('[GitHubOAuth] Untrusted frontend callback host, using same-origin fallback', {
        host: callback.host,
      });
      return `/#${hash}`;
    }
    callback.hash = hash;
    return callback.toString();
  } catch {
    return `/#${hash}`;
  }
}

export const startGitHubAuth = async (_req: Request, res: ExpressResponse, next: NextFunction) => {
  try {
    if (!githubConfigured()) {
      throw new AppError('GitHub OAuth is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }

    const state = crypto.randomUUID();
    res.cookie(GITHUB_STATE_COOKIE, state, oauthCookieOptions());

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
    authorizeUrl.searchParams.set('scope', 'read:user user:email');
    authorizeUrl.searchParams.set('state', state);

    const callbackUrl = githubCallbackUrlOverride();
    if (callbackUrl) {
      authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
    }

    return res.redirect(authorizeUrl.toString());
  } catch (error) {
    return next(error);
  }
};

export const handleGitHubAuthCallback = async (req: Request, res: ExpressResponse, _next: NextFunction) => {
  try {
    if (!githubConfigured()) {
      throw new AppError('GitHub OAuth is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }

    const errorParam = String(req.query.error || '').trim();
    if (errorParam) {
      return res.redirect(buildFrontendCallbackUrl({
        error: errorParam,
        message: String(req.query.error_description || errorParam),
      }));
    }

    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    const storedState = String(req.cookies?.[GITHUB_STATE_COOKIE] || '').trim();
    res.clearCookie(GITHUB_STATE_COOKIE, oauthCookieOptions());

    if (!code || !state || !storedState || state !== storedState) {
      throw new AppError('GitHub OAuth state verification failed', 400, ErrorCode.AUTHENTICATION_FAILED);
    }

    const accessToken = await exchangeGitHubCode(code, githubCallbackUrlOverride() || undefined);
    const profile = await fetchGitHubProfile(accessToken);
    const user = await upsertUserFromGitHubProfile(profile);
    const token = signLocalAuthToken(user.id);
    setLocalAuthCookie(res, token);

    logger.info('[GitHubOAuth] login successful', {
      email: profile.email,
      userId: user.id,
      username: user.username,
    });

    return res.redirect(buildFrontendCallbackUrl({
      token,
      email: profile.email,
    }));
  } catch (error) {
    const message = error instanceof AppError ? error.message : error instanceof Error ? error.message : 'GitHub OAuth callback failed';
    logger.error('[GitHubOAuth] callback failed', { error: message });
    return res.redirect(buildFrontendCallbackUrl({
      error: 'oauth_callback_failed',
      message,
    }));
  }
};
