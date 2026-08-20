import { redisService } from './redisService.js';
class LRUCache {
    cache;
    maxSize;
    defaultTTL;
    cleanupInterval = null;
    cleanupIntervalMs;
    constructor(maxSize = 1000, defaultTTL = 300000, cleanupIntervalMs = 60000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
        this.cleanupIntervalMs = cleanupIntervalMs;
        this.startCleanup();
    }
    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    }
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        return entry.value;
    }
    set(key, value, ttl) {
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttl || this.defaultTTL),
            lastAccessed: Date.now(),
            accessCount: 0,
        });
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;
        let lowestAccessCount = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (Date.now() > entry.expiresAt) {
                this.cache.delete(key);
                return;
            }
            if (entry.lastAccessed < oldestTime ||
                (entry.lastAccessed === oldestTime && entry.accessCount < lowestAccessCount)) {
                oldestTime = entry.lastAccessed;
                lowestAccessCount = entry.accessCount;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
    size() {
        return this.cache.size;
    }
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }
        return removed;
    }
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}
class TTLCache {
    cache;
    cleanupInterval = null;
    cleanupIntervalMs;
    maxSize;
    constructor(cleanupIntervalMs = 60000, maxSize = 10000) {
        this.cache = new Map();
        this.cleanupIntervalMs = cleanupIntervalMs;
        this.maxSize = maxSize;
        this.startCleanup();
    }
    startCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    }
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        entry.hits++;
        return entry.value;
    }
    set(key, value, ttlMs = 300000) {
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
            createdAt: Date.now(),
            hits: 0,
        });
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (Date.now() > entry.expiresAt) {
                this.cache.delete(key);
                return;
            }
            if (entry.createdAt < oldestTime) {
                oldestTime = entry.createdAt;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }
        return removed;
    }
    size() {
        return this.cache.size;
    }
    getEntryStats(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        return {
            hits: entry.hits,
            age: Date.now() - entry.createdAt,
            isExpired: Date.now() > entry.expiresAt,
        };
    }
    getStats() {
        const entries = [];
        for (const [key, entry] of this.cache.entries()) {
            entries.push({
                key,
                hits: entry.hits,
                age: Date.now() - entry.createdAt,
            });
        }
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            entries,
        };
    }
    *entries() {
        for (const [key, entry] of this.cache.entries()) {
            if (Date.now() <= entry.expiresAt) {
                yield [key, entry.value];
            }
        }
    }
}
const memoryCache = new TTLCache(60000, 5000);
const lruCache = new LRUCache(500, 300000, 60000);
const serverCache = new LRUCache(1000, 60000, 30000);
const authCache = new LRUCache(100, 300000, 60000);
function cacheGet(key, cache = memoryCache) {
    return cache.get(key);
}
function cacheSet(key, value, ttlMs = 300000, cache = memoryCache) {
    if (cache instanceof TTLCache) {
        cache.set(key, value, ttlMs);
    }
    else {
        cache.set(key, value, ttlMs);
    }
}
function cacheDelete(key, cache = memoryCache) {
    return cache.delete(key);
}
function cacheClear(cache = memoryCache) {
    cache.clear();
}
async function withCache(key, fetcher, options = {}) {
    const { ttl = 300000, staleWhileRevalidate = false } = options;
    // Check memory cache first for fastest response
    const cached = cacheGet(key);
    if (cached !== null) {
        return cached;
    }
    // Primary: Redis retrieval
    const redisCached = await redisService.get(key);
    if (redisCached !== null) {
        // Populate memory cache for next time
        cacheSet(key, redisCached, ttl);
        return redisCached;
    }
    return fetcher()
        .then(async (value) => {
        // 3. Set Memory & Redis
        cacheSet(key, value, ttl);
        await redisService.set(key, value, Math.floor(ttl / 1000));
        return value;
    })
        .catch(async (error) => {
        if (staleWhileRevalidate) {
            const stale = (await redisService.get(key)) || cacheGet(key);
            if (stale !== null) {
                return stale;
            }
        }
        throw error;
    });
}
function memoize(fn, options = {}) {
    const { ttl = 300000, maxSize } = options;
    return (...args) => {
        const key = JSON.stringify(args);
        return withCache(key, () => fn(...args), { ttl, maxSize });
    };
}
function createMemoizedFunction(fn, getKey, ttlMs = 300000) {
    const cache = new TTLCache(60000, 1000);
    return (...args) => {
        const key = getKey(...args);
        const cached = cache.get(key);
        if (cached !== null) {
            return cached;
        }
        const result = fn(...args);
        if (result instanceof Promise) {
            result.then((value) => cache.set(key, value, ttlMs)).catch(() => { });
            return null;
        }
        cache.set(key, result, ttlMs);
        return result;
    };
}
function setCacheHeaders(res, maxAge = 31536000) {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, immutable`);
    res.setHeader('ETag', `"${Date.now().toString(36)}"`);
}
function setNoCacheHeaders(res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
}
function setPrivateCacheHeaders(res, maxAge = 0) {
    res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
}
async function tryGetFromCache(key, fetcher, options = {}) {
    const { ttl = 300000, staleTime = 60000 } = options;
    const cached = cacheGet(key);
    if (cached !== null) {
        const entryStats = memoryCache.getEntryStats(key);
        if (entryStats && !entryStats.isExpired) {
            if (entryStats.age < staleTime) {
                return cached;
            }
        }
    }
    return withCache(key, fetcher, { ttl });
}
function invalidateCache(pattern) {
    let invalidated = 0;
    if (typeof pattern === 'string') {
        if (memoryCache.delete(pattern))
            invalidated++;
        if (lruCache.delete(pattern))
            invalidated++;
        if (serverCache.delete(pattern))
            invalidated++;
        if (authCache.delete(pattern))
            invalidated++;
    }
    else {
        const keys = [];
        for (const key of memoryCache.keys()) {
            if (pattern.test(key))
                keys.push(key);
        }
        for (const key of keys) {
            if (memoryCache.delete(key))
                invalidated++;
        }
    }
    return invalidated;
}
function getCacheStats() {
    return {
        memoryCache: { size: memoryCache.size(), maxSize: memoryCache.maxSize || 5000 },
        lruCache: lruCache.getStats(),
        serverCache: serverCache.getStats(),
        authCache: authCache.getStats(),
    };
}
function cleanupAllCaches() {
    return {
        memory: memoryCache.cleanup(),
        lru: lruCache.cleanup(),
        server: serverCache.cleanup(),
        auth: authCache.cleanup(),
    };
}
export { TTLCache, LRUCache, memoryCache, lruCache, serverCache, authCache, cacheGet, cacheSet, cacheDelete, cacheClear, withCache, memoize, createMemoizedFunction, setCacheHeaders, setNoCacheHeaders, setPrivateCacheHeaders, tryGetFromCache, invalidateCache, getCacheStats, cleanupAllCaches, };
//# sourceMappingURL=cache.js.map