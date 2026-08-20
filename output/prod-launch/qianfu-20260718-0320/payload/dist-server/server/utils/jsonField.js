export function parseJsonArray(value) {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string');
    }
    if (typeof value !== 'string' || !value.trim()) {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    }
    catch {
        return [];
    }
}
export function parseJsonObject(value, fallback) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    if (typeof value !== 'string' || !value.trim()) {
        return fallback;
    }
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    }
    catch {
        return fallback;
    }
}
export function stringifyJsonField(value, fallback = '[]') {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value ?? fallback);
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=jsonField.js.map