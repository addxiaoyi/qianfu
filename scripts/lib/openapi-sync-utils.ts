import path from 'node:path';
import { NON_VERSIONED_API_PATHS } from '../../server/constants/api';

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonArray = JsonValue[];

const NON_VERSIONED_ROOTS = new Set(
  NON_VERSIONED_API_PATHS.filter((value) => value.startsWith('/api/')),
);

const DOC_PREFIX_BLACKLIST = new Set(['/api-docs']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeSwaggerPath(inputPath: string): string {
  if (!inputPath.startsWith('/api/')) {
    return inputPath;
  }

  if (inputPath.startsWith('/api/v')) {
    return inputPath;
  }

  if (DOC_PREFIX_BLACKLIST.has(inputPath) || NON_VERSIONED_ROOTS.has(inputPath)) {
    return inputPath;
  }

  const segments = inputPath.split('/').filter(Boolean);
  if (segments.length <= 2) {
    return inputPath;
  }

  const normalized = ['api', 'v1', ...segments.slice(2)].join('/');
  return `/${normalized}`;
}

export function rewriteOpenApiPaths(paths: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(paths).reduce<Record<string, unknown>>((acc, [rawPath, methods]) => {
    const normalizedPath = normalizeSwaggerPath(rawPath);
    if (!acc[normalizedPath]) {
      acc[normalizedPath] = methods;
      return acc;
    }

    if (!isRecord(acc[normalizedPath]) || !isRecord(methods)) {
      acc[normalizedPath] = methods;
      return acc;
    }

    acc[normalizedPath] = {
      ...acc[normalizedPath] as Record<string, unknown>,
      ...methods,
    };
    return acc;
  }, {});
}

export function sortObjectKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeysDeep(item)) as T;
  }

  if (!isRecord(value)) {
    return value;
  }

  const sortedEntries = Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, sortObjectKeysDeep(child)] as const);

  return Object.fromEntries(sortedEntries) as T;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortObjectKeysDeep(value), null, 2)}\n`;
}

export function buildOpenApiSpec(sourceSpec: Record<string, unknown>): Record<string, unknown> {
  const spec = JSON.parse(JSON.stringify(sourceSpec)) as Record<string, unknown>;
  const paths = isRecord(spec.paths) ? (spec.paths as Record<string, unknown>) : {};
  const normalizedPaths = rewriteOpenApiPaths(paths);

  const nextSpec: Record<string, unknown> = {
    ...spec,
    info: {
      ...(isRecord(spec.info) ? spec.info : {}),
      title: 'QianFu API (generated)',
    },
    paths: normalizedPaths,
  };

  return nextSpec;
}

export const OPENAPI_OUTPUT_PATH = path.resolve(process.cwd(), 'docs/openapi.generated.json');
