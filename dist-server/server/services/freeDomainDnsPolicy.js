import net from 'node:net';
const PREFIX_MAX_LENGTH = 63;
function normalizeSuffix(suffix) {
    return suffix.trim().toLowerCase().replace(/\.$/, '');
}
function normalizePrefix(prefix) {
    return prefix.trim().toLowerCase();
}
export function validateFreeDomainRequest(suffix, prefix) {
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
    let pattern;
    try {
        pattern = new RegExp(suffix.prefixPattern);
    }
    catch (error) {
        throw new Error(`后缀规则配置无效: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!pattern.test(normalizedPrefix)) {
        throw new Error('前缀格式不正确');
    }
}
export function normalizeFreeDomainRequest(request) {
    validateFreeDomainRequest(request.suffix, request.prefix);
    const prefix = normalizePrefix(request.prefix);
    const suffix = normalizeSuffix(request.suffix.suffix);
    return { prefix, domain: `${prefix}.${suffix}` };
}
function isIpAddress(target) {
    return net.isIP(target) !== 0;
}
export function buildDnsRecordInputs(input) {
    const target = input.target.trim().replace(/\.$/, '');
    const type = net.isIP(target) === 4 ? 'A' : net.isIP(target) === 6 ? 'AAAA' : 'CNAME';
    const records = [{
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
export function isDnsTarget(value) {
    return isIpAddress(value.trim()) || /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value.trim());
}
//# sourceMappingURL=freeDomainDnsPolicy.js.map