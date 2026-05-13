import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

/**
 * Hook Service based on EventEmitter
 * Allows for decoupled event-driven architecture and plugin support
 */
class HookService extends EventEmitter {
  private static instance: HookService;

  private constructor() {
    super();
    // Increase limit for hooks if needed
    this.setMaxListeners(50);
  }

  public static getInstance(): HookService {
    if (!HookService.instance) {
      HookService.instance = new HookService();
    }
    return HookService.instance;
  }

  /**
   * Register a hook listener
   */
  public register(event: MotiaHook, listener: (...args: any[]) => void | Promise<void>) {
    this.on(event, async (...args: any[]) => {
      try {
        await listener(...args);
      } catch (error) {
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
  public trigger(event: MotiaHook, ...args: any[]) {
    logger.debug(`[HookService] Triggering hook "${event}"`);
    this.emit(event, ...args);
  }

  /**
   * Emit an event and wait for all listeners to complete (useful for data processing)
   */
  public async triggerAsync(event: MotiaHook, ...args: any[]): Promise<void> {
    logger.debug(`[HookService] Triggering async hook "${event}"`);
    const listeners = this.listeners(event);
    
    const promises = listeners.map(async (listener) => {
      try {
        await (listener as Function)(...args);
      } catch (error) {
        logger.error(`[HookService] Async error in hook "${event}":`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(promises);
  }
}

/**
 * Standard Hook Names for MotiaCraft
 */
export enum MotiaHook {
  // Server Events
  SERVER_CREATED = 'server:created',
  SERVER_UPDATED = 'server:updated',
  SERVER_DELETED = 'server:deleted',
  SERVER_APPROVED = 'server:approved',
  SERVER_REJECTED = 'server:rejected',
  
  // User Events
  USER_REGISTERED = 'user:registered',
  USER_LOGIN = 'user:login',
  USER_UPDATED = 'user:updated',
  
  // CMS Events
  PAGE_PUBLISHED = 'page:published',
  PAGE_UPDATED = 'page:updated',
  
  // System Events
  CACHE_CLEARED = 'system:cache_cleared',
  CRON_TICK = 'system:cron_tick',
  
  // Extension Points
  API_RESPONSE_PRE_SEND = 'api:response:pre_send',
  CORE_INIT = 'core:init'
}

export const hookService = HookService.getInstance();
