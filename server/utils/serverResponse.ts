import { safeJsonParse } from './json';

const MAX_SERVER_TAGS = 12;

const labelFromTag = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    const label = String(value).trim();
    return label || null;
  }

  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  for (const key of ['label', 'name', 'title', 'value', 'tag']) {
    const label = labelFromTag(record[key]);
    if (label) return label;
  }
  return null;
};

export const normalizeServerTags = (value: unknown): string[] => {
  const parsed = typeof value === 'string'
    ? safeJsonParse<unknown>(value, value)
    : value;
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'string'
      ? parsed.split(/[,，\s]+/)
      : [parsed];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of values) {
    const label = labelFromTag(item);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    tags.push(label);
    if (tags.length >= MAX_SERVER_TAGS) break;
  }
  return tags;
};

export const normalizeServerRecord = <T extends Record<string, unknown>>(server: T): T & { tags: string[] } => ({
  ...server,
  tags: normalizeServerTags(server.tags),
});

export const normalizeServerRecords = <T extends Record<string, unknown>>(servers: T[]): Array<T & { tags: string[] }> => (
  servers.map(normalizeServerRecord)
);
