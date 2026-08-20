import { describe, expect, it } from 'vitest';
import { DataPrefetchCache } from '../../qianfu-liandeng/src/hooks/useRoutePrefetch';

describe('route prefetch cache lifecycle', () => {
  it('evicts the least recently used route when capacity is reached', () => {
    const cache = new DataPrefetchCache(2);

    cache.set('/first', 1);
    cache.set('/second', 2);
    expect(cache.get('/first')?.data).toBe(1);
    cache.set('/third', 3);

    expect(cache.get('/first')?.data).toBe(1);
    expect(cache.get('/second')).toBeNull();
    expect(cache.get('/third')?.data).toBe(3);
  });

  it('removes pending requests after both resolve and reject without creating an unhandled promise', async () => {
    const cache = new DataPrefetchCache(2);
    const resolved = Promise.resolve('ok');
    const rejected = Promise.reject(new Error('failed'));

    cache.setPending('/resolved', resolved);
    cache.setPending('/rejected', rejected);
    await Promise.allSettled([resolved, rejected]);
    await Promise.resolve();

    expect(cache.getPending('/resolved')).toBeNull();
    expect(cache.getPending('/rejected')).toBeNull();
  });
});
