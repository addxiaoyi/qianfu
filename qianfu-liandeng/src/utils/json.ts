/**
 * Safely parse JSON string with fallback value for frontend components.
 */
export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return (() => { try { return JSON.parse(input); } catch { return null; } })() as T;
  } catch (error) {
    console.warn('[JSON] Frontend failed to parse JSON safely:', error);
    return fallback;
  }
}
