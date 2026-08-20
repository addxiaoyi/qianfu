export type DnsProviderName = 'CLOUDFLARE' | 'ALIYUN';
export type DnsProviderConfig = {
    provider: DnsProviderName;
    configured: boolean;
    zoneId?: string;
    token?: string;
    accessKeyId?: string;
    accessKeySecret?: string;
    regionId?: string;
};
export type DnsProviderCredentialInput = {
    cloudflareApiToken?: string;
    cloudflareZoneId?: string;
    aliyunAccessKeyId?: string;
    aliyunAccessKeySecret?: string;
    aliyunRegionId?: string;
};
export declare function cloudflareOauthKey(suffixId: number): string;
type DnsRecordInput = {
    type: 'A' | 'AAAA' | 'CNAME' | 'SRV';
    name: string;
    content: string;
    ttl: number;
    idempotencyKey: string;
};
export type DnsProvider = {
    ensureRecord(input: DnsRecordInput): Promise<{
        recordId: string;
    }>;
    deleteRecord(input: {
        recordId: string;
    }): Promise<void>;
};
export declare function getDnsProviderConfig(provider: DnsProviderName, environment?: NodeJS.ProcessEnv): DnsProviderConfig;
type ProviderConfigKeys = {
    token: string;
    zoneId: string;
} | {
    accessKeyId: string;
    accessKeySecret: string;
    regionId: string;
};
export declare function providerConfigKeys(provider: DnsProviderName, suffixId: number): ProviderConfigKeys;
export declare function getStoredDnsProviderConfig(provider: DnsProviderName, suffixId: number): Promise<DnsProviderConfig>;
export declare function revokeCloudflareOauth(suffixId: number): Promise<void>;
export declare function saveCloudflareOauthToken(suffixId: number, token: string): Promise<void>;
export declare function isCloudflareOauthConfigured(suffixId: number): Promise<boolean>;
export declare function saveStoredDnsProviderConfig(provider: DnsProviderName, suffixId: number, input: DnsProviderCredentialInput): Promise<void>;
export declare function maskDnsProviderConfig(config: DnsProviderConfig): {
    provider: DnsProviderName;
    credentialConfigured: boolean;
};
export declare function getDnsProvider(provider: DnsProviderName, zone: string, suffixId?: number): Promise<DnsProvider>;
export {};
//# sourceMappingURL=freeDomainDnsProvider.d.ts.map