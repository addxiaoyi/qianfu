import { describe, expect, it } from 'vitest';

describe('pending cache request bounds', () => {
  it('keeps the in-flight request registry within its configured bound', async () => {
    const {
      MAX_PENDING_FETCHES,
      getPendingFetchCount,
      withCache,
      clearAllCaches,
      stopAllCacheCleanup,
    } = await import('../../server/services/cache');
    const gates = Array.from({ length: MAX_PENDING_FETCHES + 5 }, () => {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { promise, release };
    });

    try {
      const requests = gates.map((gate, index) => withCache(
        `test:pending-bound:${index}`,
        async () => {
          await gate.promise;
          return index;
        },
      ));

      expect(getPendingFetchCount()).toBeLessThanOrEqual(MAX_PENDING_FETCHES);
      gates.forEach(({ release }) => release());
      await Promise.all(requests);
    } finally {
      clearAllCaches();
      stopAllCacheCleanup();
    }
  });

  it('does not let an evicted request remove a newer request with the same key', async () => {
    const {
      MAX_PENDING_FETCHES,
      withCache,
      clearAllCaches,
      stopAllCacheCleanup,
    } = await import('../../server/services/cache');
    const firstGate = deferred<number>();
    const secondGate = deferred<number>();
    const evictedRequests: Array<Promise<unknown>> = [];

    try {
      const first = withCache('test:pending-identity', async () => firstGate.promise);
      for (let index = 0; index < MAX_PENDING_FETCHES; index += 1) {
        evictedRequests.push(withCache(`test:pending-evict:${index}`, async () => index));
      }
      const second = withCache('test:pending-identity', async () => secondGate.promise);

      firstGate.resolve(1);
      await expect(first).resolves.toBe(1);
      secondGate.resolve(2);
      await expect(second).resolves.toBe(2);
      await Promise.all(evictedRequests);
    } finally {
      clearAllCaches();
      stopAllCacheCleanup();
    }
  });
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}
