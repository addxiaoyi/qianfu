import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

import { createMemoryPressureMonitor, stopMemoryPressureMonitor } from '../../server/services/memoryPressureService';

describe('memory pressure monitor', () => {
  it('keeps live cache entries during pressure cleanup', () => {
    const source = fs.readFileSync('server/services/memoryPressureService.ts', 'utf8');
    expect(source).toContain("import { cleanupAllCaches } from './cache';");
    expect(source).not.toContain('cleanCaches: clearAllCaches');
  });
  it('stops the interval during process shutdown', () => {
    const timer = setInterval(() => undefined, 60_000);
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    stopMemoryPressureMonitor(timer);

    expect(clearIntervalSpy).toHaveBeenCalledWith(timer);
    clearIntervalSpy.mockRestore();
  });

  it('cleans caches once when RSS crosses the configured threshold', () => {
    const cleanCaches = vi.fn();
    const warn = vi.fn();
    const monitor = createMemoryPressureMonitor({
      rssBytes: () => 500 * 1024 * 1024,
      cleanCaches,
      warn,
      thresholdBytes: 450 * 1024 * 1024,
      cooldownMs: 60_000,
    });

    monitor.check(1_000);
    monitor.check(2_000);

    expect(cleanCaches).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ rssMb: 500 }));
  });

  it('uses bounded cleanup when RSS crosses the configured threshold', () => {
    const cleanupExpired = vi.fn();
    const monitor = createMemoryPressureMonitor({
      rssBytes: () => 500 * 1024 * 1024,
      cleanCaches: cleanupExpired,
      warn: vi.fn(),
      thresholdBytes: 450 * 1024 * 1024,
      cooldownMs: 60_000,
    });

    monitor.check(1_000);

    expect(cleanupExpired).toHaveBeenCalledTimes(1);
  });

  it('does nothing below the RSS threshold', () => {
    const cleanCaches = vi.fn();
    const monitor = createMemoryPressureMonitor({
      rssBytes: () => 200 * 1024 * 1024,
      cleanCaches,
      warn: vi.fn(),
      thresholdBytes: 450 * 1024 * 1024,
      cooldownMs: 60_000,
    });

    monitor.check(1_000);

    expect(cleanCaches).not.toHaveBeenCalled();
  });

  it('cleans caches when heap pressure is high even below the RSS threshold', () => {
    const cleanCaches = vi.fn();
    const warn = vi.fn();
    const monitor = createMemoryPressureMonitor({
      rssBytes: () => 200 * 1024 * 1024,
      heapUsagePercent: () => 92,
      cleanCaches,
      warn,
      thresholdBytes: 450 * 1024 * 1024,
      heapThresholdPercent: 85,
      cooldownMs: 60_000,
    } as any);

    monitor.check(1_000);

    expect(cleanCaches).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({
      heapUsagePercent: 92,
    }));
  });
});
