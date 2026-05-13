/**

 * QianFu Shared Validation

 * Zod-based validation schemas and helpers + request middleware

 */
import { z } from 'zod';
import { ValidationError } from '../errors';
/**

 * Common validation patterns

 */
export const patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    username: /^[a-zA-Z0-9_-]{3,20}$/,
    url: /^https?:\/\/.+/,
};
/**

 * Parse pagination params with defaults

 */
export function parsePagination(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}
/**

 * Validate data against Zod schema

 */
export function validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const issues = formatZodErrors(result.error);
        throw new ValidationError('Validation failed', issues);
    }
    return result.data;
}
/**

 * Validate and return both data and errors

 */
export function validatePartial(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        return { success: false, errors: formatZodErrors(result.error) };
    }
    return { success: true, data: result.data };
}
/**

 * Validate and throw on failure

 */
export function validateOrThrow(schema, data, message = 'Validation failed') {
    return validate(schema, data);
}
/**

 * Format Zod errors to consistent structure

 */
export function formatZodErrors(error) {
    return error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
    }));
}
/**

 * Common Zod schemas

 */
export const schemas = {
    // Pagination
    pagination: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
    // UUID
    uuid: z.string().uuid(),
    // Email
    email: z.string().email(),
    // Password
    password: z
        .string()
        .min(8)
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/\d/, 'Password must contain at least one number'),
    // Username
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be at most 20 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores and hyphens'),
    // URL
    url: z.string().url(),
    // IP Address
    ip: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$|^([a-fA-F0-9:]+)$/, 'Invalid IP address'),
    // Date
    date: z.string().datetime().or(z.date()),
    // ID
    id: z.number().int().positive(),
};
// Re-export Zod for convenience
export { z };
/**

 * Async validation helper for request handlers

 */
export async function validateRequest(schema, data, options) {
    if (options?.async) {
        return schema.parseAsync(data);
    }
    return validate(schema, data);
}
// ===========================================================================
//  Express request validation middleware
// ===========================================================================
/**

 * Express middleware: validate request body

 */
export function validateBody(schema) {
    return (req, _res, next) => {
        try {
            req.body = validate(schema, req.body);
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
/**

 * Express middleware: validate query parameters

 */
export function validateQuery(schema) {
    return (req, _res, next) => {
        try {
            req.query = validate(schema, req.query);
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
/**

 * Express middleware: validate URL parameters

 */
export function validateParams(schema) {
    return (req, _res, next) => {
        try {
            req.params = validate(schema, req.params);
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
//# sourceMappingURL=index.js.map