import crypto from 'crypto';

import { getJwtSecret } from './securityConfig';

const SESSION_REFERENCE_PREFIX = 'sess_';
const SESSION_REFERENCE_CONTEXT = 'session-reference:v1';

export const SESSION_REFERENCE_PATTERN = /^sess_[A-Za-z0-9_-]{43}$/;

export function createSessionReference(userId: string, sessionHandle: string): string {
  const digest = crypto
    .createHmac('sha256', getJwtSecret())
    .update(SESSION_REFERENCE_CONTEXT)
    .update('\0')
    .update(userId)
    .update('\0')
    .update(sessionHandle)
    .digest('base64url');

  return `${SESSION_REFERENCE_PREFIX}${digest}`;
}

export function resolveSessionHandle(
  userId: string,
  sessionReference: string,
  sessionHandles: readonly string[],
): string | null {
  if (!SESSION_REFERENCE_PATTERN.test(sessionReference)) {
    return null;
  }

  const supplied = Buffer.from(sessionReference, 'utf8');
  for (const sessionHandle of sessionHandles) {
    const candidate = Buffer.from(createSessionReference(userId, sessionHandle), 'utf8');
    if (candidate.length === supplied.length && crypto.timingSafeEqual(candidate, supplied)) {
      return sessionHandle;
    }
  }

  return null;
}
