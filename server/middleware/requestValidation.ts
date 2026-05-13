import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodIssue, ZodTypeAny } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

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

interface ValidationMiddlewareError extends Error {
  statusCode: number;
  errorCode: string;
  details: unknown;
  isOperational: boolean;
}

const defaultNormalizeOptions: Record<RequestPart, NormalizeOptions> = {
  body: {
    trimStrings: true,
    emptyStringAsUndefined: true,
    nullAsUndefined: false,
  },
  query: {
    trimStrings: true,
    emptyStringAsUndefined: true,
    nullAsUndefined: true,
  },
  params: {
    trimStrings: true,
    emptyStringAsUndefined: false,
    nullAsUndefined: false,
  },
};

function isSchemaConfig(input: ZodTypeAny | SchemaConfig): input is SchemaConfig {
  return typeof input === 'object' && input !== null && 'schema' in input;
}

function getSchemaConfig(input?: ZodTypeAny | SchemaConfig): SchemaConfig | null {
  if (!input) return null;
  return isSchemaConfig(input) ? input : { schema: input };
}

function normalizeValue(value: unknown, options: NormalizeOptions): unknown {
  if (value === null) {
    return options.nullAsUndefined ? undefined : value;
  }

  if (typeof value === 'string') {
    const trimmed = options.trimStrings ? value.trim() : value;
    if (options.emptyStringAsUndefined && trimmed === '') {
      return undefined;
    }
    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, options));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeValue(v, options)]);
    return Object.fromEntries(entries);
  }

  return value;
}

function formatIssues(part: RequestPart, issues: ZodIssue[]) {
  return issues.map((issue) => ({
    source: part,
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

function createValidationError(message: string, details: unknown): ValidationMiddlewareError {
  const err = new Error(message) as ValidationMiddlewareError;
  err.statusCode = 400;
  err.errorCode = 'VALIDATION_ERROR';
  err.details = details;
  err.isOperational = true;
  return err;
}

function validatePart(
  req: Request,
  part: RequestPart,
  schemaConfig: SchemaConfig,
): void {
  const opts = {
    ...defaultNormalizeOptions[part],
    ...(schemaConfig.options ?? {}),
  };

  const rawValue = (req as any)[part];
  const normalized = normalizeValue(rawValue, opts);
  const parsed = schemaConfig.schema.safeParse(normalized);

  if (!parsed.success) {
    throw createValidationError(
      schemaConfig.options?.errorMessage ?? `Invalid ${part} parameters`,
      formatIssues(part, parsed.error.issues),
    );
  }

  const nextValue = opts.assignParsedData ? parsed.data : normalized;
  if (part === 'body') {
    (req as any)[part] = nextValue;
    return;
  }

  const currentValue = (req as any)[part];
  if (currentValue && typeof currentValue === 'object' && nextValue && typeof nextValue === 'object') {
    for (const key of Object.keys(currentValue)) {
      delete (currentValue as Record<string, unknown>)[key];
    }
    Object.assign(currentValue, nextValue as Record<string, unknown>);
    return;
  }

  (req as any)[part] = nextValue;
}

export function validateRequest(config: ValidateRequestConfig): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const bodyCfg = getSchemaConfig(config.body);
      const queryCfg = getSchemaConfig(config.query);
      const paramsCfg = getSchemaConfig(config.params);

      if (bodyCfg) validatePart(req, 'body', bodyCfg);
      if (queryCfg) validatePart(req, 'query', queryCfg);
      if (paramsCfg) validatePart(req, 'params', paramsCfg);

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateBody(schema: ZodTypeAny, options?: ValidationOptions): RequestHandler {
  return validateRequest({ body: { schema, options } });
}

export function validateQuery(schema: ZodTypeAny, options?: ValidationOptions): RequestHandler {
  return validateRequest({ query: { schema, options } });
}

export function validateParams(schema: ZodTypeAny, options?: ValidationOptions): RequestHandler {
  return validateRequest({ params: { schema, options } });
}
