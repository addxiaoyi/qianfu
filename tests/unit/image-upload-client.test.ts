import { describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../qianfu-liandeng/src/api/request', () => ({
  api: { post },
}));

import { uploadImageFile } from '../../qianfu-liandeng/src/utils/imageUpload';

describe('frontend image upload client', () => {
  it('sends an image as multipart form data and returns the server URL', async () => {
    post.mockResolvedValueOnce({ url: 'https://img.example/cover.webp' });
    const file = new File(['image'], 'cover.png', { type: 'image/png' });

    await expect(uploadImageFile(file)).resolves.toBe('https://img.example/cover.webp');

    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/upload');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('kind')).toBe('image');
    expect(body.get('file')).toBe(file);
  });

  it('finishes a presigned R2 upload in the browser when the API server cannot reach R2', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('processed', { status: 200, headers: { 'content-type': 'image/png' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    post.mockResolvedValueOnce({
      url: 'https://img.example/images/cover.png',
      storage: 'r2-presigned',
      r2Upload: {
        uploadUrl: 'https://r2.example/upload?signature=test',
        sourceUrl: '/uploads/cover.png',
      },
    });

    await expect(uploadImageFile(new File(['image'], 'cover.png', { type: 'image/png' })))
      .resolves.toBe('https://img.example/images/cover.png');

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://r2.example/upload?signature=test', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
    }));
    vi.unstubAllGlobals();
  });
});
