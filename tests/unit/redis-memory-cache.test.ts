import { describe, expect, it, vi } from 'vitest';

type MemoryCache = {
  new (options?: {
    maxEntries?: number;
    cleanupIntervalMs?: number;
    maxValueBytes?: number;
    maxBytes?: number;
  }): MemoryCacheInstance;
};

type MemoryCacheInstance = {
  get<T>(key: string): T | null;
  getWithPresence<T>(key: string): { found: boolean; value: T | null };
  set(key: string, value: unknown, ttlSeconds: number): void;
  setIfNotExists(key: string, value: unknown, ttlSeconds: number): boolean;
  deleteByPattern(pattern: string): number;
  cleanup(now?: number): number;
  size(): number;
  stopCleanup(): void;
};

const loadMemoryCache = async (): Promise<MemoryCache> => {
  const module = await import('../../server/services/redisService');
  return (module as { MemoryCache: MemoryCache }).MemoryCache;
};

describe('redis memory fallback cache', () => {
  it('evicts the oldest entry when the configured capacity is reached', async () => {
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 2, cleanupIntervalMs: 60_000 });

    try {
      cache.set('first', 1, 60);
      cache.set('second', 2, 60);
      cache.set('third', 3, 60);

      expect(cache.size()).toBe(2);
      expect(cache.get('first')).toBeNull();
      expect(cache.get('second')).toBe(2);
      expect(cache.get('third')).toBe(3);
    } finally {
      cache.stopCleanup();
    }
  }, 15_000);

  it('removes expired entries during scheduled cleanup without a read', async () => {
    vi.useFakeTimers();
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 10, cleanupIntervalMs: 10 });

    try {
      cache.set('expired', 'value', 0.001);
      cache.set('live', 'value', 60);

      vi.advanceTimersByTime(20);
      expect(cache.size()).toBe(1);
      expect(cache.get('expired')).toBeNull();
      expect(cache.get('live')).toBe('value');
    } finally {
      cache.stopCleanup();
      vi.useRealTimers();
    }
  }, 15_000);

  it('deletes matching public-list keys when Redis is unavailable', async () => {
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 10, cleanupIntervalMs: 60_000 });

    try {
      cache.set('server:public_list:one', { total: 1 }, 60);
      cache.set('server:public_list:two', { total: 2 }, 60);
      cache.set('server:info:one', { id: 1 }, 60);

      expect(cache.deleteByPattern('server:public_list:*')).toBe(2);
      expect(cache.get('server:public_list:one')).toBeNull();
      expect(cache.get('server:public_list:two')).toBeNull();
      expect(cache.get('server:info:one')).toEqual({ id: 1 });
    } finally {
      cache.stopCleanup();
    }
  });

  it('does not retain a value larger than the single-value byte budget', async () => {
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 10, maxValueBytes: 5, cleanupIntervalMs: 60_000 });

    try {
      cache.set('large', '123456', 60);

      expect(cache.get('large')).toBeNull();
      expect(cache.size()).toBe(0);
    } finally {
      cache.stopCleanup();
    }
  });

  it('evicts the oldest entries until the total byte budget can fit a new value', async () => {
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 10, maxBytes: 10, cleanupIntervalMs: 60_000 });

    try {
      cache.set('first', 'aa', 60);
      cache.set('second', 'bb', 60);
      cache.set('third', 'cccc', 60);

      expect(cache.get('first')).toBeNull();
      expect(cache.get('second')).toBe('bb');
      expect(cache.get('third')).toBe('cccc');
      expect(cache.size()).toBe(2);
    } finally {
      cache.stopCleanup();
    }
  });

  it('releases byte budget when matching entries are deleted', async () => {
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 10, maxBytes: 10, cleanupIntervalMs: 60_000 });

    try {
      cache.set('server:old', 'aa', 60);
      cache.set('server:live', 'bb', 60);
      expect(cache.deleteByPattern('server:old')).toBe(1);

      cache.set('server:new', 'cccc', 60);

      expect(cache.get('server:live')).toBe('bb');
      expect(cache.get('server:new')).toBe('cccc');
    } finally {
      cache.stopCleanup();
    }
  });

  it('distinguishes a cached null value from a missing key', async () => {
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 10, cleanupIntervalMs: 60_000 });

    try {
      cache.set('cached-null', null, 60);

      expect(cache.getWithPresence('cached-null')).toEqual({ found: true, value: null });
      expect(cache.getWithPresence('missing')).toEqual({ found: false, value: null });
    } finally {
      cache.stopCleanup();
    }
  });

  it('does not overwrite a cached null value in setIfNotExists', async () => {
    const Cache = await loadMemoryCache();
    const cache = new Cache({ maxEntries: 10, cleanupIntervalMs: 60_000 });

    try {
      cache.set('null-lock', null, 60);

      expect(cache.setIfNotExists('null-lock', 'replacement', 60)).toBe(false);
      expect(cache.getWithPresence('null-lock')).toEqual({ found: true, value: null });
    } finally {
      cache.stopCleanup();
    }
  });
});
