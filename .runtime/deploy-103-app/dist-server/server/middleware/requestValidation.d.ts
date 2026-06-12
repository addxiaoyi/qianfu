import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
interface NormalizeOptions {
    trimStrings?: boolean;
    emptyStringAsUndefined?: boolean;
    nullAsUndefined?: boolean;
}
interface ValidationOptions extends NormalizeOptions {
    assignParsedData?: boolean;
    errorMessage?: string;
}
interface SchemaConfig {
    schema: ZodTypeAny;
    options?: ValidationOptions;
}
interface ValidateRequestConfig {
    body?: ZodTypeAny | SchemaConfig;
    query?: ZodTypeAny | SchemaConfig;
    params?: ZodTypeAny | SchemaConfig;
}
export declare function validateRequest(config: ValidateRequestConfig): RequestHandler;
export declare function validateBody(schema: ZodTypeAny, options?: ValidationOptions): RequestHandler;
export declare function validateQuery(schema: ZodTypeAny, options?: ValidationOptions): RequestHandler;
export declare function validateParams(schema: ZodTypeAny, options?: ValidationOptions): RequestHandler;
export {};
//# sourceMappingURL=requestValidation.d.ts.map