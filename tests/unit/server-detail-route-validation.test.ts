import { describe, expect, it } from 'vitest';
import { isNumericRouteId, isServerRouteId } from '../../qianfu-liandeng/src/utils/routeParams';

describe('server detail route validation', () => {
  it('matches the backend numeric id parameter contract', () => {
    expect(isNumericRouteId('1')).toBe(true);
    expect(isNumericRouteId('001')).toBe(true);
    expect(isNumericRouteId('9876543210')).toBe(true);

    expect(isNumericRouteId(undefined)).toBe(false);
    expect(isNumericRouteId(null)).toBe(false);
    expect(isNumericRouteId('')).toBe(false);
    expect(isNumericRouteId('abc')).toBe(false);
    expect(isNumericRouteId('12abc')).toBe(false);
    expect(isNumericRouteId('-1')).toBe(false);
    expect(isNumericRouteId(' 12 ')).toBe(false);
  });
});

it('accepts Rust v2 UUID route ids while retaining numeric ids', () => {
  expect(isServerRouteId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  expect(isServerRouteId('550e8400-e29b-71d4-a716-446655440000')).toBe(false);
  expect(isServerRouteId('550e8400-e29b-41d4-c716-446655440000')).toBe(false);
});
