export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function stringifyJsonField(value: unknown, fallback = '[]'): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return fallback;
  }
}
