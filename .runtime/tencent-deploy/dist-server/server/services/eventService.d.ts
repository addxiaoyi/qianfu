import { EventEmitter } from 'events';
declare class AppEventService extends EventEmitter {
    private static instance;
    private constructor();
    static getInstance(): AppEventService;
    private setupErrorHandling;
    /**
     * Typed emission of events for better maintainability
     */
    emitEvent(event: string, data: any): boolean;
}
export declare const eventService: AppEventService;
export declare const EVENTS: {
    PAYMENT_SUCCESS: string;
    SERVER_CREATED: string;
    USER_REGISTERED: string;
    ROLE_UPDATED: string;
};
export {};
//# sourceMappingURL=eventService.d.ts.map