import { z } from 'zod';

export function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export function optionalEnv<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(emptyStringToUndefined, schema.optional());
}
