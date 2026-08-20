import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createSessionReference,
  resolveSessionHandle,
  SESSION_REFERENCE_PATTERN,
} from '../../server/utils/sessionReference';
import { sessionIdParamSchema } from '../../server/utils/validation';

process.env.JWT_SECRET ||= 'qianfu-session-reference-test-secret-0123456789';

describe('opaque session references', () => {
  it('creates stable user-bound references without exposing the raw handle', () => {
    const handle = 'raw-supertokens-session-handle';
    const reference = createSessionReference('st-user-1', handle);

    expect(reference).toMatch(SESSION_REFERENCE_PATTERN);
    expect(reference).not.toContain(handle);
    expect(createSessionReference('st-user-1', handle)).toBe(reference);
    expect(createSessionReference('st-user-2', handle)).not.toBe(reference);
  });

  it('resolves only references belonging to the same user and handle set', () => {
    const handles = ['handle-one', 'handle-two'];
    const reference = createSessionReference('st-user-1', handles[1]);

    expect(resolveSessionHandle('st-user-1', reference, handles)).toBe(handles[1]);
    expect(resolveSessionHandle('st-user-2', reference, handles)).toBeNull();
    expect(resolveSessionHandle('st-user-1', reference, ['handle-one'])).toBeNull();
    expect(resolveSessionHandle('st-user-1', 'handle-two', handles)).toBeNull();
  });

  it('accepts only opaque references at the revoke-session boundary', () => {
    const reference = createSessionReference('st-user-1', 'handle-one');

    expect(sessionIdParamSchema.safeParse({ sessionId: reference }).success).toBe(true);
    expect(sessionIdParamSchema.safeParse({ sessionId: 'raw-supertokens-session-handle' }).success).toBe(false);
  });

  it('does not return or audit raw session handles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'server/controllers/authController.ts'),
      'utf8',
    );

    expect(source).toContain('id: createSessionReference(supertokensUserId, handle)');
    expect(source).toContain('const sessionHandle = resolveSessionHandle(');
    expect(source).toContain('{ sessionReference }');
    expect(source).not.toContain('id: handle');
    expect(source).not.toContain('`session_${sessionHandle}`');
    expect(source).not.toContain('{ sessionHandle }');
  });
});
