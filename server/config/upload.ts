export const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB for marketplace assets
  maxBase64FileSize: 5 * 1024 * 1024,
  allowedImageMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  allowedImageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  allowedAssetMimeTypes: [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/zip', 'application/x-zip-compressed',
    'application/java-archive', 'application/json',
    'application/octet-stream', 'application/gzip',
    'application/nbt', 'application/x-nbt', 'application/x-schematic',
    'text/plain', 'text/markdown',
  ],
  allowedAssetExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.jar', '.json', '.txt', '.md', '.schem', '.schematic'],
  maxImageDimension: 4096,
};
