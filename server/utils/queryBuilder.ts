export type SortOrder = 'asc' | 'desc';

export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface DateRangeInput {
  startDate?: Date;
  endDate?: Date;
}

export function buildPagination(input: PaginationInput): PaginationResult {
  const page = Number.isFinite(input.page) ? Math.max(1, input.page) : 1;
  const limit = Number.isFinite(input.limit) ? Math.max(1, input.limit) : 20;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function normalizeKeyword(keyword?: string | null): string | undefined {
  if (!keyword) return undefined;
  const normalized = keyword.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

export function buildDateRange(input: DateRangeInput): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (input.startDate instanceof Date) {
    range.gte = input.startDate;
  }
  if (input.endDate instanceof Date) {
    range.lte = input.endDate;
  }
  return range.gte || range.lte ? range : undefined;
}

export function resolveSortField<T extends string>(
  inputField: string | undefined,
  allowedFields: readonly T[],
  fallbackField: T,
): T {
  if (!inputField) {
    return fallbackField;
  }
  return (allowedFields as readonly string[]).includes(inputField)
    ? (inputField as T)
    : fallbackField;
}

export function resolveSortOrder(inputOrder?: string, fallback: SortOrder = 'desc'): SortOrder {
  if (!inputOrder) return fallback;
  return inputOrder === 'asc' ? 'asc' : inputOrder === 'desc' ? 'desc' : fallback;
}

export function buildStringMatch(value: string, fuzzy: boolean = true): Record<string, string> {
  return fuzzy ? { contains: value } : { equals: value };
}

export function buildKeywordOrConditions(
  fields: string[],
  keyword: string | undefined,
  fuzzy: boolean = true,
): Record<string, unknown>[] {
  if (!keyword) return [];
  const matcher = buildStringMatch(keyword, fuzzy);
  return fields.map((field) => ({
    [field]: matcher,
  }));
}
