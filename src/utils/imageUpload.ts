import { api } from '../api/request';

const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024;

export async function compressImage(file: File, maxWidth = 512, maxHeight = 512, quality = 0.85): Promise<File> {
  // Skip compression for GIFs or non-images as Canvas compression ruins animated GIFs
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return file;
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        
        ctx.drawImage(img, 0, 0, width, height);
        
        const exportType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: exportType,
                lastModified: Date.now(),
              });
              // Only use the compressed file if it's actually smaller
              resolve(compressedFile.size < file.size ? compressedFile : file);
            } else {
              resolve(file);
            }
          },
          exportType,
          quality
        );
      };
      img.onerror = () => reject(new Error('Image load error'));
      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}
export type ImageUploadKind = 'image' | 'announcement-image';

interface UploadedImageResponse {
  url?: string;
  storage?: string;
  data?: {
    url?: string;
    storage?: string;
    r2Upload?: {
      uploadUrl?: string;
      sourceUrl?: string;
      expiresIn?: number;
    };
  };
  r2Upload?: {
    uploadUrl?: string;
    sourceUrl?: string;
    expiresIn?: number;
  };
}

async function finishBrowserR2Upload(upload: NonNullable<UploadedImageResponse['r2Upload']>) {
  if (!upload.uploadUrl || !upload.sourceUrl) {
    throw new Error('图片存储授权信息不完整');
  }

  const source = await fetch(upload.sourceUrl, { credentials: 'include' });
  if (!source.ok) throw new Error('无法读取已处理图片');

  const put = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': source.headers.get('content-type') || 'application/octet-stream' },
    body: await source.blob(),
  });
  if (!put.ok) throw new Error('图片同步到图床失败');
}

export async function uploadImageFile(file: File, kind: ImageUploadKind = 'image'): Promise<string> {
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
  if (!allowedTypes.has(file.type)) {
    throw new Error('请选择 PNG、JPG、GIF 或 WEBP 图片');
  }
  if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
    throw new Error('图片不能超过 5MB');
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isGif = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46;
  const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;
  if (!isPng && !isJpeg && !isGif && !isWebp) {
    throw new Error('图片内容格式无效');
  }

  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);

  const uploaded = await api.post<UploadedImageResponse>('/upload', form, { useAuth: true, timeout: 60000 });
  const payload = uploaded.data || uploaded;
  const r2Upload = payload.r2Upload || uploaded.r2Upload;
  if ((payload.storage || uploaded.storage) === 'r2-presigned' && r2Upload) {
    await finishBrowserR2Upload(r2Upload);
  }
  if (kind === 'announcement-image' && payload.storage !== 'r2') {
    throw new Error('新闻图片没有进入 R2，请检查 R2 配置后重试');
  }
  const url = payload?.url || uploaded?.url;
  if (!url) throw new Error('上传服务未返回图片地址');
  return url;
}
