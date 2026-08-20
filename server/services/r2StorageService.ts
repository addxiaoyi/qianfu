import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type R2StorageEnvironment = Record<string, string | undefined>;

export interface R2StorageConfig {
  enabled: boolean;
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  publicBaseUrl: string;
}

export interface R2PutObjectClient {
  send(command: PutObjectCommand, options?: { abortSignal?: AbortSignal }): Promise<unknown>;
}

export interface R2UploadGrant {
  uploadUrl: string;
  publicUrl: string;
  sourceKey: string;
  expiresIn: number;
}

export const R2_UPLOAD_URL_TTL_SECONDS = 600;
export const R2_DIRECT_UPLOAD_TIMEOUT_MS = 15_000;

const parseBoolean = (value: string | undefined): boolean => value?.trim().toLowerCase() === 'true';

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '');

const createImageKey = (filename: string): string =>
  `images/${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

export function getR2StorageConfig(env: R2StorageEnvironment = process.env): R2StorageConfig {
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

export function createR2Client(config: R2StorageConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function uploadToR2(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  config: R2StorageConfig,
  client?: R2PutObjectClient,
): Promise<string | null> {
  if (!config.enabled) return null;

  const r2Client = client || createR2Client(config);
  const key = createImageKey(filename);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), R2_DIRECT_UPLOAD_TIMEOUT_MS);
  try {
    await r2Client.send(createPutObjectCommand(config, key, buffer, mimeType), { abortSignal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  return `${config.publicBaseUrl}/${key}`;
}

export async function uploadToR2File(
  filePath: string,
  filename: string,
  mimeType: string,
  config: R2StorageConfig,
  client?: R2PutObjectClient,
): Promise<string | null> {
  if (!config.enabled) return null;

  const r2Client = client || createR2Client(config);
  const key = createImageKey(filename);
  const body = createReadStream(filePath);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), R2_DIRECT_UPLOAD_TIMEOUT_MS);

  try {
    await r2Client.send(createPutObjectCommand(config, key, body, mimeType), { abortSignal: controller.signal });
  } finally {
    clearTimeout(timeout);
    body.destroy();
  }

  return `${config.publicBaseUrl}/${key}`;
}

function createPutObjectCommand(
  config: R2StorageConfig,
  key: string,
  body: Buffer | ReturnType<typeof createReadStream>,
  mimeType: string,
): PutObjectCommand {
  return new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
  });
}

export async function createR2UploadGrant(
  filename: string,
  mimeType: string,
  config: R2StorageConfig,
): Promise<R2UploadGrant | null> {
  if (!config.enabled) return null;

  const sourceKey = createImageKey(filename);
  const uploadUrl = await getSignedUrl(
    createR2Client(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: sourceKey,
      ContentType: mimeType,
    }),
    { expiresIn: R2_UPLOAD_URL_TTL_SECONDS },
  );

  return {
    uploadUrl,
    publicUrl: `${config.publicBaseUrl}/${sourceKey}`,
    sourceKey,
    expiresIn: R2_UPLOAD_URL_TTL_SECONDS,
  };
}
