import { Request, Response, NextFunction } from 'express';
export interface SanitizeResult {
    sanitized: boolean;
    threats: string[];
    value: unknown;
}
export declare function detectSQLInjection(value: unknown, depth?: number): SanitizeResult;
export declare function sanitizeString(value: string): string;
export declare function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown>;
export declare function sanitizeArray(arr: unknown[]): unknown[];
export declare function sanitizeInput(value: unknown): unknown;
export declare function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction): void;
export declare function createSQLInjectionProtection(enabled?: boolean): (req: Request, res: Response, next: NextFunction) => void;
export declare function createParamSanitizer(paramNames: string[]): (req: Request, _res: Response, next: NextFunction) => void;
export declare function createBodySanitizer(fieldNames: string[]): (req: Request, _res: Response, next: NextFunction) => void;
export declare function sanitizeForLike(value: string): string;
export declare function sanitizeForRegex(value: string): string;
export declare function escapeLikeWildcards(value: string): string;
//# sourceMappingURL=sanitizer.d.ts.map