import { describe, expect, it } from 'vitest';

describe('bounded cache behavior', () => {
  it('honors a per-write maximum smaller than the cache default', async () => {
    const { TTLCache } = await import('../../server/services/cache');
    const cache = new TTLCache<number>(60_000, 10);

    try {
      cache.set('first', 1, 60_000, 2);
      cache.set('second', 2, 60_000, 2);
      cache.set('third', 3, 60_000, 2);

      expect(cache.size()).toBe(2);
      expect(cache.get('first')).toBeNull();
      expect(cache.get('second')).toBe(2);
      expect(cache.get('third')).toBe(3);
    } finally {
      cache.stopCleanup();
    }
  });

  it('does not keep the process alive only to run cache cleanup', async () => {
    const { TTLCache, LRUCache } = await import('../../server/services/cache');
    const ttl = new TTLCache<number>(60_000, 10);
    const lru = new LRUCache<number>(10, 60_000, 60_000);

    try {
      expect((ttl as any).cleanupInterval?.hasRef?.()).toBe(false);
      expect((lru as any).cleanupInterval?.hasRef?.()).toBe(false);
    } finally {
      ttl.stopCleanup();
      lru.stopCleanup();
    }
  });

  it('updates an existing full-cache key without evicting another entry', async () => {
    const { TTLCache, LRUCache } = await import('../../server/services/cache');
    const ttl = new TTLCache<number>(60_000, 2);
    const lru = new LRUCache<number>(2, 60_000, 60_000);

    try {
      ttl.set('first', 1, 60_000);
      ttl.set('second', 2, 60_000);
      ttl.set('first', 3, 60_000);
      expect(ttl.get('second')).toBe(2);
      expect(ttl.get('first')).toBe(3);

      lru.set('first', 1, 60_000);
      lru.set('second', 2, 60_000);
      lru.set('first', 3, 60_000);
      expect(lru.get('second')).toBe(2);
      expect(lru.get('first')).toBe(3);
    } finally {
      ttl.stopCleanup();
      lru.stopCleanup();
    }
  });

  it('normalizes an invalid capacity to a usable positive bound', async () => {
    const { TTLCache } = await import('../../server/services/cache');
    const cache = new TTLCache<number>(60_000, 0);

    try {
      expect(cache.getStats().maxSize).toBeGreaterThan(0);
    } finally {
      cache.stopCleanup();
    }
  });

  it('rejects oversized values and evicts the oldest entries by total serialized bytes', async () => {
    const { TTLCache } = await import('../../server/services/cache');
    const cache = new TTLCache<string>(60_000, 10, 5, 8);

    try {
      cache.set('first', 'aa', 60_000);
      cache.set('second', 'bb', 60_000);
      cache.set('too-large', '1234', 60_000);
      cache.set('third', 'cc', 60_000);

      expect(cache.get('too-large')).toBeNull();
      expect(cache.get('first')).toBeNull();
      expect(cache.get('second')).toBe('bb');
      expect(cache.get('third')).toBe('cc');
      expect(cache.getStats().bytes).toBe(8);
    } finally {
      cache.stopCleanup();
    }
  });

  it('evicts the least recently used entries by total serialized bytes', async () => {
    const { LRUCache } = await import('../../server/services/cache');
    const cache = new LRUCache<string>(10, 60_000, 60_000, 5, 8);

    try {
      cache.set('first', 'aa', 60_000);
      cache.set('second', 'bb', 60_000);
      expect(cache.get('first')).toBe('aa');
      cache.set('third', 'cc', 60_000);

      expect(cache.get('first')).toBe('aa');
      expect(cache.get('second')).toBeNull();
      expect(cache.get('third')).toBe('cc');
      expect(cache.getStats().bytes).toBe(8);
    } finally {
      cache.stopCleanup();
    }
  });
});
