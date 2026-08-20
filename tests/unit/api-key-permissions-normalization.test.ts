import { describe, expect, it } from 'vitest';
import { normalizeApiKeyPermissions } from '../../server/utils/apiKeyPermissions.js';

describe('normalizeApiKeyPermissions', () => {
  it.each([
    ['malformed JSON', '{"read":', []],
    ['JSON object', '{"read":true}', []],
    ['JSON string', '"servers:read"', ['servers:read']],
    ['plain string', 'servers:read', ['servers:read']],
    ['mixed JSON array', '["servers:read", 42, null, {"name":"write"}, "  servers:read  "]', ['servers:read']],
    ['null', null, []],
  ])('always returns a string array for %s', (_name, input, expected) => {
    const permissions = normalizeApiKeyPermissions(input);

    expect(permissions).toEqual(expected);
    expect(Array.isArray(permissions)).toBe(true);
    expect(permissions.every((permission) => typeof permission === 'string')).toBe(true);
  });
});
