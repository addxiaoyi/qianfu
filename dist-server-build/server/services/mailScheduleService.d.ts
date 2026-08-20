export declare class MailScheduleService {
    private interval;
    private running;
    start(intervalMs?: number): void;
    stop(): void;
    tick(): Promise<void>;
}
export declare const mailScheduleService: MailScheduleService;
//# sourceMappingURL=mailScheduleService.d.ts.map