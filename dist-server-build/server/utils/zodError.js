import { ZodError } from 'zod';
export function convertZodErrors(errorOrIssues) {
    // Get issues from ZodError or use directly
    const issues = errorOrIssues instanceof ZodError
        ? errorOrIssues.issues
        : errorOrIssues;
    return issues.map((issue) => ({
        field: issue.path.join('.') || 'unknown',
        message: issue.message,
    }));
}
/**
 * Extract validation errors from unknown error
 */
export function extractValidationErrors(error) {
    if (error instanceof ZodError) {
        return convertZodErrors(error);
    }
    return null;
}
/**
 * Create AppError from Zod validation error
 */
export function fromZodError(error) {
    return {
        errors: convertZodErrors(error),
    };
}
//# sourceMappingURL=zodError.js.map