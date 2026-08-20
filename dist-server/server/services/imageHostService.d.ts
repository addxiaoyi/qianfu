export type ImageHostEnvironment = Record<string, string | undefined>;
export interface ImageHostConfig {
    enabled: boolean;
    uploadUrl: string;
    token: string;
    authHeader: string;
    fileField: string;
    responsePath: string;
}
type FetchLike = typeof fetch;
export declare function getImageHostConfig(env?: ImageHostEnvironment): ImageHostConfig;
export declare function extractImageHostUrl(payload: unknown, responsePath: string): string | null;
export declare function uploadToImageHost(buffer: Buffer, filename: string, mimeType: string, config: ImageHostConfig, fetchImpl?: FetchLike): Promise<string | null>;
export {};
//# sourceMappingURL=imageHostService.d.ts.map