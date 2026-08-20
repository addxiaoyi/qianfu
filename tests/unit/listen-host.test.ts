import { describe, expect, it } from 'vitest';
import { resolveListenHost, resolveProbePort } from '../../server/config/listenHost';

describe('API listen host', () => {
  it('binds production to loopback by default', () => {
    expect(resolveListenHost('production')).toBe('127.0.0.1');
  });

  it('keeps non-production servers reachable on the local network', () => {
    expect(resolveListenHost('development')).toBe('0.0.0.0');
  });

  it('accepts an explicit IP address', () => {
    expect(resolveListenHost('production', '::1')).toBe('::1');
  });

  it('rejects hostnames and malformed addresses', () => {
    expect(() => resolveListenHost('production', 'public.example.com')).toThrow(
      'API_BIND_HOST must be an IP address',
    );
  });

  it('uses a dedicated validated intelligent-probe port', () => {
    expect(resolveProbePort()).toBe(3452);
    expect(resolveProbePort('3453')).toBe(3453);
    expect(() => resolveProbePort('70000')).toThrow(
      'INTELLIGENT_PROBE_PORT must be an integer between 1 and 65535',
    );
  });
});
