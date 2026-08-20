export const isPort5555Request = (req) => {
    const baseUrl = req.baseUrl || '';
    const originalUrl = req.originalUrl || '';
    return req.headers['x-port-5555'] === 'true'
        || req.path.startsWith('/api/port5555')
        || baseUrl.includes('/port5555')
        || originalUrl.includes('/api/port5555')
        || originalUrl.includes(':5555');
};
//# sourceMappingURL=port5555Request.js.map