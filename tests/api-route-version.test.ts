import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizePath } from '../qianfu-liandeng/src/api/request';

describe('API route versioning', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('preserves explicitly versioned routes', () => {
    expect(normalizePath('/api/v2/health')).toBe('/api/v2/health');
    expect(normalizePath('/api/v1/auth/me')).toBe('/api/v1/auth/me');
  });

  it('keeps legacy unversioned routes on v1', () => {
    expect(normalizePath('/api/servers')).toBe('/api/v1/servers');
    expect(normalizePath('servers')).toBe('/api/v1/servers');
  });

  it('moves only the contract-compatible DNS catalog to v2 when enabled', () => {
    vi.stubEnv('VITE_API_V2', 'true');

    expect(normalizePath('/api/v1/dns/suffixes')).toBe('/api/v2/dns/suffixes');
  });

  it('keeps endpoints without a Rust v2 equivalent on v1', () => {
    vi.stubEnv('VITE_API_V2', 'true');

    expect(normalizePath('/api/v1/servers/public/servers/status')).toBe('/api/v1/servers/public/servers/status');
    expect(normalizePath('/api/v1/servers/3fa85f64-5717-4562-b3fc-2c963f66afa6/like')).toBe('/api/v1/servers/3fa85f64-5717-4562-b3fc-2c963f66afa6/like');
    expect(normalizePath('/api/v1/auth/forgot-password')).toBe('/api/v1/auth/forgot-password');
    expect(normalizePath('/api/v1/auth/me')).toBe('/api/v1/auth/me');
    expect(normalizePath('/api/v1/servers')).toBe('/api/v1/servers');
  });

  it('preserves query strings while routing the DNS catalog', () => {
    vi.stubEnv('VITE_API_V2', 'true');

    expect(normalizePath('/api/v1/dns/suffixes?enabled=true')).toBe('/api/v2/dns/suffixes?enabled=true');
  });
});
