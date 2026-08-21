import type { Announcement } from '@/api/announcementApi';
import type { ServerListItem } from '@/types/server';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

export function normalizeNewsResponse(value: unknown): Announcement[] {
  if (Array.isArray(value)) return value.filter(isRecord) as Announcement[];
  if (!isRecord(value)) return [];

  for (const key of ['data', 'items', 'list', 'records', 'announcements']) {
    if (Array.isArray(value[key])) return value[key].filter(isRecord) as Announcement[];
  }
  return [];
}

export function normalizeServerListResponse(value: unknown): ServerListItem[] {
  if (Array.isArray(value)) return value.filter(isRecord) as ServerListItem[];
  if (!isRecord(value)) return [];

  for (const key of ['data', 'items', 'list', 'records', 'servers']) {
    if (Array.isArray(value[key])) return value[key].filter(isRecord) as ServerListItem[];
  }
  return [];
}

export type AuditStats = {
  period: string;
  totalEvents: number;
  todayEvents: number;
  eventsByType: Record<string, number>;
  topUsers: Array<{
    user_id: number;
    username?: string | null;
    role?: string | null;
    event_count: number;
  }>;
};

export type AuditPoint = {
  time: string;
  count: number;
};

export function normalizeAuditStatsResponse(value: unknown): AuditStats {
  const source = isRecord(value) ? value : {};
  const eventsByType = isRecord(source.eventsByType)
    ? Object.fromEntries(Object.entries(source.eventsByType).filter(([, count]) => typeof count === 'number'))
    : {};
  const topUsers = Array.isArray(source.topUsers)
    ? source.topUsers.filter(isRecord)
    : [];

  return {
    period: typeof source.period === 'string' ? source.period : '7d',
    totalEvents: typeof source.totalEvents === 'number' ? source.totalEvents : 0,
    todayEvents: typeof source.todayEvents === 'number' ? source.todayEvents : 0,
    eventsByType,
    topUsers: topUsers as AuditStats['topUsers'],
  };
}

export function normalizeAuditTimeseriesResponse(value: unknown): AuditPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .filter((item): item is AuditPoint => typeof item.time === 'string' && typeof item.count === 'number');
}
