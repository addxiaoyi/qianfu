function cleanPermissionList(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value
            .filter((permission) => typeof permission === 'string')
            .map((permission) => permission.trim())
            .filter(Boolean))];
}
export function normalizeApiKeyPermissions(input) {
    if (Array.isArray(input))
        return cleanPermissionList(input);
    if (typeof input !== 'string')
        return [];
    const value = input.trim();
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'string')
            return parsed.trim() ? [parsed.trim()] : [];
        return cleanPermissionList(parsed);
    }
    catch {
        const looksLikeJson = /^[\[{\"]/.test(value);
        return looksLikeJson ? [] : [value];
    }
}
//# sourceMappingURL=apiKeyPermissions.js.map