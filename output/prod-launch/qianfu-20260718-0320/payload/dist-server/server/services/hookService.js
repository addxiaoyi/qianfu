import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
/**
 * Hook Service based on EventEmitter
 * Allows for decoupled event-driven architecture and plugin support
 */
class HookService extends EventEmitter {
    static instance;
    constructor() {
        super();
        // Increase limit for hooks if needed
        this.setMaxListeners(50);
    }
    static getInstance() {
        if (!HookService.instance) {
            HookService.instance = new HookService();
        }
        return HookService.instance;
    }
    /**
     * Register a hook listener
     */
    register(event, listener) {
        this.on(event, async (...args) => {
            try {
                await listener(...args);
            }
            catch (error) {
                logger.error(`[HookService] Error in hook "${event}":`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
        logger.debug(`[HookService] Registered listener for "${event}"`);
    }
    /**
     * Emit an event synchronously (fire and forget for listeners)
     */
    trigger(event, ...args) {
        logger.debug(`[HookService] Triggering hook "${event}"`);
        this.emit(event, ...args);
    }
    /**
     * Emit an event and wait for all listeners to complete (useful for data processing)
     */
    async triggerAsync(event, ...args) {
        logger.debug(`[HookService] Triggering async hook "${event}"`);
        const listeners = this.listeners(event);
        const promises = listeners.map(async (listener) => {
            try {
                await listener(...args);
            }
            catch (error) {
                logger.error(`[HookService] Async error in hook "${event}":`, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
        await Promise.all(promises);
    }
    getListenerStats() {
        const stats = {};
        return stats;
    }
}
/**
 * Standard Hook Names for MotiaCraft
 */
export var MotiaHook;
(function (MotiaHook) {
    // Server Events
    MotiaHook["SERVER_CREATED"] = "server:created";
    MotiaHook["SERVER_UPDATED"] = "server:updated";
    MotiaHook["SERVER_DELETED"] = "server:deleted";
    MotiaHook["SERVER_APPROVED"] = "server:approved";
    MotiaHook["SERVER_REJECTED"] = "server:rejected";
    // User Events
    MotiaHook["USER_REGISTERED"] = "user:registered";
    MotiaHook["USER_LOGIN"] = "user:login";
    MotiaHook["USER_UPDATED"] = "user:updated";
    // CMS Events
    MotiaHook["PAGE_PUBLISHED"] = "page:published";
    MotiaHook["PAGE_UPDATED"] = "page:updated";
    // System Events
    MotiaHook["CACHE_CLEARED"] = "system:cache_cleared";
    MotiaHook["CRON_TICK"] = "system:cron_tick";
    // Extension Points
    MotiaHook["API_RESPONSE_PRE_SEND"] = "api:response:pre_send";
    MotiaHook["CORE_INIT"] = "core:init";
})(MotiaHook || (MotiaHook = {}));
export const hookService = HookService.getInstance();
//# sourceMappingURL=hookService.js.map