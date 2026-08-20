const SECONDS_TIMESTAMP_LIMIT = 1_000_000_000_000;

const normalizeTimestamp = (value: number): number => (
  Math.abs(value) < SECONDS_TIMESTAMP_LIMIT ? value * 1000 : value
);

export const parseLogDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const date = new Date(normalizeTimestamp(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  const timestamp = /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
  if (timestamp !== null && Number.isFinite(timestamp)) {
    const date = new Date(normalizeTimestamp(timestamp));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatLogTime = (value: unknown): string => {
  const date = parseLogDate(value);
  return date ? date.toLocaleString('zh-CN') : '--';
};

export const formatLogTimestamp = (value: unknown): number | '--' => (
  parseLogDate(value)?.getTime() ?? '--'
);
