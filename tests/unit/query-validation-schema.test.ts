import { describe, expect, it } from 'vitest';
import {
  auditLogQuerySchema,
  paginationQuerySchema,
  paymentQuerySchema,
  ticketQuerySchema,
  userQuerySchema,
} from '../../server/utils/validation';

describe('query validation schemas', () => {
  it('paginationQuerySchema should normalize aliases and defaults', () => {
    const result = paginationQuerySchema.safeParse({
      q: '  mini game  ',
      order: 'asc',
      page: '2',
      limit: '30',
      fuzzy: 'false',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T23:59:59.999Z',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.search).toBe('mini game');
    expect(result.data.sortOrder).toBe('asc');
    expect(result.data.page).toBe(2);
    expect(result.data.limit).toBe(30);
    expect(result.data.fuzzy).toBe(false);
    expect(result.data.startDate).toBeInstanceOf(Date);
    expect(result.data.endDate).toBeInstanceOf(Date);
  });

  it('userQuerySchema should support q alias and fuzzy toggle', () => {
    const result = userQuerySchema.safeParse({
      q: 'alice',
      fuzzy: 'false',
      status: 'verified',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.search).toBe('alice');
    expect(result.data.fuzzy).toBe(false);
    expect(result.data.status).toBe('verified');
    expect(result.data.sortOrder).toBe('desc');
  });

  it('paymentQuerySchema should parse userId and fuzzy defaults', () => {
    const result = paymentQuerySchema.safeParse({
      userId: '42',
      search: 'wechat',
      order: 'asc',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.userId).toBe(42);
    expect(result.data.search).toBe('wechat');
    expect(result.data.sortOrder).toBe('asc');
    expect(result.data.fuzzy).toBe(true);
  });

  it('ticketQuerySchema should reject invalid date', () => {
    const result = ticketQuerySchema.safeParse({
      startDate: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });

  it('auditLogQuerySchema should normalize search alias and page defaults', () => {
    const result = auditLogQuerySchema.safeParse({
      q: 'UPDATE_USER_ROLE',
      page: '0',
      limit: '999',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.search).toBe('UPDATE_USER_ROLE');
    expect(result.data.page).toBe(1);
    expect(result.data.limit).toBe(100);
    expect(result.data.sortOrder).toBe('desc');
  });
});
