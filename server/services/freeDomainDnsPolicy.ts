import net from 'node:net';

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

const PREFIX_MAX_LENGTH = 63;

function normalizeSuffix(suffix: string): string {
  return suffix.trim().toLowerCase().replace(/\.$/, '');
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().toLowerCase();
}

export function validateFreeDomainRequest(
  suffix: FreeDomainSuffixPolicy,
  prefix: string,
): void {
  if (!suffix.enabled) {
    throw new Error('后缀已停用');
  }

  const normalizedPrefix = normalizePrefix(prefix);
  if (!normalizedPrefix || normalizedPrefix.length > PREFIX_MAX_LENGTH) {
    throw new Error('前缀格式不正确');
  }

  const reserved = new Set(suffix.reservedWords.map(normalizePrefix));
  if (reserved.has(normalizedPrefix)) {
    throw new Error('前缀不可用');
  }

  let pattern: RegExp;
  try {
    pattern = new RegExp(suffix.prefixPattern);
  } catch (error) {
    throw new Error(`后缀规则配置无效: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!pattern.test(normalizedPrefix)) {
    throw new Error('前缀格式不正确');
  }
}

export function normalizeFreeDomainRequest(
  request: FreeDomainRequest,
): NormalizedFreeDomainRequest {
  validateFreeDomainRequest(request.suffix, request.prefix);
  const prefix = normalizePrefix(request.prefix);
  const suffix = normalizeSuffix(request.suffix.suffix);
  return { prefix, domain: `${prefix}.${suffix}` };
}

function isIpAddress(target: string): boolean {
  return net.isIP(target) !== 0;
}

export function buildDnsRecordInputs(input: {
  domain: string;
  target: string;
  port: number;
  ttl: number;
}): DnsRecordInput[] {
  const target = input.target.trim().replace(/\.$/, '');
  const type = net.isIP(target) === 4 ? 'A' : net.isIP(target) === 6 ? 'AAAA' : 'CNAME';
  const records: DnsRecordInput[] = [{
    type,
    name: input.domain,
    content: target,
    ttl: input.ttl,
  }];

  if (input.port !== 25565) {
    records.push({
      type: 'SRV',
      name: `_minecraft._tcp.${input.domain}`,
      content: `0 0 ${input.port} ${input.domain}`,
      ttl: input.ttl,
    });
  }

  return records;
}

export function isDnsTarget(value: string): boolean {
  return isIpAddress(value.trim()) || /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value.trim());
}
