import { describe, expect, it } from 'vitest';
import { evaluateMailReadiness } from '../../server/services/mailReadiness';

describe('mail readiness', () => {
  it('blocks production readiness when registration email is unavailable', () => {
    expect(evaluateMailReadiness({ configured: false, enabled: false }, 'production')).toEqual({
      required: true,
      ready: false,
      reason: 'registration email transport unavailable',
    });
  });

  it('allows production readiness when the email transport is configured and enabled', () => {
    expect(evaluateMailReadiness({ configured: true, enabled: true }, 'production')).toEqual({
      required: true,
      ready: true,
    });
  });

  it('does not block local development when email is intentionally absent', () => {
    expect(evaluateMailReadiness({ configured: false, enabled: false }, 'development')).toEqual({
      required: false,
      ready: true,
    });
  });
});
