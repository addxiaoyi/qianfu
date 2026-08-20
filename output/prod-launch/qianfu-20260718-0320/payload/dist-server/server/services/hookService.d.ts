import { EventEmitter } from 'events';
/**
 * Hook Service based on EventEmitter
 * Allows for decoupled event-driven architecture and plugin support
 */
declare class HookService extends EventEmitter {
    private static instance;
    private constructor();
    static getInstance(): HookService;
    /**
     * Register a hook listener
     */
    register(event: MotiaHook, listener: (...args: any[]) => void | Promise<void>): void;
    /**
     * Emit an event synchronously (fire and forget for listeners)
     */
    trigger(event: MotiaHook, ...args: any[]): void;
    /**
     * Emit an event and wait for all listeners to complete (useful for data processing)
     */
    triggerAsync(event: MotiaHook, ...args: any[]): Promise<void>;
    getListenerStats(): Record<string, number>;
}
/**
 * Standard Hook Names for MotiaCraft
 */
export declare enum MotiaHook {
    SERVER_CREATED = "server:created",
    SERVER_UPDATED = "server:updated",
    SERVER_DELETED = "server:deleted",
    SERVER_APPROVED = "server:approved",
    SERVER_REJECTED = "server:rejected",
    USER_REGISTERED = "user:registered",
    USER_LOGIN = "user:login",
    USER_UPDATED = "user:updated",
    PAGE_PUBLISHED = "page:published",
    PAGE_UPDATED = "page:updated",
    CACHE_CLEARED = "system:cache_cleared",
    CRON_TICK = "system:cron_tick",
    API_RESPONSE_PRE_SEND = "api:response:pre_send",
    CORE_INIT = "core:init"
}
export declare const hookService: HookService;
export {};
//# sourceMappingURL=hookService.d.ts.map