import { describe, expect, it, vi } from 'vitest';

import { createPeriodicSyncScheduler } from '../../server/services/syncService';

describe('periodic sync scheduler', () => {
  it('cancels the pending run when stopped before the first sync', () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const schedule = vi.fn(() => ({ id: 'scheduled-sync' }) as unknown as NodeJS.Timeout);
    const cancel = vi.fn();
    const scheduler = createPeriodicSyncScheduler(run, schedule, cancel);

    scheduler.start(60_000);
    scheduler.stop();

    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(cancel).toHaveBeenCalledWith({ id: 'scheduled-sync' });
    expect(run).not.toHaveBeenCalled();
  });
});
