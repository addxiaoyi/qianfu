import { cleanupAllCaches } from './cache';
import { logger } from '../utils/logger';
const MB = 1024 * 1024;
export const createMemoryPressureMonitor = (options) => {
    let lastCleanupAt = 0;
    return {
        check(now = Date.now()) {
            const rssBytes = options.rssBytes();
            const heapUsagePercent = options.heapUsagePercent?.() ?? 0;
            const rssPressure = rssBytes >= options.thresholdBytes;
            const heapPressure = options.heapThresholdPercent !== undefined
                && heapUsagePercent >= options.heapThresholdPercent;
            if ((!rssPressure && !heapPressure) || (lastCleanupAt > 0 && now - lastCleanupAt < options.cooldownMs))
                return false;
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
const parseThresholdMb = () => {
    const configured = Number.parseInt(process.env.MEMORY_PRESSURE_RSS_MB || '450', 10);
    return Number.isFinite(configured) && configured >= 128 ? configured : 450;
};
const parseHeapThresholdPercent = () => {
    const configured = Number.parseInt(process.env.MEMORY_PRESSURE_HEAP_PERCENT || '85', 10);
    return Number.isFinite(configured) && configured >= 60 && configured <= 99 ? configured : 85;
};
export const startMemoryPressureMonitor = () => {
    const thresholdMb = parseThresholdMb();
    const heapThresholdPercent = parseHeapThresholdPercent();
    const monitor = createMemoryPressureMonitor({
        rssBytes: () => process.memoryUsage().rss,
        heapUsagePercent: () => {
            const { heapUsed, heapTotal } = process.memoryUsage();
            return heapTotal > 0 ? Math.round((heapUsed / heapTotal) * 100) : 0;
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
export const stopMemoryPressureMonitor = (timer) => {
    if (timer)
        clearInterval(timer);
};
//# sourceMappingURL=memoryPressureService.js.map