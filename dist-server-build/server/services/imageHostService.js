import { randomUUID } from 'node:crypto';
const parseBoolean = (value) => value?.toLowerCase() === 'true';
export function getImageHostConfig(env = process.env) {
    const uploadUrl = env.IMAGE_HOST_UPLOAD_URL?.trim() || '';
    const token = env.IMAGE_HOST_TOKEN?.trim() || '';
    return {
        enabled: parseBoolean(env.IMAGE_HOST_ENABLED) && Boolean(uploadUrl),
        uploadUrl,
        token,
        authHeader: env.IMAGE_HOST_AUTH_HEADER?.trim() || 'Authorization',
        fileField: env.IMAGE_HOST_FILE_FIELD?.trim() || 'file',
        responsePath: env.IMAGE_HOST_RESPONSE_PATH?.trim() || 'url',
    };
}
export function extractImageHostUrl(payload, responsePath) {
    const value = responsePath.split('.').filter(Boolean).reduce((current, key) => {
        if (!current || typeof current !== 'object')
            return undefined;
        return current[key];
    }, payload);
    if (typeof value !== 'string')
        return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : null;
    }
    catch {
        return null;
    }
}
export async function uploadToImageHost(buffer, filename, mimeType, config, fetchImpl = fetch) {
    if (!config.enabled)
        return null;
    const form = new FormData();
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    form.append(config.fileField, new Blob([bytes], { type: mimeType }), `${randomUUID()}-${filename}`);
    const headers = new Headers();
    if (config.token)
        headers.set(config.authHeader, config.authHeader.toLowerCase() === 'authorization' ? `Bearer ${config.token}` : config.token);
    const response = await fetchImpl(config.uploadUrl, { method: 'POST', headers, body: form });
    if (!response.ok)
        throw new Error(`Image host upload failed with HTTP ${response.status}`);
    const payload = await response.json();
    const url = extractImageHostUrl(payload, config.responsePath);
    if (!url)
        throw new Error('Image host response did not contain a valid HTTPS image URL');
    return url;
}
//# sourceMappingURL=imageHostService.js.map