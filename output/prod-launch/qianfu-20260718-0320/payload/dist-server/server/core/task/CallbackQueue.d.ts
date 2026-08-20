export interface CallbackTask {
    id: string;
    url: string;
    payload: Record<string, any>;
    attempts: number;
    nextRetryTime: number;
    createdAt: number;
    lastError?: string;
}
export interface CallbackResult {
    success: boolean;
    response?: any;
    error?: string;
    shouldRetry: boolean;
}
export declare class CallbackQueue {
    private static instance;
    private isProcessing;
    private processorInterval;
    private queue;
    private retryQueue;
    private constructor();
    static getInstance(): CallbackQueue;
    addTask(url: string, payload: Record<string, any>): Promise<string>;
    retryTask(taskId: string): Promise<void>;
    private moveToDeadLetter;
    executeCallback(task: CallbackTask): Promise<CallbackResult>;
    private processQueue;
    private startProcessor;
    stopProcessor(): void;
    getQueueStats(): Promise<{
        pending: number;
        processing: number;
        deadLetter: number;
    }>;
}
export declare const callbackQueue: CallbackQueue;
//# sourceMappingURL=CallbackQueue.d.ts.map