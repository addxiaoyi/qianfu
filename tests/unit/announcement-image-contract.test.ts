import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { announcementCreateSchema } from '../../server/services/announcementService';
import { appendAnnouncementImage, parseAnnouncementMessage } from '../../qianfu-liandeng/src/utils/announcementContent';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

const originalR2Env = {
  enabled: process.env.R2_ENABLED,
  accountId: process.env.R2_ACCOUNT_ID,
  bucket: process.env.R2_BUCKET,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
};

afterEach(() => {
  process.env.R2_ENABLED = originalR2Env.enabled;
  process.env.R2_ACCOUNT_ID = originalR2Env.accountId;
  process.env.R2_BUCKET = originalR2Env.bucket;
  process.env.R2_ACCESS_KEY_ID = originalR2Env.accessKeyId;
  process.env.R2_SECRET_ACCESS_KEY = originalR2Env.secretAccessKey;
  process.env.R2_PUBLIC_BASE_URL = originalR2Env.publicBaseUrl;
});

describe('announcement R2 image contract', () => {
  it('accepts markdown images hosted under the configured R2 public URL', async () => {
    process.env.R2_ENABLED = 'true';
    process.env.R2_ACCOUNT_ID = 'account-id';
    process.env.R2_BUCKET = 'qianfu-images';
    process.env.R2_ACCESS_KEY_ID = 'access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
    process.env.R2_PUBLIC_BASE_URL = 'https://img.example.com';

    const parsed = announcementCreateSchema.safeParse({
      title: 'R2 图片新闻',
      message: '更新内容\n\n![版本截图](https://img.example.com/images/release.webp)',
      tone: 'INFO',
      status: 'DRAFT',
      priority: 50,
      dismissible: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects markdown images that do not come from the configured R2 public URL', async () => {
    process.env.R2_ENABLED = 'true';
    process.env.R2_ACCOUNT_ID = 'account-id';
    process.env.R2_BUCKET = 'qianfu-images';
    process.env.R2_ACCESS_KEY_ID = 'access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
    process.env.R2_PUBLIC_BASE_URL = 'https://img.example.com';

    const parsed = announcementCreateSchema.safeParse({
      title: '外链图片新闻',
      message: '![外部图片](https://evil.example/image.webp)',
      tone: 'INFO',
      status: 'DRAFT',
      priority: 50,
      dismissible: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('appends and renders multiple HTTPS image blocks without HTML injection', () => {
    const message = appendAnnouncementImage('版本更新', 'https://img.example.com/images/one.webp', '第一张');
    const combined = appendAnnouncementImage(message, 'https://img.example.com/images/two.webp', '第二张');
    const blocks = parseAnnouncementMessage(combined);

    expect(blocks).toEqual([
      { type: 'text', value: '版本更新\n\n' },
      { type: 'image', url: 'https://img.example.com/images/one.webp', alt: '第一张' },
      { type: 'text', value: '\n\n' },
      { type: 'image', url: 'https://img.example.com/images/two.webp', alt: '第二张' },
    ]);
  });

  it('keeps non-HTTPS image markdown as text', () => {
    expect(parseAnnouncementMessage('![外链](http://evil.example/image.png)')).toEqual([
      { type: 'text', value: '![外链](http://evil.example/image.png)' },
    ]);
  });

  it('uses the R2-only announcement image upload contract', () => {
    const uploadRoute = read('server/routes/upload.ts');
    const uploadClient = read('qianfu-liandeng/src/utils/imageUpload.ts');
    const adminPage = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');

    expect(uploadRoute).toContain("kind === 'announcement-image'");
    expect(uploadRoute).toContain("storage = 'r2'");
    expect(uploadRoute).toContain('isAdministrator(req)');
    expect(uploadRoute).toContain('UPLOAD_CONFIG.maxAnnouncementImageSize');
    expect(uploadClient).toContain("'announcement-image'");
    expect(adminPage).toContain("uploadImageFile(file, 'announcement-image')");
  });

  it('adds drag and drop upload controls to admin news and renders failed images safely', () => {
    const adminPage = read('qianfu-liandeng/src/pages/admin/AdminAnnouncements.tsx');
    const publicPage = read('qianfu-liandeng/src/pages/News.tsx');

    expect(adminPage).toContain('onDragOver');
    expect(adminPage).toContain('onDrop');
    expect(adminPage).toContain('uploadImageFile');
    expect(publicPage).toContain('loading="lazy"');
    expect(publicPage).toContain('图片暂时无法加载');
  });
});
