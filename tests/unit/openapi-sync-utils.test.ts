import { describe, expect, it } from 'vitest';
import {
  buildOpenApiSpec,
  normalizeSwaggerPath,
  stableJson,
} from '../../scripts/lib/openapi-sync-utils';

describe('openapi sync utils', () => {
  it('should normalize non-versioned swagger paths to /api/v1', () => {
    expect(normalizeSwaggerPath('/api/servers/servers')).toBe('/api/v1/servers');
    expect(normalizeSwaggerPath('/api/user/profile')).toBe('/api/v1/profile');
    expect(normalizeSwaggerPath('/api/v1/tickets')).toBe('/api/v1/tickets');
    expect(normalizeSwaggerPath('/api/health')).toBe('/api/health');
  });

  it('should build normalized spec with rewritten paths', () => {
    const spec = buildOpenApiSpec({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/api/servers/servers': {
          get: { summary: 'list servers' },
        },
        '/api/health': {
          get: { summary: 'health' },
        },
      },
    });

    const paths = spec.paths as Record<string, unknown>;
    expect(paths['/api/v1/servers']).toBeDefined();
    expect(paths['/api/health']).toBeDefined();
  });

  it('stableJson should sort keys deeply', () => {
    const json = stableJson({
      b: 1,
      a: {
        d: 1,
        c: 2,
      },
    });

    expect(json.indexOf('"a"')).toBeLessThan(json.indexOf('"b"'));
    expect(json.indexOf('"c"')).toBeLessThan(json.indexOf('"d"'));
  });
});
