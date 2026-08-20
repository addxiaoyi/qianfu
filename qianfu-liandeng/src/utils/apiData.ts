export function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data as T[];
  if (Array.isArray(record.items)) return record.items as T[];
  if (Array.isArray(record.list)) return record.list as T[];
  if (Array.isArray(record.records)) return record.records as T[];
  if (Array.isArray(record.servers)) return record.servers as T[];
  if (Array.isArray(record.tickets)) return record.tickets as T[];
  if (Array.isArray(record.notifications)) return record.notifications as T[];

  return [];
}
