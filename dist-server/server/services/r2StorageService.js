import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export const R2_UPLOAD_URL_TTL_SECONDS = 600;
export const R2_DIRECT_UPLOAD_TIMEOUT_MS = 15_000;
const parseBoolean = (value) => value?.trim().toLowerCase() === 'true';
const normalizeBaseUrl = (value) => value.trim().replace(/\/+$/, '');
const createImageKey = (filename) => `images/${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
export function getR2StorageConfig(env = process.env) {
    const accountId = env.R2_ACCOUNT_ID?.trim() || '';
    const bucket = env.R2_BUCKET?.trim() || '';
    const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() || '';
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() || '';
    const publicBaseUrl = normalizeBaseUrl(env.R2_PUBLIC_BASE_URL || '');
    return {
        enabled: parseBoolean(env.R2_ENABLED)
            && Boolean(accountId && bucket && accessKeyId && secretAccessKey && publicBaseUrl),
        accountId,
        bucket,
        accessKeyId,
        secretAccessKey,
        endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '',
        publicBaseUrl,
    };
}
export function createR2Client(config) {
    return new S3Client({
        region: 'auto',
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
}
export async function uploadToR2(buffer, filename, mimeType, config, client) {
    if (!config.enabled)
        return null;
    const r2Client = client || createR2Client(config);
    const key = createImageKey(filename);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), R2_DIRECT_UPLOAD_TIMEOUT_MS);
    try {
        await r2Client.send(createPutObjectCommand(config, key, buffer, mimeType), { abortSignal: controller.signal });
    }
    finally {
        clearTimeout(timeout);
    }
    return `${config.publicBaseUrl}/${key}`;
}
export async function uploadToR2File(filePath, filename, mimeType, config, client) {
    if (!config.enabled)
        return null;
    const r2Client = client || createR2Client(config);
    const key = createImageKey(filename);
    const body = createReadStream(filePath);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), R2_DIRECT_UPLOAD_TIMEOUT_MS);
    try {
        await r2Client.send(createPutObjectCommand(config, key, body, mimeType), { abortSignal: controller.signal });
    }
    finally {
        clearTimeout(timeout);
        body.destroy();
    }
    return `${config.publicBaseUrl}/${key}`;
}
function createPutObjectCommand(config, key, body, mimeType) {
    return new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
    });
}
export async function createR2UploadGrant(filename, mimeType, config) {
    if (!config.enabled)
        return null;
    const sourceKey = createImageKey(filename);
    const uploadUrl = await getSignedUrl(createR2Client(config), new PutObjectCommand({
        Bucket: config.bucket,
        Key: sourceKey,
        ContentType: mimeType,
    }), { expiresIn: R2_UPLOAD_URL_TTL_SECONDS });
    return {
        uploadUrl,
        publicUrl: `${config.publicBaseUrl}/${sourceKey}`,
        sourceKey,
        expiresIn: R2_UPLOAD_URL_TTL_SECONDS,
    };
}
//# sourceMappingURL=r2StorageService.js.map