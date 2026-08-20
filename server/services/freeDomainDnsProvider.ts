export type DnsProviderName = 'CLOUDFLARE' | 'ALIYUN';

import { deleteConfig, getConfig, setConfig } from './configService';

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

export function cloudflareOauthKey(suffixId: number): string {
  return `FREE_DOMAIN_DNS_SUFFIX_${suffixId}_CLOUDFLARE_OAUTH_TOKEN`;
}

type DnsRecordInput = {
  type: 'A' | 'AAAA' | 'CNAME' | 'SRV';
  name: string;
  content: string;
  ttl: number;
  idempotencyKey: string;
};

export type DnsProvider = {
  ensureRecord(input: DnsRecordInput): Promise<{ recordId: string }>;
  deleteRecord(input: { recordId: string }): Promise<void>;
};

export function getDnsProviderConfig(
  provider: DnsProviderName,
  environment: NodeJS.ProcessEnv = process.env,
): DnsProviderConfig {
  if (provider === 'CLOUDFLARE') {
    const token = environment.CLOUDFLARE_API_TOKEN?.trim();
    const zoneId = environment.CLOUDFLARE_ZONE_ID?.trim();
    return {
      provider,
      configured: Boolean(token && zoneId),
      zoneId,
      token,
    };
  }

  const accessKeyId = environment.ALIYUN_ACCESS_KEY_ID?.trim();
  const accessKeySecret = environment.ALIYUN_ACCESS_KEY_SECRET?.trim();
  return {
    provider,
    configured: Boolean(accessKeyId && accessKeySecret),
    zoneId: environment.ALIYUN_REGION_ID?.trim(),
    accessKeyId,
    accessKeySecret,
    regionId: environment.ALIYUN_REGION_ID?.trim(),
  };
}

type ProviderConfigKeys =
  | { token: string; zoneId: string }
  | { accessKeyId: string; accessKeySecret: string; regionId: string };

export function providerConfigKeys(provider: DnsProviderName, suffixId: number): ProviderConfigKeys {
  const prefix = `FREE_DOMAIN_DNS_SUFFIX_${suffixId}`;
  return provider === 'CLOUDFLARE'
    ? { token: `${prefix}_CLOUDFLARE_API_TOKEN`, zoneId: `${prefix}_CLOUDFLARE_ZONE_ID` }
    : {
        accessKeyId: `${prefix}_ALIYUN_ACCESS_KEY_ID`,
        accessKeySecret: `${prefix}_ALIYUN_ACCESS_KEY_SECRET`,
        regionId: `${prefix}_ALIYUN_REGION_ID`,
      };
}

export async function getStoredDnsProviderConfig(provider: DnsProviderName, suffixId: number): Promise<DnsProviderConfig> {
  const keys = providerConfigKeys(provider, suffixId);
  if (provider === 'CLOUDFLARE') {
    const cloudflareKeys = keys as Extract<ProviderConfigKeys, { token: string }>;
    const [oauthToken, token, zoneId] = await Promise.all([getConfig(cloudflareOauthKey(suffixId), true), getConfig(cloudflareKeys.token, true), getConfig(cloudflareKeys.zoneId, true)]);
    return { provider, configured: Boolean((oauthToken || token) && zoneId), token: (oauthToken || token) ?? undefined, zoneId: zoneId ?? undefined };
  }
  const aliyunKeys = keys as Extract<ProviderConfigKeys, { accessKeyId: string }>;
  const [accessKeyId, accessKeySecret, regionId] = await Promise.all([
    getConfig(aliyunKeys.accessKeyId, true),
    getConfig(aliyunKeys.accessKeySecret, true),
    getConfig(aliyunKeys.regionId, true),
  ]);
  return {
    provider,
    configured: Boolean(accessKeyId && accessKeySecret),
    accessKeyId: accessKeyId ?? undefined,
    accessKeySecret: accessKeySecret ?? undefined,
    regionId: regionId ?? undefined,
    zoneId: regionId ?? undefined,
  };
}

export async function revokeCloudflareOauth(suffixId: number): Promise<void> {
  await deleteConfig(cloudflareOauthKey(suffixId));
}

export async function saveCloudflareOauthToken(suffixId: number, token: string): Promise<void> {
  await setConfig(cloudflareOauthKey(suffixId), token, true, 'Cloudflare OAuth access token');
}

export async function isCloudflareOauthConfigured(suffixId: number): Promise<boolean> {
  return Boolean(await getConfig(cloudflareOauthKey(suffixId), true));
}

