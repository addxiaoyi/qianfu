import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('../../qianfu-liandeng/src/hooks/use-toast', () => ({
  toast: toastMock,
}));

vi.mock('../../qianfu-liandeng/src/store/uiStore', () => ({
  staticT: (key: string) => key,
}));

import {
  ERROR_NOTIFICATION_DEDUPE_MS,
  notifyError,
  resetErrorNotificationDedupeForTests,
} from '../../qianfu-liandeng/src/lib/error-notification';
import {
  queryClient,
  shouldRetryQuery,
} from '../../qianfu-liandeng/src/lib/query-client';

describe('frontend global loading and error policy', () => {
  beforeEach(() => {
    toastMock.mockReset();
    resetErrorNotificationDedupeForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('configures stable query defaults and selective retry', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(5 * 60 * 1_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
    expect(defaults.mutations?.retry).toBe(false);

    expect(shouldRetryQuery(0, new Error('network unavailable'))).toBe(true);
    expect(shouldRetryQuery(0, { status: 500 })).toBe(true);
    expect(shouldRetryQuery(0, { status: 408 })).toBe(true);
    expect(shouldRetryQuery(0, { response: { status: 429 } })).toBe(true);
    expect(shouldRetryQuery(0, { status: 400 })).toBe(false);
    expect(shouldRetryQuery(0, { status: 404 })).toBe(false);
    expect(shouldRetryQuery(1, { status: 503 })).toBe(false);
  });

  it('deduplicates repeated errors and suppresses session-expiry noise', () => {
    expect(notifyError(new Error('request failed'))).toBe(true);
    expect(notifyError(new Error('request failed'))).toBe(false);
    expect(toastMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ERROR_NOTIFICATION_DEDUPE_MS);
    expect(notifyError(new Error('request failed'))).toBe(true);
    expect(toastMock).toHaveBeenCalledTimes(2);

    expect(notifyError({ status: 401, message: 'session expired' })).toBe(false);
    expect(notifyError({ code: 'SESSION_EXPIRED', message: 'session expired' })).toBe(false);
    expect(toastMock).toHaveBeenCalledTimes(2);
  });

  it('mounts visible feedback and tracks actual async activity', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/main.tsx'), 'utf8');
    const appSource = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/App.tsx'), 'utf8');
    const progressSource = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/components/ui/GlobalProgress.tsx'), 'utf8');
    const toastSource = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/components/ui/ToastViewport.tsx'), 'utf8');
    const requestSource = readFileSync(resolve(process.cwd(), 'qianfu-liandeng/src/api/request.ts'), 'utf8');

    expect(mainSource).toContain("import { queryClient } from './lib/query-client'");
    expect(mainSource).not.toContain('new QueryClient()');
    expect(appSource).toContain('<ToastViewport />');
    expect(progressSource).toContain('useIsFetching');
    expect(progressSource).toContain('useIsMutating');
    expect(progressSource).toContain('query.state.data === undefined');
    expect(progressSource).toContain('showBackgroundProgress');
    expect(progressSource).toContain('role="progressbar"');
    expect(toastSource).toContain('aria-live="polite"');
    expect(toastSource).toContain("role={destructive ? 'alert' : 'status'}");
    expect(requestSource).toContain('notifyError(message');
    expect(requestSource).not.toContain("import { toast } from '@/hooks/use-toast'");
  });
});
