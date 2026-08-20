export declare const IMAGE_DECODE_LIMITS: Readonly<{
    maxAnimationFrames: 120;
    maxDecodedPixels: 100000000;
}>;
export interface ImageMetadataLike {
    width?: number;
    height?: number;
    pages?: number;
    pageHeight?: number;
}
export declare function assertSafeImageMetadata(metadata: ImageMetadataLike): void;
//# sourceMappingURL=imageInspection.d.ts.map