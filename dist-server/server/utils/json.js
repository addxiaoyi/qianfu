import { logger } from './logger.js';
/**
 * Safely parse JSON string with fallback value and error logging.
 */
export function safeJsonParse(input, fallback) {
    if (!input)
        return fallback;
    try {
        return JSON.parse(input);
    }
    catch (error) {
        logger.warn('[JSON] Failed to parse JSON string safely:', error);
        return fallback;
    }
}
//# sourceMappingURL=json.js.map