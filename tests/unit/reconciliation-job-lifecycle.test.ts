import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReconciliationScheduler } from '../../server/core/task/ReconciliationJob';

describe('reconciliation scheduler lifecycle', () => {
  afterEach(() => vi.useRealTimers());

  it('does not overlap a slow reconciliation run', async () => {
    vi.useFakeTimers();
    let resolveTask: (() => void) | undefined;
    let activeRuns = 0;
    let maxActiveRuns = 0;
    const task = vi.fn(() => {
      activeRuns += 1;
      maxActiveRuns = Math.max(maxActiveRuns, activeRuns);
      return new Promise<void>(resolve => {
        resolveTask = () => {
          activeRuns -= 1;
          resolve();
        };
      });
    });
    const scheduler = createReconciliationScheduler(task, 10);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(100);

    expect(task).toHaveBeenCalledTimes(1);
    expect(maxActiveRuns).toBe(1);

    resolveTask?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);
    expect(task).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });
});
