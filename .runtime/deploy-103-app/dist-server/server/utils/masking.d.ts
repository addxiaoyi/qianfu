/**
 * Centralized data masking and sanitization utilities
 */
export declare const SENSITIVE_KEYS: string[];
/**
 * Mask an email address (e.g., jo***n@example.com)
 */
export declare const maskEmail: (email: string) => string;
/**
 * Mask a phone number (e.g., 138****5678)
 */
export declare const maskPhone: (phone: string) => string;
/**
 * Generic masking for sensitive data
 */
export declare const maskData: (data: any, depth?: number) => any;
//# sourceMappingURL=masking.d.ts.map