export interface SignatureParams {
    method: string;
    path: string;
    timestamp: string;
    bodyMd5: string;
}
export interface VerifyResult {
    valid: boolean;
    error?: string;
}
export declare class SignatureUtil {
    private appId;
    private secretKey;
    private timeoutSeconds;
    constructor(appId: string, secretKey: string, timeoutSeconds?: number);
    static generateSignature(params: SignatureParams, secretKey: string): string;
    static md5(content: string): string;
    verify(params: SignatureParams, signature: string): VerifyResult;
    static extractSignatureHeaders(headers: Record<string, string | undefined>): {
        appId: string | undefined;
        timestamp: string | undefined;
        signature: string | undefined;
    };
    static isTimestampExpired(timestamp: string, timeoutSeconds?: number): boolean;
}
export interface QianFuConfig {
    appId: string;
    secretKey: string;
    apiUrl: string;
    callbackUrl: string;
    enabled: boolean;
    whitelist?: string[];
}
export declare const qianfuConfig: QianFuConfig;
//# sourceMappingURL=SignatureUtil.d.ts.map