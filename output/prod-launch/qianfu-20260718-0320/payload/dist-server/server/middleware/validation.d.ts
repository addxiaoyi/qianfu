import { Request, Response, NextFunction } from 'express';
import { type ValidationErrorItem } from '../utils/zodError';
import { ZodSchema } from 'zod';
export type { ValidationErrorItem };
export declare function zodValidationError(error: unknown): ValidationErrorItem[];
export declare function validate(schema: ZodSchema): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateHost(host: string): boolean;
export declare function validateUrl(url: string): boolean;
export declare function isSafeHostname(hostname: string): boolean;
//# sourceMappingURL=validation.d.ts.map