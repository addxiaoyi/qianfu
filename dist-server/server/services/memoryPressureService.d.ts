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
export declare const createMemoryPressureMonitor: (options: MonitorOptions) => {
    check(now?: number): boolean;
};
export declare const startMemoryPressureMonitor: () => NodeJS.Timeout;
export declare const stopMemoryPressureMonitor: (timer?: NodeJS.Timeout) => void;
export {};
//# sourceMappingURL=memoryPressureService.d.ts.map