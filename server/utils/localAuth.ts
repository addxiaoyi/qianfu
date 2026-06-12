import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './securityConfig';

export const LOCAL_AUTH_COOKIE_NAME = process.env.LOCAL_AUTH_COOKIE_NAME || 'qf_auth_token';

export function signLocalAuthToken(userId: number): string {
  return jwt.sign(
    { userId, mode: 'local-auth' },
    getJwtSecret(),
    { expiresIn: '7d' },
  );
}

export function setLocalAuthCookie(res: Response, token: string): void {
  res.cookie(LOCAL_AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearLocalAuthCookie(res: Response): void {
  res.clearCookie(LOCAL_AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}
