export const SERVER_FACET_KIND = {
    TAG: 'TAG',
    VERSION: 'VERSION',
    NETWORK_ENV: 'NETWORK_ENV',
};
const MAX_FACET_VALUE_LENGTH = 96;
export function normalizeFacetValue(value) {
    return value.trim().toLowerCase();
}
export function parseFacetValues(value) {
    if (Array.isArray(value)) {
        return value.map(String).map(item => item.trim()).filter(Boolean);
    }
    if (typeof value !== 'string' || !value.trim())
        return [];
    const source = value.trim();
    try {
        const parsed = JSON.parse(source);
        if (Array.isArray(parsed)) {
            return parsed.map(String).map(item => item.trim()).filter(Boolean);
        }
    }
    catch {
        // Legacy non-JSON values are handled by the delimiter fallback below.
    }
    return source
        .split(/[\s,，;；]+/u)
        .map(item => item.trim())
        .filter(Boolean);
}
export function buildServerFacets(serverId, input) {
    const groups = [
        [SERVER_FACET_KIND.TAG, input.tags],
        [SERVER_FACET_KIND.VERSION, input.supportedVersions],
        [SERVER_FACET_KIND.NETWORK_ENV, input.networkEnv],
    ];
    const seen = new Set();
    const records = [];
    for (const [kind, rawValue] of groups) {
        for (const rawItem of parseFacetValues(rawValue)) {
            const value = rawItem.slice(0, MAX_FACET_VALUE_LENGTH);
            const normalizedValue = normalizeFacetValue(value);
            if (!normalizedValue)
                continue;
            const key = `${kind}\u0000${normalizedValue}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            records.push({
                server_id: serverId,
                kind,
                value,
                normalized_value: normalizedValue,
            });
        }
    }
    return records;
}
export async function replaceServerFacets(client, serverId, input) {
    const records = buildServerFacets(serverId, input);
    await client.serverFacet.deleteMany({ where: { server_id: serverId } });
    if (records.length > 0) {
        await client.serverFacet.createMany({ data: records });
    }
}
//# sourceMappingURL=serverFacetService.js.map