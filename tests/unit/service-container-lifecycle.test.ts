import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { ServiceRegistry } from '../../server/core/service-container';

class TestService extends EventEmitter {
  readonly name: string;
  readonly boot = vi.fn(async () => undefined);
  readonly shutdown = vi.fn(async () => undefined);
  readonly healthCheck = vi.fn(async () => true);

  constructor(name: string) {
    super();
    this.name = name;
  }
}

describe('ServiceRegistry lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await ServiceRegistry.shutdown().catch(() => undefined);
  });

  it('supports boot, shutdown, and boot again without losing shutdown ownership', async () => {
    const first = new TestService('lifecycle-first');
    ServiceRegistry.register(first.name, first);
    ServiceRegistry.registerInfo({
      name: first.name,
      host: '127.0.0.1',
      port: 3101,
      healthCheck: '/health',
      status: 'starting',
    });

    await ServiceRegistry.boot();
    await ServiceRegistry.shutdown();

    const second = new TestService('lifecycle-second');
    ServiceRegistry.register(second.name, second);
    ServiceRegistry.registerInfo({
      name: second.name,
      host: '127.0.0.1',
      port: 3102,
      healthCheck: '/health',
      status: 'starting',
    });

    await ServiceRegistry.boot();
    await ServiceRegistry.shutdown();

    expect(first.shutdown).toHaveBeenCalledOnce();
    expect(second.boot).toHaveBeenCalledOnce();
    expect(second.shutdown).toHaveBeenCalledOnce();
  });

  it('does not overlap health checks when one check takes longer than the interval', async () => {
    let resolveHealth: (() => void) | undefined;
    const service = new TestService('health-overlap');
    service.healthCheck.mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveHealth = () => resolve(true);
    }));
    ServiceRegistry.register(service.name, service);
    ServiceRegistry.registerInfo({
      name: service.name,
      host: '127.0.0.1',
      port: 3103,
      healthCheck: '/health',
      status: 'starting',
    });

    await ServiceRegistry.boot();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(service.healthCheck).toHaveBeenCalledOnce();
    resolveHealth?.();
    await ServiceRegistry.shutdown();
  });

  it('does not let a stale failed health check mark a replacement service unhealthy', async () => {
    let rejectHealth: ((error: Error) => void) | undefined;
    const first = new TestService('health-generation');
    first.healthCheck.mockImplementationOnce(() => new Promise<boolean>((_resolve, reject) => {
      rejectHealth = reject;
    }));
    ServiceRegistry.register(first.name, first);
    ServiceRegistry.registerInfo({
      name: first.name,
      host: '127.0.0.1',
      port: 3104,
      healthCheck: '/health',
      status: 'starting',
    });

    await ServiceRegistry.boot();
    await vi.advanceTimersByTimeAsync(30_000);
    await ServiceRegistry.shutdown();

    const replacement = new TestService('health-generation');
    ServiceRegistry.register(replacement.name, replacement);
    ServiceRegistry.registerInfo({
      name: replacement.name,
      host: '127.0.0.1',
      port: 3105,
      healthCheck: '/health',
      status: 'starting',
    });
    await ServiceRegistry.boot();

    rejectHealth?.(new Error('stale health failure'));
    await Promise.resolve();
    await Promise.resolve();

    expect(ServiceRegistry.getInfo(replacement.name)?.status).toBe('healthy');
  });

  it('removes stale error listeners when replacing and shutting down services', async () => {
    const first = new TestService('listener-cleanup');
    const second = new TestService('listener-cleanup');
    ServiceRegistry.register(first.name, first);
    expect(first.listenerCount('error')).toBe(1);

    ServiceRegistry.register(second.name, second);
    expect(first.listenerCount('error')).toBe(0);
    expect(second.listenerCount('error')).toBe(1);

    await ServiceRegistry.shutdown();
    expect(second.listenerCount('error')).toBe(0);
  });

  it('reports shutdown failures after attempting every registered service', async () => {
    const failed = new TestService('shutdown-failed');
    const healthy = new TestService('shutdown-healthy');
    failed.shutdown.mockRejectedValueOnce(new Error('socket close failed'));
    ServiceRegistry.register(failed.name, failed);
    ServiceRegistry.register(healthy.name, healthy);

    await expect(ServiceRegistry.shutdown()).rejects.toThrow('shutdown-failed');
    expect(healthy.shutdown).toHaveBeenCalledOnce();
  });
});
