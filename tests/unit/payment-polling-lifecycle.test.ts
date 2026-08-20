import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentPoller } from '../../qianfu-liandeng/src/pages/paymentPolling';

describe('payment polling lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps only one status request in flight and stops after a terminal status', async () => {
    vi.useFakeTimers();
    let resolveFirst: ((status: 'PENDING' | 'COMPLETED') => void) | undefined;
    const poll = vi.fn(() => new Promise<'PENDING' | 'COMPLETED'>(resolve => {
      resolveFirst = resolve;
    }));
    const onStatus = vi.fn();
    const poller = createPaymentPoller(poll, {
      initialDelayMs: 10,
      maxDelayMs: 20,
      onStatus,
    });

    poller.start();
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(100);
    expect(poll).toHaveBeenCalledTimes(1);

    resolveFirst?.('COMPLETED');
    await vi.waitFor(() => expect(onStatus).toHaveBeenCalledWith('COMPLETED'));
    await vi.advanceTimersByTimeAsync(100);

    expect(poll).toHaveBeenCalledTimes(1);
    expect(poller.isRunning()).toBe(false);
  });

  it('does not schedule another request when stopped during an in-flight request', async () => {
    vi.useFakeTimers();
    let resolvePoll: (() => void) | undefined;
    const poll = vi.fn(() => new Promise<'PENDING'>(resolve => {
      resolvePoll = () => resolve('PENDING');
    }));
    const poller = createPaymentPoller(poll, { initialDelayMs: 10, onStatus: vi.fn() });

    poller.start();
    await vi.advanceTimersByTimeAsync(10);
    poller.stop();
    resolvePoll?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);

    expect(poll).toHaveBeenCalledTimes(1);
    expect(poller.isRunning()).toBe(false);
  });

  it('aborts the in-flight request when stopped', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const poll = vi.fn((requestSignal?: AbortSignal) => {
      signal = requestSignal;
      return new Promise<'PENDING'>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      });
    });
    const poller = createPaymentPoller(poll, { initialDelayMs: 10, onStatus: vi.fn() });

    poller.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(signal?.aborted).toBe(false);

    poller.stop();

    expect(signal?.aborted).toBe(true);
    expect(poller.isRunning()).toBe(false);
  });
});
