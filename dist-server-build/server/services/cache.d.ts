import { Response } from 'express';
interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    createdAt: number;
    hits: number;
}
interface CacheOptions {
    ttl?: number;
    maxSize?: number;
    staleWhileRevalidate?: boolean;
}
interface LRUCacheEntry<T> {
    value: T;
    expiresAt: number;
    lastAccessed: number;
    accessCount: number;
}
declare class LRUCache<T> {
    private cache;
    private maxSize;
    private defaultTTL;
    private cleanupInterval;
    private cleanupIntervalMs;
    constructor(maxSize?: number, defaultTTL?: number, cleanupIntervalMs?: number);
    private startCleanup;
    stopCleanup(): void;
    get(key: string): T | null;
    set(key: string, value: T, ttl?: number): void;
    delete(key: string): boolean;
    clear(): void;
    private evictLRU;
    size(): number;
    cleanup(): number;
    getStats(): {
        size: number;
        maxSize: number;
        hitRate?: number;
    };
}
declare class TTLCache<T> {
    private cache;
    private cleanupInterval;
    private cleanupIntervalMs;
    private maxSize;
    constructor(cleanupIntervalMs?: number, maxSize?: number);
    private startCleanup;
    stopCleanup(): void;
    get(key: string): T | null;
    set(key: string, value: T, ttlMs?: number): void;
    delete(key: string): boolean;
    clear(): void;
    private evictOldest;
    cleanup(): number;
    size(): number;
    getEntryStats(key: string): {
        hits: number;
        age: number;
        isExpired: boolean;
    } | null;
    getStats(): {
        size: number;
        maxSize: number;
        entries: {
            key: string;
            hits: number;
            age: number;
        }[];
    };
    entries(): IterableIterator<[string, T]>;
}
declare const memoryCache: TTLCache<unknown>;
declare const lruCache: LRUCache<unknown>;
declare const serverCache: LRUCache<unknown>;
declare const authCache: LRUCache<unknown>;
declare function cacheGet<T>(key: string, cache?: TTLCache<T> | LRUCache<T>): T | null;
declare function cacheSet<T>(key: string, value: T, ttlMs?: number, cache?: TTLCache<T> | LRUCache<T>): void;
declare function cacheDelete(key: string, cache?: TTLCache<unknown> | LRUCache<unknown>): boolean;
declare function cacheClear(cache?: TTLCache<unknown> | LRUCache<unknown>): void;
declare function withCache<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T>;
declare function memoize<T>(fn: (...args: unknown[]) => Promise<T>, options?: CacheOptions): (...args: unknown[]) => Promise<T>;
declare function createMemoizedFunction<T, A extends unknown[]>(fn: (...args: A) => T, getKey: (...args: A) => string, ttlMs?: number): (...args: A) => T | null;
declare function setCacheHeaders(res: Response, maxAge?: number): void;
declare function setNoCacheHeaders(res: Response): void;
declare function setPrivateCacheHeaders(res: Response, maxAge?: number): void;
declare function tryGetFromCache<T>(key: string, fetcher: () => Promise<T>, options?: {
    ttl?: number;
    staleTime?: number;
}): Promise<T>;
declare function invalidateCache(pattern: string | RegExp): number;
declare function getCacheStats(): {
    memoryCache: {
        size: number;
        maxSize: number;
    };
    lruCache: {
        size: number;
        maxSize: number;
    };
    serverCache: {
        size: number;
        maxSize: number;
    };
    authCache: {
        size: number;
        maxSize: number;
    };
};
declare function cleanupAllCaches(): {
    memory: number;
    lru: number;
    server: number;
    auth: number;
};
export { TTLCache, LRUCache, memoryCache, lruCache, serverCache, authCache, cacheGet, cacheSet, cacheDelete, cacheClear, withCache, memoize, createMemoizedFunction, setCacheHeaders, setNoCacheHeaders, setPrivateCacheHeaders, tryGetFromCache, invalidateCache, getCacheStats, cleanupAllCaches, };
export type { CacheOptions, CacheEntry, LRUCacheEntry };
//# sourceMappingURL=cache.d.ts.map