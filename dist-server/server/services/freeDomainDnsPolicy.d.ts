export type FreeDomainSuffixPolicy = {
    id: number;
    suffix: string;
    enabled: boolean;
    prefixPattern: string;
    reservedWords: string[];
    ttl: number;
    quotaPerUser: number;
};
export type FreeDomainRequest = {
    suffix: FreeDomainSuffixPolicy;
    prefix: string;
};
export type NormalizedFreeDomainRequest = {
    prefix: string;
    domain: string;
};
export type DnsRecordInput = {
    type: 'A' | 'AAAA' | 'CNAME' | 'SRV';
    name: string;
    content: string;
    ttl: number;
};
export declare function validateFreeDomainRequest(suffix: FreeDomainSuffixPolicy, prefix: string): void;
export declare function normalizeFreeDomainRequest(request: FreeDomainRequest): NormalizedFreeDomainRequest;
export declare function buildDnsRecordInputs(input: {
    domain: string;
    target: string;
    port: number;
    ttl: number;
}): DnsRecordInput[];
export declare function isDnsTarget(value: string): boolean;
//# sourceMappingURL=freeDomainDnsPolicy.d.ts.map