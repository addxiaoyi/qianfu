import { logger } from './logger';

/**
 * Safely parse JSON string with fallback value and error logging.
 */
export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch (error) {
    logger.warn('[JSON] Failed to parse JSON string safely:', error);
    return fallback;
  }
}
