export function getRouteParam(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value))
        return value[0] ?? '';
    return '';
}
//# sourceMappingURL=requestParams.js.map