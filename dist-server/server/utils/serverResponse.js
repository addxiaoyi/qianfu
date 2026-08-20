import { safeJsonParse } from './json.js';
const MAX_SERVER_TAGS = 12;
const labelFromTag = (value) => {
    if (typeof value === 'string' || typeof value === 'number') {
        const label = String(value).trim();
        return label || null;
    }
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    for (const key of ['label', 'name', 'title', 'value', 'tag']) {
        const label = labelFromTag(record[key]);
        if (label)
            return label;
    }
    return null;
};
export const normalizeServerTags = (value) => {
    const parsed = typeof value === 'string'
        ? safeJsonParse(value, value)
        : value;
    const values = Array.isArray(parsed)
        ? parsed
        : typeof parsed === 'string'
            ? parsed.split(/[,，\s]+/)
            : [parsed];
    const seen = new Set();
    const tags = [];
    for (const item of values) {
        const label = labelFromTag(item);
        if (!label || seen.has(label))
            continue;
        seen.add(label);
        tags.push(label);
        if (tags.length >= MAX_SERVER_TAGS)
            break;
    }
    return tags;
};
export const normalizeServerRecord = (server) => ({
    ...server,
    tags: normalizeServerTags(server.tags),
});
export const normalizeServerRecords = (servers) => (servers.map(normalizeServerRecord));
//# sourceMappingURL=serverResponse.js.map