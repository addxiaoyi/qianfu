import { describe, expect, it, vi } from 'vitest';

import {
  getR2StorageConfig,
  createR2UploadGrant,
  R2_UPLOAD_URL_TTL_SECONDS,
  R2_DIRECT_UPLOAD_TIMEOUT_MS,
  uploadToR2,
  uploadToR2File,
  type R2PutObjectClient,
} from '../../server/services/r2StorageService';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('R2 storage integration', () => {
  it('allows enough time for production R2 latency before aborting', () => {
    expect(R2_DIRECT_UPLOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
  });

  it('keeps R2 disabled until all public upload settings are present', () => {
    expect(getR2StorageConfig({ R2_ENABLED: 'true' })).toMatchObject({ enabled: false });

    expect(getR2StorageConfig({
      R2_ENABLED: 'true',
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET: 'qianfu-images',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://img.example.com/',
    })).toMatchObject({
      enabled: true,
      endpoint: 'https://account-id.r2.cloudflarestorage.com',
      publicBaseUrl: 'https://img.example.com',
    });
  });

  it('uploads an object with immutable cache headers and returns the public URL', async () => {
    const send = vi.fn().mockResolvedValue({});
    const client: R2PutObjectClient = { send };
    const config = getR2StorageConfig({
      R2_ENABLED: 'true',
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET: 'qianfu-images',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://img.example.com',
    });

    await expect(uploadToR2(Buffer.from('image'), 'cover.webp', 'image/webp', config, client))
      .resolves.toMatch(/^https:\/\/img\.example\.com\/images\/[0-9a-f-]+-cover\.webp$/);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      input: {
        Bucket: 'qianfu-images',
        Body: Buffer.from('image'),
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      },
    });
  });

  it('returns null without calling R2 when the integration is disabled', async () => {
    const client: R2PutObjectClient = { send: vi.fn() };
    const config = getR2StorageConfig({ R2_ENABLED: 'false' });

    await expect(uploadToR2(Buffer.from('image'), 'cover.webp', 'image/webp', config, client))
      .resolves.toBeNull();
    expect(client.send).not.toHaveBeenCalled();
  });

  it('streams a file into R2 without buffering the whole file first', async () => {
    const send = vi.fn().mockResolvedValue({});
    const client: R2PutObjectClient = { send };
    const config = getR2StorageConfig({
      R2_ENABLED: 'true',
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET: 'qianfu-images',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://img.example.com',
    });

    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'qianfu-r2-'));
    const filePath = path.join(tempDir, 'processed.webp');
    await writeFile(filePath, 'image');
    try {
      await expect(uploadToR2File(filePath, 'cover.webp', 'image/webp', config, client))
        .resolves.toMatch(/^https:\/\/img\.example\.com\/images\/[0-9a-f-]+-cover\.webp$/);

      const body = send.mock.calls[0]?.[0]?.input?.Body;
      expect(body).toBeDefined();
      expect(typeof body?.pipe).toBe('function');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('aborts a stalled direct upload so the presigned fallback can respond', async () => {
    vi.useFakeTimers();
    try {
      const send = vi.fn((_command, options?: { abortSignal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.abortSignal?.addEventListener('abort', () => reject(new Error('aborted')));
        }));
      const config = getR2StorageConfig({
        R2_ENABLED: 'true',
        R2_ACCOUNT_ID: 'account-id',
        R2_BUCKET: 'qianfu-images',
        R2_ACCESS_KEY_ID: 'access-key',
        R2_SECRET_ACCESS_KEY: 'secret-key',
        R2_PUBLIC_BASE_URL: 'https://img.example.com',
      });

      const upload = uploadToR2(Buffer.from('image'), 'cover.webp', 'image/webp', config, { send });
      const aborted = expect(upload).rejects.toThrow('aborted');
      await vi.advanceTimersByTimeAsync(R2_DIRECT_UPLOAD_TIMEOUT_MS);

      await aborted;
      expect(send.mock.calls[0]?.[1]?.abortSignal).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates a short-lived browser upload grant without sending an R2 request', async () => {
    const config = getR2StorageConfig({
      R2_ENABLED: 'true',
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET: 'qianfu-images',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://img.example.com',
    });

    const grant = await createR2UploadGrant('cover.webp', 'image/webp', config);

    expect(grant?.uploadUrl).toContain('X-Amz-Expires=' + R2_UPLOAD_URL_TTL_SECONDS);
    expect(grant?.publicUrl).toMatch(/^https:\/\/img\.example\.com\/images\/[0-9a-f-]+-cover\.webp$/);
  });
});
