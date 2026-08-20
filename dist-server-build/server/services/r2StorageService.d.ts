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
    send(command: PutObjectCommand): Promise<unknown>;
}
export declare function getR2StorageConfig(env?: R2StorageEnvironment): R2StorageConfig;
export declare function createR2Client(config: R2StorageConfig): S3Client;
export declare function uploadToR2(buffer: Buffer, filename: string, mimeType: string, config: R2StorageConfig, client?: R2PutObjectClient): Promise<string | null>;
//# sourceMappingURL=r2StorageService.d.ts.map