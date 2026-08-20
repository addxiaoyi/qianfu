import { describe, expect, it } from 'vitest';

describe('cache request coalescing', () => {
  it('reuses a cached null result instead of refetching it', async () => {
    const { withCache, clearAllCaches, stopAllCacheCleanup } = await import('../../server/services/cache');
    let calls = 0;

    try {
      const fetcher = async () => {
        calls += 1;
        return null;
      };

      await expect(withCache('test:null-result', fetcher)).resolves.toBeNull();
      await expect(withCache('test:null-result', fetcher)).resolves.toBeNull();
      expect(calls).toBe(1);
    } finally {
      clearAllCaches();
      stopAllCacheCleanup();
    }
  });

  it('reuses a cached null result through stale-aware reads', async () => {
    const { tryGetFromCache, clearAllCaches, stopAllCacheCleanup } = await import('../../server/services/cache');
    let calls = 0;

    try {
      const fetcher = async () => {
        calls += 1;
        return null;
      };

      await expect(tryGetFromCache('test:null-stale-result', fetcher)).resolves.toBeNull();
      await expect(tryGetFromCache('test:null-stale-result', fetcher)).resolves.toBeNull();
      expect(calls).toBe(1);
    } finally {
      clearAllCaches();
      stopAllCacheCleanup();
    }
  });

  it('uses a Redis null sentinel as a cache hit instead of refetching', async () => {
    const { withCache, clearAllCaches, stopAllCacheCleanup } = await import('../../server/services/cache');
    const { redisService } = await import('../../server/services/redisService');
    const originalGetWithPresence = redisService.getWithPresence.bind(redisService);
    let calls = 0;

    try {
      redisService.getWithPresence = async () => ({ found: true, value: null });
      await expect(withCache('test:redis-null-result', async () => {
        calls += 1;
        return 'unexpected';
      })).resolves.toBeNull();
      expect(calls).toBe(0);
    } finally {
      redisService.getWithPresence = originalGetWithPresence;
      clearAllCaches();
      stopAllCacheCleanup();
    }
  });

  it('coalesces concurrent misses without caching a rejected fetch', async () => {
    const { withCache, clearAllCaches, stopAllCacheCleanup } = await import('../../server/services/cache');
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error('upstream unavailable');
    };

    try {
      const first = withCache('test:coalesce:rejected', fetcher);
      const second = withCache('test:coalesce:rejected', fetcher);

      await expect(Promise.all([first, second])).rejects.toThrow('upstream unavailable');
      expect(calls).toBe(1);
      await expect(withCache('test:coalesce:rejected', async () => 'ok')).resolves.toBe('ok');
    } finally {
      clearAllCaches();
      stopAllCacheCleanup();
    }
  });
});
