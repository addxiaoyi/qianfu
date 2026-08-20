import { ZodError, ZodIssue } from 'zod';
/**
 * Validation error item format used by AppError
 */
export interface ValidationErrorItem {
    field: string;
    message: string;
}
/**
 * Convert Zod validation errors to AppError-compatible format
 * Zod uses `issues` internally, we need to convert to `errors` with `field` and `message`
 */
export declare function convertZodErrors(error: ZodError): ValidationErrorItem[];
export declare function convertZodErrors(issues: ZodIssue[]): ValidationErrorItem[];
/**
 * Extract validation errors from unknown error
 */
export declare function extractValidationErrors(error: unknown): ValidationErrorItem[] | null;
/**
 * Create AppError from Zod validation error
 */
export declare function fromZodError(error: ZodError): {
    errors: ValidationErrorItem[];
};
//# sourceMappingURL=zodError.d.ts.map