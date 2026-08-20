import { cleanupAllCaches } from './cache';
import { logger } from '../utils/logger';
import { calculateHeapUsagePercent } from '../utils/memoryUsage';

const MB = 1024 * 1024;

type MonitorOptions = {
  rssBytes: () => number;
  heapUsagePercent?: () => number;
  cleanCaches: () => unknown;
  warn: (details: {
    rssMb: number;
    thresholdMb: number;
    heapUsagePercent: number;
    heapThresholdPercent?: number;
    reason: 'rss' | 'heap' | 'rss+heap';
    cacheCleanup: unknown;
  }) => void;
  thresholdBytes: number;
  heapThresholdPercent?: number;
  cooldownMs: number;
};

export const createMemoryPressureMonitor = (options: MonitorOptions) => {
  let lastCleanupAt = 0;

  return {
    check(now = Date.now()): boolean {
      const rssBytes = options.rssBytes();
      const heapUsagePercent = options.heapUsagePercent?.() ?? 0;
      const rssPressure = rssBytes >= options.thresholdBytes;
      const heapPressure = options.heapThresholdPercent !== undefined
        && heapUsagePercent >= options.heapThresholdPercent;
      if ((!rssPressure && !heapPressure) || (lastCleanupAt > 0 && now - lastCleanupAt < options.cooldownMs)) return false;

      lastCleanupAt = now;
      const cacheCleanup = options.cleanCaches();
      options.warn({
        rssMb: Math.round(rssBytes / MB),
        thresholdMb: Math.round(options.thresholdBytes / MB),
        heapUsagePercent,
        heapThresholdPercent: options.heapThresholdPercent,
        reason: rssPressure && heapPressure ? 'rss+heap' : rssPressure ? 'rss' : 'heap',
        cacheCleanup,
      });
      return true;
    },
  };
};

const parseThresholdMb = (): number => {
  const configured = Number.parseInt(process.env.MEMORY_PRESSURE_RSS_MB || '450', 10);
  return Number.isFinite(configured) && configured >= 128 ? configured : 450;
};

const parseHeapThresholdPercent = (): number => {
  const configured = Number.parseInt(process.env.MEMORY_PRESSURE_HEAP_PERCENT || '85', 10);
  return Number.isFinite(configured) && configured >= 60 && configured <= 99 ? configured : 85;
};

export const startMemoryPressureMonitor = (): NodeJS.Timeout => {
  const thresholdMb = parseThresholdMb();
  const heapThresholdPercent = parseHeapThresholdPercent();
  const monitor = createMemoryPressureMonitor({
    rssBytes: () => process.memoryUsage().rss,
    heapUsagePercent: () => {
      return calculateHeapUsagePercent(process.memoryUsage().heapUsed);
    },
    cleanCaches: cleanupAllCaches,
    warn: (details) => logger.warn('[MemoryPressure] Cache cleanup triggered', details),
    thresholdBytes: thresholdMb * MB,
    heapThresholdPercent,
    cooldownMs: 5 * 60 * 1000,
  });
  monitor.check();
  const timer = setInterval(() => monitor.check(), 60 * 1000);
  timer.unref?.();
  return timer;
};

export const stopMemoryPressureMonitor = (timer?: NodeJS.Timeout): void => {
  if (timer) clearInterval(timer);
};
