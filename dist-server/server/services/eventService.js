import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
class AppEventService extends EventEmitter {
    static instance;
    constructor() {
        super();
        this.setMaxListeners(20);
        this.setupErrorHandling();
    }
    static getInstance() {
        if (!AppEventService.instance) {
            AppEventService.instance = new AppEventService();
        }
        return AppEventService.instance;
    }
    setupErrorHandling() {
        this.on('error', (error) => {
            logger.error('[EventService] Unhandled Error:', error);
        });
    }
    /**
     * Typed emission of events for better maintainability
     */
    emitEvent(event, data) {
        logger.info(`[EventService] Emitting event: ${event}`, { data });
        return this.emit(event, data);
    }
}
export const eventService = AppEventService.getInstance();
// Event Types
export const EVENTS = {
    PAYMENT_SUCCESS: 'payment:success',
    SERVER_CREATED: 'server:created',
    USER_REGISTERED: 'user:registered',
    ROLE_UPDATED: 'role:updated',
};
//# sourceMappingURL=eventService.js.map