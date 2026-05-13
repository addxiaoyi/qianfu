export const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB for marketplace assets
  allowedImageMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  allowedImageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  allowedAssetMimeTypes: [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/zip', 'application/x-zip-compressed',
    'application/java-archive', 'application/json',
    'text/plain', 'text/markdown', 'application/octet-stream',
  ],
  allowedAssetExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.jar', '.json', '.txt', '.md', '.schem', '.schematic'],
  maxImageDimension: 4096,
};
