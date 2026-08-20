import { z } from 'zod';
export declare function emptyStringToUndefined(value: unknown): unknown;
export declare function optionalEnv<T extends z.ZodTypeAny>(schema: T): z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<T>>;
//# sourceMappingURL=envParsing.d.ts.map