export interface UploadResult {
    url: string;
    size: number;
    mime: string;
    filename: string;
}
export declare class UploadService {
    private static readonly uploadsDir;
    static ensureUploadsDir(): void;
    static scanForViruses(buffer: Buffer): Promise<boolean>;
    private static checkMagicNumbers;
    private static detectAssetMime;
    static processAndSaveImage(buffer: Buffer, originalFilename: string, userId?: number): Promise<UploadResult>;
    static processAndSaveAsset(buffer: Buffer, originalFilename: string): Promise<UploadResult>;
}
//# sourceMappingURL=uploadService.d.ts.map