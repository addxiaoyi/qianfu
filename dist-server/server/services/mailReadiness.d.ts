type MailRuntimeState = {
    configured: boolean;
    enabled: boolean;
};
type MailReadiness = {
    required: boolean;
    ready: boolean;
    reason?: string;
};
export declare function evaluateMailReadiness(runtime: MailRuntimeState, nodeEnv?: string | undefined): MailReadiness;
export {};
//# sourceMappingURL=mailReadiness.d.ts.map