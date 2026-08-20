import { Request, Response, NextFunction } from 'express';
export declare function escapeHtmlChars(str: string): string;
export interface XSSScanResult {
    detected: boolean;
    threats: string[];
    value: unknown;
}
export declare function detectXSS(value: unknown, depth?: number): XSSScanResult;
export declare function sanitizeHTML(value: string, allowedTags?: string[], allowedAttributes?: Record<string, string[]>): string;
export declare function sanitizeString(value: string): string;
export declare function sanitizeObject(obj: Record<string, unknown>, allowedTags?: string[], allowedAttributes?: Record<string, string[]>): Record<string, unknown>;
export declare function sanitizeArray(arr: unknown[], allowedTags?: string[], allowedAttributes?: Record<string, string[]>): unknown[];
export declare function sanitizeInput(value: unknown, allowedTags?: string[], allowedAttributes?: Record<string, string[]>): unknown;
export declare function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction): void;
export declare function createXSSProtection(options?: {
    enabled?: boolean;
    blockMode?: boolean;
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    whitelistPaths?: string[];
}): (req: Request, res: Response, next: NextFunction) => void;
export declare function sanitizeForDisplay(value: string): string;
export declare function sanitizeForAttribute(value: string, allowedChars?: string): string;
export declare function sanitizeForURL(value: string): string;
//# sourceMappingURL=xssProtection.d.ts.map