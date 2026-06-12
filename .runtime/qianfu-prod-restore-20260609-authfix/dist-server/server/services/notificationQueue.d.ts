export interface NotificationTask {
    type: 'VERIFICATION_EMAIL' | 'TICKET_NOTIFICATION' | 'RESET_PASSWORD_EMAIL';
    payload: any;
    userId?: string | number;
    retryCount?: number;
    id?: string;
}
export declare class NotificationQueue {
    private isProcessing;
    private interval;
    /**
     * Push a notification task to the queue
     */
    push(task: NotificationTask): Promise<void>;
    /**
     * Start the queue worker
     */
    startWorker(intervalMs?: number): void;
    /**
     * Process the next task in the queue
     */
    private processNext;
    /**
     * Route the task to the correct handler
     */
    private handleTask;
    stopWorker(): void;
}
export declare const notificationQueue: NotificationQueue;
export default notificationQueue;
//# sourceMappingURL=notificationQueue.d.ts.map