import { describe, expect, it } from 'vitest';

import { resolveBackendHealthUrl } from '../../qianfu-liandeng/src/utils/backendHealthUrl';

describe('frontend backend health URL', () => {
  const origin = 'http://127.0.0.1:4173';

  it('keeps relative API health checks on the frontend origin', () => {
    expect(resolveBackendHealthUrl(undefined, origin)).toBe('/api/health');
    expect(resolveBackendHealthUrl('/api', origin)).toBe('/api/health');
    expect(resolveBackendHealthUrl('/api/v1/', origin)).toBe('/api/health');
  });

  it('uses the configured backend origin and removes the version segment', () => {
    expect(resolveBackendHealthUrl('http://127.0.0.1:3101/api/v1', origin))
      .toBe('http://127.0.0.1:3101/api/health');
  });

  it('drops query strings and fragments from API base configuration', () => {
    expect(resolveBackendHealthUrl('https://api.example.com/api/v1/?source=test#fragment', origin))
      .toBe('https://api.example.com/api/health');
  });
});
