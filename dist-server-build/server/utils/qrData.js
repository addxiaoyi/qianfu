export const encodeQrData = (value) => Buffer.from(value, 'utf8').toString('base64url');
export const decodeQrData = (value) => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value))
        return '';
    try {
        return Buffer.from(value, 'base64url').toString('utf8');
    }
    catch {
        return '';
    }
};
//# sourceMappingURL=qrData.js.map