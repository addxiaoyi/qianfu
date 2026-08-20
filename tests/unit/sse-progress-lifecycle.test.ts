import { describe, expect, it } from 'vitest';
import {
  MAX_PROGRESS_TASKS,
  isTerminalProgressEvent,
  pruneProgressEntries,
  type ProgressEntry,
} from '../../qianfu-liandeng/src/hooks/useSSE';

describe('SSE progress lifecycle', () => {
  it('recognizes completed, failed, and timed-out progress events', () => {
    expect(isTerminalProgressEvent({ done: true })).toBe(true);
    expect(isTerminalProgressEvent({ status: 'failed' })).toBe(true);
    expect(isTerminalProgressEvent({ status: 'timeout' })).toBe(true);
    expect(isTerminalProgressEvent({ status: 'running' })).toBe(false);
  });

  it('removes expired entries and bounds the number of retained tasks', () => {
    const entries = new Map<string, ProgressEntry>();
    for (let index = 0; index < MAX_PROGRESS_TASKS + 5; index += 1) {
      entries.set(`task-${index}`, {
        data: { status: 'running' },
        updatedAt: index,
        expiresAt: index === 0 ? 1 : 10_000,
      });
    }

    const pruned = pruneProgressEntries(entries, 100);

    expect(pruned.size).toBe(MAX_PROGRESS_TASKS);
    expect(pruned.has('task-0')).toBe(false);
    expect(pruned.has('task-1')).toBe(false);
    expect(pruned.has(`task-${MAX_PROGRESS_TASKS + 4}`)).toBe(true);
  });
});
