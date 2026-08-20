export const IMAGE_DECODE_LIMITS = Object.freeze({
  maxAnimationFrames: 120,
  maxDecodedPixels: 100_000_000,
});

export interface ImageMetadataLike {
  width?: number;
  height?: number;
  pages?: number;
  pageHeight?: number;
}

export function assertSafeImageMetadata(metadata: ImageMetadataLike): void {
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const pages = metadata.pages || 1;
  const pageHeight = metadata.pageHeight || (pages > 1 ? Math.floor(height / pages) : height);

  if (pages > IMAGE_DECODE_LIMITS.maxAnimationFrames) {
    throw new Error(`Image animation frame limit exceeded (${pages})`);
  }
  if (width <= 0 || pageHeight <= 0) throw new Error('Invalid image dimensions');

  const decodedPixels = width * pageHeight * pages;
  if (!Number.isSafeInteger(decodedPixels) || decodedPixels > IMAGE_DECODE_LIMITS.maxDecodedPixels) {
    throw new Error('Image decoded pixel budget exceeded');
  }
}
