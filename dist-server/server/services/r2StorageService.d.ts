import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
export type R2StorageEnvironment = Record<string, string | undefined>;
export interface R2StorageConfig {
    enabled: boolean;
    accountId: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint: string;
    publicBaseUrl: string;
}
export interface R2PutObjectClient {
    send(command: PutObjectCommand, options?: {
        abortSignal?: AbortSignal;
    }): Promise<unknown>;
}
export interface R2UploadGrant {
    uploadUrl: string;
    publicUrl: string;
    sourceKey: string;
    expiresIn: number;
}
export declare const R2_UPLOAD_URL_TTL_SECONDS = 600;
export declare const R2_DIRECT_UPLOAD_TIMEOUT_MS = 15000;
export declare function getR2StorageConfig(env?: R2StorageEnvironment): R2StorageConfig;
export declare function createR2Client(config: R2StorageConfig): S3Client;
export declare function uploadToR2(buffer: Buffer, filename: string, mimeType: string, config: R2StorageConfig, client?: R2PutObjectClient): Promise<string | null>;
export declare function uploadToR2File(filePath: string, filename: string, mimeType: string, config: R2StorageConfig, client?: R2PutObjectClient): Promise<string | null>;
export declare function createR2UploadGrant(filename: string, mimeType: string, config: R2StorageConfig): Promise<R2UploadGrant | null>;
//# sourceMappingURL=r2StorageService.d.ts.map