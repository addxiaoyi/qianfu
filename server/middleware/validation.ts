import { Request, Response, NextFunction } from 'express';
import { convertZodErrors, type ValidationErrorItem } from '../utils/zodError';
import { ZodSchema, ZodError } from 'zod';

export type { ValidationErrorItem };

export function zodValidationError(error: unknown): ValidationErrorItem[] {
  if (error instanceof ZodError) {
    return convertZodErrors(error);
  }
  return [];
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: convertZodErrors(error),
        });
      } else {
        next(error);
      }
    }
  };
}

export function validateHost(host: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(host);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isSafeHostname(hostname: string): boolean {
  const internalHostnames = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
  const privateIpPatterns = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^169\.254\./, /^127\./];

  if (internalHostnames.includes(hostname.toLowerCase())) {
    return false;
  }

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      return false;
    }
  }

  return true;
}
