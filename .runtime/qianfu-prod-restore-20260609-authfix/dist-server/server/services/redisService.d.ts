import Redis from 'ioredis';
declare class RedisService {
    private client;
    private isConnected;
    private memoryFallback;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private redisDisabledForProcess;
    private lastErrorLogAt;
    constructor();
    private init;
    private logErrorThrottled;
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
    setIfNotExists(key: string, value: any, ttlSeconds?: number): Promise<boolean>;
    del(key: string): Promise<void>;
    incr(key: string, ttlSeconds?: number): Promise<number>;
    expire(key: string, ttlSeconds: number): Promise<void>;
    getTTL(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    /**
     * Delete keys by pattern (using SCAN for performance)
     */
    delByPattern(pattern: string): Promise<void>;
    flush(): Promise<void>;
    /**
     * Acquire a distributed lock using Redis (Redlock algorithm simplified)
     * @param key Unique lock key
     * @param ttlSeconds Lock timeout to prevent deadlocks
     * @returns Lock success
     */
    acquireLock(key: string, ttlSeconds?: number): Promise<boolean>;
    /**
     * Release a distributed lock
     * @param key Unique lock key
     */
    releaseLock(key: string): Promise<void>;
    /**
     * Execute a function within a distributed lock
     * @param key Unique lock key
     * @param fn Function to execute
     * @param ttlSeconds Lock timeout
     * @returns Function result
     */
    withLock<T>(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T>;
    getStatus(): boolean;
    getClient(): Redis | null;
    lpush(key: string, value: any): Promise<void>;
    rpop<T>(key: string): Promise<T | null>;
    ping(): Promise<string>;
}
export declare const redisService: RedisService;
export default redisService;
//# sourceMappingURL=redisService.d.ts.map