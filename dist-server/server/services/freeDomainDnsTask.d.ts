import { type DnsRecordInput } from './freeDomainDnsPolicy';
export type DnsTaskExecution = {
    id: number;
    action: 'APPLY' | 'DELETE';
    domain: string;
    target: string;
    port: number;
    ttl: number;
    records: Array<DnsRecordInput & {
        providerRecordId?: string | null;
    }>;
};
type ProviderRecord = DnsRecordInput & {
    idempotencyKey: string;
};
export type DnsTaskProvider = {
    ensureRecord(input: ProviderRecord): Promise<{
        recordId: string;
    }>;
    deleteRecord(input: {
        recordId: string;
    }): Promise<void>;
};
export type DnsTaskRepository = {
    saveRecord(taskId: number, input: DnsRecordInput, providerRecordId: string): Promise<void>;
    markCompleted(taskId: number): Promise<void>;
    markFailed(taskId: number, message: string, retryAt: Date): Promise<void>;
};
export declare function executeDnsTask(task: DnsTaskExecution, dependencies: {
    provider: DnsTaskProvider;
    repository: DnsTaskRepository;
}): Promise<void>;
export {};
//# sourceMappingURL=freeDomainDnsTask.d.ts.map