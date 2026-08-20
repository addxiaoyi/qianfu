import { describe, expect, it } from 'vitest';
import { UploadService } from '../../server/services/uploadService';

describe('upload virus scan', () => {
  it('accepts a valid binary PNG with zero bytes', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLq6AAAAABJRU5ErkJggg==',
      'base64',
    );

    await expect(UploadService.scanForViruses(png)).resolves.toBe(true);
  });

  it('still rejects embedded script markers', async () => {
    const suspicious = Buffer.concat([
      Buffer.from('89504e470d0a1a0a', 'hex'),
      Buffer.from('<script>alert(1)</script>'),
    ]);

    await expect(UploadService.scanForViruses(suspicious)).resolves.toBe(false);
  });
});
