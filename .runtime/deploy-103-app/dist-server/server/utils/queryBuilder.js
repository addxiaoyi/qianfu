export function buildPagination(input) {
    const page = Number.isFinite(input.page) ? Math.max(1, input.page) : 1;
    const limit = Number.isFinite(input.limit) ? Math.max(1, input.limit) : 20;
    return {
        page,
        limit,
        skip: (page - 1) * limit,
        take: limit,
    };
}
export function normalizeKeyword(keyword) {
    if (!keyword)
        return undefined;
    const normalized = keyword.trim().replace(/\s+/g, ' ');
    return normalized.length > 0 ? normalized : undefined;
}
export function buildDateRange(input) {
    const range = {};
    if (input.startDate instanceof Date) {
        range.gte = input.startDate;
    }
    if (input.endDate instanceof Date) {
        range.lte = input.endDate;
    }
    return range.gte || range.lte ? range : undefined;
}
export function resolveSortField(inputField, allowedFields, fallbackField) {
    if (!inputField) {
        return fallbackField;
    }
    return allowedFields.includes(inputField)
        ? inputField
        : fallbackField;
}
export function resolveSortOrder(inputOrder, fallback = 'desc') {
    if (!inputOrder)
        return fallback;
    return inputOrder === 'asc' ? 'asc' : inputOrder === 'desc' ? 'desc' : fallback;
}
export function buildStringMatch(value, fuzzy = true) {
    return fuzzy ? { contains: value } : { equals: value };
}
export function buildKeywordOrConditions(fields, keyword, fuzzy = true) {
    if (!keyword)
        return [];
    const matcher = buildStringMatch(keyword, fuzzy);
    return fields.map((field) => ({
        [field]: matcher,
    }));
}
//# sourceMappingURL=queryBuilder.js.map