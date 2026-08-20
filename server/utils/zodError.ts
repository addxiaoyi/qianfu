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
export function convertZodErrors(error: ZodError): ValidationErrorItem[];
export function convertZodErrors(issues: ZodIssue[]): ValidationErrorItem[];
export function convertZodErrors(errorOrIssues: ZodError | ZodIssue[]): ValidationErrorItem[] {
  // Get issues from ZodError or use directly
  const issues: ZodIssue[] = errorOrIssues instanceof ZodError
    ? errorOrIssues.issues
    : errorOrIssues;

  return issues.map((issue: ZodIssue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
}

/**
 * Extract validation errors from unknown error
 */
export function extractValidationErrors(error: unknown): ValidationErrorItem[] | null {
  if (error instanceof ZodError) {
    return convertZodErrors(error);
  }
  return null;
}

/**
 * Create AppError from Zod validation error
 */
export function fromZodError(error: ZodError): { errors: ValidationErrorItem[] } {
  return {
    errors: convertZodErrors(error),
  };
}

