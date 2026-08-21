import { toast } from '../hooks/use-toast';
import { staticT } from '../store/uiStore';

export const ERROR_NOTIFICATION_DEDUPE_MS = 3_500;

const recentNotifications = new Map<string, number>();

type ErrorRecord = Record<string, unknown>;

export type ErrorNotificationOptions = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

function asRecord(value: unknown): ErrorRecord | undefined {
  return value !== null && typeof value === 'object' ? value as ErrorRecord : undefined;
}

function extractStatus(error: unknown): number | undefined {
  const record = asRecord(error);
  const response = asRecord(record?.response);
  const rawStatus = record?.status ?? response?.status;
  return typeof rawStatus === 'number' && Number.isFinite(rawStatus) ? rawStatus : undefined;
}

function extractCode(error: unknown): string | undefined {
  const record = asRecord(error);
  const data = asRecord(record?.data);
  const nestedError = asRecord(data?.error);
  const rawCode = record?.code ?? nestedError?.code ?? data?.code;
  return typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : undefined;
}

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error.trim();

  const record = asRecord(error);
  const data = asRecord(record?.data);
  const nestedError = asRecord(data?.error);
  const candidates = [
    record?.message,
    nestedError?.message,
    data?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return staticT('common.error');
}

function isSessionError(error: unknown): boolean {
  return extractStatus(error) === 401 || extractCode(error) === 'SESSION_EXPIRED';
}

function pruneExpiredNotifications(now: number): void {
  for (const [key, createdAt] of recentNotifications) {
    if (now - createdAt >= ERROR_NOTIFICATION_DEDUPE_MS) recentNotifications.delete(key);
  }
}

export function notifyError(error: unknown, options: ErrorNotificationOptions = {}): boolean {
  if (isSessionError(error)) return false;

  const title = options.title ?? staticT('common.sys_hint');
  const description = options.description?.trim() || extractMessage(error);
  if (!description) return false;

  const now = Date.now();
  pruneExpiredNotifications(now);
  const key = `${title}\u0000${description}`;
  const previous = recentNotifications.get(key);
  if (previous !== undefined && now - previous < ERROR_NOTIFICATION_DEDUPE_MS) return false;

  recentNotifications.set(key, now);
  toast({
    title,
    description,
    variant: options.variant ?? 'destructive',
  });
  return true;
}

export function resetErrorNotificationDedupeForTests(): void {
  recentNotifications.clear();
}
