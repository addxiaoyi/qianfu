/**
 * 敏感信息脱敏工具
 * 用于日志、响应、错误信息等场景的敏感数据保护
 */
export interface MaskingRule {
    pattern: string | RegExp;
    prefixLength?: number;
    suffixLength?: number;
    customMask?: (value: string) => string;
    recursive?: boolean;
    replacement?: string;
}
export interface MaskingOptions {
    recursive?: boolean;
    maxDepth?: number;
    customRules?: MaskingRule[];
    preserveField?: boolean;
    replacement?: string;
}
export interface MaskingResult {
    masked: unknown;
    found: MaskSensitiveResult[];
}
export interface MaskSensitiveResult {
    path: string;
    type: 'field' | 'pattern';
    matched: string;
}
export declare const DEFAULT_SENSITIVE_FIELDS: string[];
export declare function createMasker(options?: MaskingOptions): {
    mask: (data: unknown) => unknown;
    maskWithResult: (data: unknown) => MaskingResult;
    maskString: (text: string) => string;
};
export declare const defaultMasker: {
    mask: (data: unknown) => unknown;
    maskWithResult: (data: unknown) => MaskingResult;
    maskString: (text: string) => string;
};
export declare function maskSensitiveData(data: unknown, options?: MaskingOptions): unknown;
export declare function maskSensitiveDataWithResult(data: unknown, options?: MaskingOptions): MaskingResult;
export declare function maskString(text: string, options?: MaskingOptions): string;
export declare const maskData: typeof maskSensitiveData;
export declare function maskEmail(email: string): string;
export declare function maskPhone(phone: string): string;
export declare const PRESET_RULES: {
    strict: MaskingOptions;
    lenient: MaskingOptions;
    payment: MaskingOptions;
    log: MaskingOptions;
};
export declare function createPresetMasker(preset: keyof typeof PRESET_RULES): {
    mask: (data: unknown) => unknown;
    maskWithResult: (data: unknown) => MaskingResult;
    maskString: (text: string) => string;
};
export declare const logMasker: {
    mask: (data: unknown) => unknown;
    maskWithResult: (data: unknown) => MaskingResult;
    maskString: (text: string) => string;
};
//# sourceMappingURL=masking.d.ts.map