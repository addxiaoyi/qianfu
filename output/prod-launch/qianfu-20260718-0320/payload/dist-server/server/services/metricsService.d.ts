export interface MetricPoint {
    timestamp: number;
    month: string;
    visits: number;
    active: number;
    registered: number;
}
export interface QueryParams {
    page?: number;
    size?: number;
    sortBy?: keyof MetricPoint;
    order?: 'asc' | 'desc';
    start?: number;
    end?: number;
}
declare class MetricsService {
    private data;
    private timer;
    private visitsFile;
    private totalVisits;
    isReady: boolean;
    private cacheHits;
    private cacheMisses;
    private loadTotalVisits;
    private saveTotalVisits;
    trackVisit(): void;
    recordHttpRequest(method: string, route: string, status: string, duration: number): void;
    recordRedisHit(): void;
    recordRedisMiss(): void;
    private updateCacheHitRatio;
    recordApiLatency(endpoint: string, method: string, durationSeconds: number): void;
    recordServiceCall(caller: string, target: string, method: string, status: string, durationSeconds: number): void;
    recordServiceRetry(caller: string, target: string, method: string): void;
    setCircuitBreakerState(service: string, state: 'closed' | 'open' | 'half-open'): void;
    recordDbQuery(operation: string, model: string, status: 'success' | 'error', durationSeconds: number): void;
    setDbPoolSize(state: 'idle' | 'active' | 'total', size: number): void;
    recordPayment(amount: number, currency: string, status: string): void;
    updateWalletMetrics(): Promise<void>;
    recordAuthAttempt(type: 'login' | 'oauth' | 'email', status: 'success' | 'failure'): void;
    recordRateLimitHit(endpoint: string, tier?: string): void;
    updateBusinessMetrics(): Promise<void>;
    getPrometheusMetrics(): Promise<string>;
    getRegistryContentType(): "text/plain; version=0.0.4; charset=utf-8";
    init(): Promise<void>;
    start(): void;
    stop(): void;
    query(params: QueryParams): {
        items: MetricPoint[];
        page: number;
        size: number;
        total: number;
        hasMore: boolean;
        summary: {
            visits: number;
            active: number;
            registered: number;
        };
    };
    summary(items: MetricPoint[]): {
        visits: number;
        active: number;
        registered: number;
    };
    getPublicSummary(): {
        items: never[];
        summary: {
            visits: number;
            active: number;
            registered: number;
        };
        page: number;
        size: number;
        total: number;
        hasMore: boolean;
    };
}
export declare const metricsService: MetricsService;
export {};
//# sourceMappingURL=metricsService.d.ts.map