export interface ReconciliationResult {
    date: string;
    totalOrders: number;
    successfulOrders: number;
    failedOrders: number;
    totalAmount: string;
    successfulAmount: string;
    exceptions: ExceptionOrder[];
}
export interface ExceptionOrder {
    orderId: string;
    outTradeNo: string;
    type: 'MISSING' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH' | 'TIMEOUT';
    details: string;
}
export interface DailySummary {
    date: string;
    income: number;
    expense: number;
    netIncome: number;
    orderCount: number;
    successRate: string;
}
export declare class ReconciliationJob {
    private static instance;
    private checkInterval;
    private constructor();
    static getInstance(): ReconciliationJob;
    performDailyReconciliation(): Promise<ReconciliationResult>;
    private checkTimeoutOrders;
    performExceptionCheck(): Promise<ExceptionOrder[]>;
    getDailySummary(date: string): Promise<DailySummary | null>;
    getExceptions(startDate: string, endDate: string): Promise<ExceptionOrder[]>;
    private saveReconciliationRecord;
    private shouldRunDailyReconciliation;
    private shouldRunExceptionCheck;
    start(): void;
    stop(): void;
}
export declare const reconciliationJob: ReconciliationJob;
//# sourceMappingURL=ReconciliationJob.d.ts.map