export async function saveStoredDnsProviderConfig(
  provider: DnsProviderName,
  suffixId: number,
  input: DnsProviderCredentialInput,
): Promise<void> {
  const keys = providerConfigKeys(provider, suffixId);
  const updates = provider === 'CLOUDFLARE'
    ? (() => {
        const cloudflareKeys = keys as Extract<ProviderConfigKeys, { token: string }>;
        return [[cloudflareKeys.token, input.cloudflareApiToken, 'Cloudflare API token'], [cloudflareKeys.zoneId, input.cloudflareZoneId, 'Cloudflare zone ID']] as const;
      })()
    : (() => {
        const aliyunKeys = keys as Extract<ProviderConfigKeys, { accessKeyId: string }>;
        return [[aliyunKeys.accessKeyId, input.aliyunAccessKeyId, 'Alibaba Cloud DNS AccessKey ID'], [aliyunKeys.accessKeySecret, input.aliyunAccessKeySecret, 'Alibaba Cloud DNS AccessKey secret'], [aliyunKeys.regionId, input.aliyunRegionId, 'Alibaba Cloud DNS region ID']] as const;
      })();
  for (const [key, value, description] of updates) {
    const normalized = value?.trim();
    if (normalized) await setConfig(key, normalized, true, description);
  }
}

export function maskDnsProviderConfig(config: DnsProviderConfig): {
  provider: DnsProviderName;
  credentialConfigured: boolean;
} {
  return {
    provider: config.provider,
    credentialConfigured: config.configured,
  };
}

const REQUEST_TIMEOUT_MS = 10_000;

async function requestJson(url: string, init: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`DNS provider HTTP ${response.status}: ${JSON.stringify(body).slice(0, 400)}`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

async function aliyunRpc(
  action: string,
  params: Record<string, string>,
  config: DnsProviderConfig,
): Promise<any> {
  const query: Record<string, string> = {
    AccessKeyId: config.accessKeyId!,
    Action: action,
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2015-01-09',
    ...params,
  };
  const canonical = Object.keys(query)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(query[key])}`)
    .join('&');
  const stringToSign = `GET&%2F&${percentEncode(canonical)}`;
  query.Signature = createHmac('sha1', `${config.accessKeySecret!}&`).update(stringToSign).digest('base64');
  const url = `https://${process.env.ALIYUN_DNS_ENDPOINT || 'alidns.aliyuncs.com'}/?${Object.keys(query)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(query[key])}`)
    .join('&')}`;
  return requestJson(url, { method: 'GET' });
}

function splitRecordName(name: string, zone: string): { rr: string; domain: string } {
  const normalizedName = name.replace(/\.$/, '').toLowerCase();
  const normalizedZone = zone.replace(/\.$/, '').toLowerCase();
  const suffix = `.${normalizedZone}`;
  if (!normalizedName.endsWith(suffix)) return { rr: normalizedName, domain: normalizedZone };
  const rr = normalizedName.slice(0, -suffix.length) || '@';
  return { rr, domain: normalizedZone };
}

function createAliyunProvider(zone: string, config: DnsProviderConfig): DnsProvider {
  return {
    async ensureRecord(input) {
      const { rr, domain } = splitRecordName(input.name, zone);
      const type = input.type === 'SRV' ? 'SRV' : input.type;
      const list = await aliyunRpc('DescribeDomainRecords', {
        DomainName: domain,
        RRKeyWord: rr,
        TypeKeyWord: type,
      }, config);
      const existing = (list?.DomainRecords?.Record ?? []).find((record: any) => (
        String(record.RR).toLowerCase() === rr.toLowerCase() &&
        String(record.Type).toUpperCase() === type &&
        String(record.Value).replace(/\.$/, '').toLowerCase() === input.content.replace(/\.$/, '').toLowerCase()
      ));
      if (existing?.RecordId) return { recordId: String(existing.RecordId) };
      const created = await aliyunRpc('AddDomainRecord', {
        DomainName: domain,
        RR: rr,
        Type: type,
        Value: input.content,
        TTL: String(input.ttl),
      }, config);
      if (!created?.RecordId) throw new Error('Alibaba Cloud DNS did not return a record ID');
      return { recordId: String(created.RecordId) };
    },
    async deleteRecord(input) {
      await aliyunRpc('DeleteDomainRecord', { RecordId: input.recordId }, config);
    },
  };
}

function createCloudflareProvider(zone: string, config: DnsProviderConfig): DnsProvider {
  const base = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(config.zoneId!)}/dns_records`;
  const headers = { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' };
  return {
    async ensureRecord(input) {
      const query = new URLSearchParams({ type: input.type, name: input.name, content: input.content });
      const existing = await requestJson(`${base}?${query}`, { headers });
      const row = existing?.result?.[0];
      if (row?.id) return { recordId: String(row.id) };
      const body = await requestJson(base, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: input.type, name: input.name, content: input.content, ttl: input.ttl, proxied: false }),
      });
      const id = body?.result?.id;
      if (!id) throw new Error('Cloudflare did not return a record ID');
      return { recordId: String(id) };
    },
    async deleteRecord(input) {
      await requestJson(`${base}/${encodeURIComponent(input.recordId)}`, { method: 'DELETE', headers });
    },
  };
}

export async function getDnsProvider(provider: DnsProviderName, zone: string, suffixId?: number): Promise<DnsProvider> {
  const config = suffixId ? await getStoredDnsProviderConfig(provider, suffixId) : getDnsProviderConfig(provider);
  if (!config.configured) throw new Error(`${provider} credentials are not configured for ${zone}`);
  if (provider === 'CLOUDFLARE') return createCloudflareProvider(zone, config);
  return createAliyunProvider(zone, config);
}
import { createHmac, randomUUID } from 'node:crypto';
