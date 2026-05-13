import { describe, expect, it } from 'vitest';
import { buildBatchSummary, resolveResponseMessage } from '../../server/contracts/responseSemantics';

describe('response semantics', () => {
  it('should build operation messages with resource placeholders', () => {
    expect(resolveResponseMessage('create', { resource: 'Ticket', locale: 'en-US' })).toBe(
      'Ticket created successfully',
    );
    expect(resolveResponseMessage('update', { resource: '工单', locale: 'zh-CN' })).toBe(
      '工单更新成功',
    );
    expect(resolveResponseMessage('empty', { resource: 'Ticket', locale: 'en-US' })).toBe(
      'No Ticket found',
    );
  });

  it('should support custom message override', () => {
    expect(
      resolveResponseMessage('batch', {
        resource: 'Review',
        message: 'Custom batch message',
      }),
    ).toBe('Custom batch message');
  });

  it('should summarize batch results consistently', () => {
    expect(
      buildBatchSummary([
        { success: true },
        { success: false },
        { success: true },
      ]),
    ).toEqual({
      total: 3,
      successful: 2,
      failed: 1,
    });
  });
});
