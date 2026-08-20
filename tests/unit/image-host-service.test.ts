import { describe, expect, it, vi } from 'vitest';

import {
  extractImageHostUrl,
  getImageHostConfig,
  uploadToImageHost,
} from '../../server/services/imageHostService';

describe('image host integration', () => {
  it('reads a nested image URL from the configured response path', () => {
    expect(extractImageHostUrl({ data: { links: { url: 'https://img.example/a.webp' } } }, 'data.links.url'))
      .toBe('https://img.example/a.webp');
  });

  it('builds a disabled config when no image host is configured', () => {
    expect(getImageHostConfig({ IMAGE_HOST_ENABLED: 'false' })).toMatchObject({ enabled: false });
  });

  it('uploads multipart data with the configured token header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ url: 'https://img.example/uploaded.webp' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));

    const config = getImageHostConfig({
      IMAGE_HOST_ENABLED: 'true',
      IMAGE_HOST_UPLOAD_URL: 'https://img.example/api/upload',
      IMAGE_HOST_TOKEN: 'secret-token',
      IMAGE_HOST_AUTH_HEADER: 'X-API-Key',
      IMAGE_HOST_FILE_FIELD: 'image',
      IMAGE_HOST_RESPONSE_PATH: 'url',
    });

    await expect(uploadToImageHost(Buffer.from('image'), 'cover.png', 'image/png', config, fetchMock))
      .resolves.toBe('https://img.example/uploaded.webp');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('X-API-Key')).toBe('secret-token');
    expect(init.body).toBeInstanceOf(FormData);
  });
});
