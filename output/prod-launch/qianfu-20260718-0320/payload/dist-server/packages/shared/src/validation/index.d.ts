/**

 * QianFu Shared Validation

 * Zod-based validation schemas and helpers + request middleware

 */
import { z, ZodSchema, ZodError } from 'zod';
/**

 * Common validation patterns

 */
export declare const patterns: {
    email: RegExp;
    password: RegExp;
    uuid: RegExp;
    username: RegExp;
    url: RegExp;
};
/**

 * Parse pagination params with defaults

 */
export declare function parsePagination(query: Record<string, unknown>): {
    page: number;
    limit: number;
    skip: number;
};
/**

 * Validate data against Zod schema

 */
export declare function validate<T>(schema: ZodSchema<T>, data: unknown): T;
/**

 * Validate and return both data and errors

 */
export declare function validatePartial<T>(schema: ZodSchema<T>, data: unknown): {
    success: true;
    data: T;
} | {
    success: false;
    errors: Array<{
        field: string;
        message: string;
    }>;
};
/**

 * Validate and throw on failure

 */
export declare function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown, _message?: string): T;
/**

 * Format Zod errors to consistent structure

 */
export declare function formatZodErrors(error: ZodError): Array<{
    field: string;
    message: string;
}>;
/**

 * Common Zod schemas

 */
export declare const schemas: {
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
    }, {
        page?: number | undefined;
        limit?: number | undefined;
    }>;
    uuid: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    username: z.ZodString;
    url: z.ZodString;
    ip: z.ZodString;
    date: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    id: z.ZodNumber;
};
export type PaginationInput = z.infer<typeof schemas.pagination>;
export { z };
/**

 * Async validation helper for request handlers

 */
export declare function validateRequest<T>(schema: ZodSchema<T>, data: unknown, options?: {
    async?: boolean;
}): Promise<T>;
/**

 * Express middleware: validate request body

 */
export declare function validateBody<T>(schema: ZodSchema<T>): (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => void;
/**

 * Express middleware: validate query parameters

 */
export declare function validateQuery<T>(schema: ZodSchema<T>): (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => void;
/**

 * Express middleware: validate URL parameters

 */
export declare function validateParams<T>(schema: ZodSchema<T>): (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => void;
//# sourceMappingURL=index.d.ts.map