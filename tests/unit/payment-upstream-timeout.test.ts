import { describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '../../server/utils/fetchWithTimeout';

describe('payment upstream request lifecycle', () => {
  it('aborts a stalled upstream request after the configured timeout', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));

    const request = fetchWithTimeout('https://pay.example.test/create', { method: 'POST' }, 100, fetcher);
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(100);

    await rejected;
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('propagates a caller abort signal before the timeout', async () => {
    const caller = new AbortController();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));

    const request = fetchWithTimeout('https://pay.example.test/create', {}, 10_000, fetcher, caller.signal);
    caller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
