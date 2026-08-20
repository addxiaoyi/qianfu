import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeSource = fs.readFileSync('server/routes/upload.ts', 'utf8');
const coverSource = fs.readFileSync('qianfu-liandeng/src/components/form/MatrixImageUpload.tsx', 'utf8');
const editorSource = fs.readFileSync('qianfu-liandeng/src/components/form/RichTextEditor.tsx', 'utf8');

describe('image upload integration contract', () => {
  it('forwards processed images to the image host and keeps local storage as fallback', () => {
    expect(routeSource).toContain('uploadToImageHost');
    expect(routeSource).toContain("storage = 'image-host'");
    expect(routeSource).toContain("let storage: 'r2' | 'image-host' | 'local' = 'local'");
    expect(routeSource).toContain('Image host upload failed, using local storage');
  });

  it('uses multipart upload instead of putting image bytes into editor state', () => {
    expect(coverSource).toContain('uploadImageFile');
    expect(coverSource).not.toContain('FileReader');
    expect(coverSource).not.toContain('readAsDataURL');
    expect(editorSource).toContain('onDrop');
    expect(editorSource).toContain('onPaste');
    expect(editorSource).toContain('uploadImageFile');
  });

  it('uploads processed images server-side before returning the public R2 URL', () => {
    const directUploadIndex = routeSource.indexOf('uploadToR2File(processedPath');

    expect(directUploadIndex).toBeGreaterThan(-1);
    expect(routeSource).not.toContain('createR2UploadGrant');
    expect(routeSource).not.toContain("storage = 'r2-presigned'");
    expect(routeSource).not.toContain('sourceUrl: `${API_VERSION_PREFIX}${result.url}`');
  });
});
