import type { Prisma } from '../db';
type DomainFields = {
    free_domain_enabled?: boolean;
    free_domain_suffix_id?: number;
    free_domain_prefix?: string;
};
export declare function createServerDomainApplication(tx: Prisma.TransactionClient, input: DomainFields, values: {
    serverId: number;
    userId: number;
    target: string;
    port?: number;
}): Promise<void>;
export declare function enqueueDnsApplyTask(tx: Prisma.TransactionClient, serverId: number): Promise<void>;
export declare function updateServerDomainApplication(tx: Prisma.TransactionClient, input: DomainFields, values: {
    serverId: number;
    userId: number;
    target: string;
    port?: number;
}): Promise<void>;
export declare function enqueueDnsDeleteTask(serverId: number): Promise<void>;
export declare function processFreeDomainTasks(limit?: number): Promise<number>;
export declare function listFreeDomainDnsTasks(limit?: number): Promise<any>;
export declare function desiredDnsRecords(domain: {
    domain: string;
    target: string;
    port: number;
    ttl: number;
}): import("./freeDomainDnsPolicy").DnsRecordInput[];
export {};
//# sourceMappingURL=freeDomainDnsService.d.ts.map