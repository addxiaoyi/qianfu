import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
const parseBoolean = (value) => value?.trim().toLowerCase() === 'true';
const normalizeBaseUrl = (value) => value.trim().replace(/\/+$/, '');
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
    const key = `images/${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await r2Client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
    }));
    return `${config.publicBaseUrl}/${key}`;
}
//# sourceMappingURL=r2StorageService.js.map