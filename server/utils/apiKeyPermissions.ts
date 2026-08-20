function cleanPermissionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value
    .filter((permission): permission is string => typeof permission === 'string')
    .map((permission) => permission.trim())
    .filter(Boolean))];
}

export function normalizeApiKeyPermissions(input: unknown): string[] {
  if (Array.isArray(input)) return cleanPermissionList(input);
  if (typeof input !== 'string') return [];

  const value = input.trim();
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'string') return parsed.trim() ? [parsed.trim()] : [];
    return cleanPermissionList(parsed);
  } catch {
    const looksLikeJson = /^[\[{\"]/.test(value);
    return looksLikeJson ? [] : [value];
  }
}
