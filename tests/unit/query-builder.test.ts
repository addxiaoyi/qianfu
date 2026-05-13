import { describe, expect, it } from 'vitest';
import {
  buildDateRange,
  buildKeywordOrConditions,
  buildPagination,
  buildStringMatch,
  normalizeKeyword,
  resolveSortField,
  resolveSortOrder,
} from '../../server/utils/queryBuilder';

describe('queryBuilder', () => {
  it('buildPagination should clamp invalid values and return skip/take', () => {
    const result = buildPagination({ page: 0, limit: -1 });
    expect(result).toEqual({
      page: 1,
      limit: 1,
      skip: 0,
      take: 1,
    });
  });

  it('normalizeKeyword should trim and collapse spaces', () => {
    expect(normalizeKeyword('   alpha    beta   ')).toBe('alpha beta');
    expect(normalizeKeyword('   ')).toBeUndefined();
    expect(normalizeKeyword(undefined)).toBeUndefined();
  });

  it('buildDateRange should create inclusive range', () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const endDate = new Date('2026-01-31T23:59:59.999Z');
    expect(buildDateRange({ startDate, endDate })).toEqual({ gte: startDate, lte: endDate });
    expect(buildDateRange({})).toBeUndefined();
  });

  it('resolveSortField should fallback for non-whitelisted field', () => {
    const allowed = ['created_at', 'updated_at'] as const;
    expect(resolveSortField('updated_at', allowed, 'created_at')).toBe('updated_at');
    expect(resolveSortField('unknown', allowed, 'created_at')).toBe('created_at');
  });

  it('resolveSortOrder should normalize sort direction', () => {
    expect(resolveSortOrder('asc')).toBe('asc');
    expect(resolveSortOrder('desc')).toBe('desc');
    expect(resolveSortOrder('bad', 'asc')).toBe('asc');
  });

  it('buildStringMatch and buildKeywordOrConditions should switch fuzzy/exact mode', () => {
    expect(buildStringMatch('hello', true)).toEqual({ contains: 'hello' });
    expect(buildStringMatch('hello', false)).toEqual({ equals: 'hello' });

    expect(buildKeywordOrConditions(['title', 'description'], 'abc', false)).toEqual([
      { title: { equals: 'abc' } },
      { description: { equals: 'abc' } },
    ]);
    expect(buildKeywordOrConditions(['title'], undefined, true)).toEqual([]);
  });
});
