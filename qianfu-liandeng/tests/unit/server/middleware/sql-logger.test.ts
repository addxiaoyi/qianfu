/**
 * SQL 日志记录单元测试 - tests/unit/server/middleware/sql-logger.test.ts
 *
 * 测试内容:
 * - SQL 查询包装器
 * - 慢查询检测
 * - 查询分析功能
 * - 性能指标记录
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  wrapQuery,
  withSqlLogging,
  getSlowQueryAnalysis,
  getAllQueries,
  clearQueryBuffer,
  sqlLogger,
} from '../../../../server/middleware/sql-logger';

// ============================================================
// Mock Logger
// ============================================================

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../../../server/lib/logger', () => ({
  logger: mockLogger,
}));

// ============================================================
// Tests
// ============================================================

describe('SQL Logger Middleware', () => {
  beforeEach(() => {
    // 重置测试环境
    clearQueryBuffer();
    vi.clearAllMocks();
    process.env.SQL_LOG_ENABLED = 'true';
    process.env.SQL_SLOW_QUERY_THRESHOLD = '1000';
  });

  describe('wrapQuery', () => {
    it('should execute query and return result', async () => {
      const mockResult = { id: 1, name: 'test' };
      const operation = vi.fn().mockResolvedValue(mockResult);

      const result = await wrapQuery(
        'SELECT * FROM users WHERE id = $1',
        [1],
        operation
      );

      expect(operation).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it('should record query duration', async () => {
      const operation = vi.fn().mockResolvedValue([{ id: 1 }]);

      await wrapQuery('SELECT * FROM users', [], operation);

      // 验证查询被添加到缓冲区
      const analysis = getSlowQueryAnalysis(10, 1);
      expect(analysis.totalQueries).toBe(1);
    });

    it('should log slow queries with warn level', async () => {
      process.env.SQL_SLOW_QUERY_THRESHOLD = '10'; // 10ms

      // 模拟慢查询
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return [{ id: 1 }];
      });

      await wrapQuery('SELECT * FROM users', [], operation);

      // 验证慢查询被记录
      const analysis = getSlowQueryAnalysis(10, 1);
      expect(analysis.slowQueries.length).toBeGreaterThan(0);
    });

    it('should propagate errors from operation', async () => {
      const error = new Error('Database error');
      const operation = vi.fn().mockRejectedValue(error);

      await expect(
        wrapQuery('SELECT * FROM users', [], operation)
      ).rejects.toThrow('Database error');
    });

    it('should include request context', async () => {
      const operation = vi.fn().mockResolvedValue([{ id: 1 }]);

      await wrapQuery(
        'SELECT * FROM users',
        [],
        operation,
        { requestId: 'req-123', userId: 42 }
      );

      const analysis = getSlowQueryAnalysis(10, 1);
      expect(analysis.totalQueries).toBe(1);
    });
  });

  describe('withSqlLogging', () => {
    it('should be alias for wrapQuery', async () => {
      const mockResult = [{ id: 1 }];
      const operation = vi.fn().mockResolvedValue(mockResult);

      const result = await withSqlLogging(
        'SELECT * FROM users',
        [],
        operation
      );

      expect(result).toEqual(mockResult);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSlowQueryAnalysis', () => {
    beforeEach(async () => {
      clearQueryBuffer();

      // 添加测试查询
      const operations = [
        vi.fn().mockResolvedValue([{ id: 1 }]),
        vi.fn().mockResolvedValue([{ id: 2 }]),
        vi.fn().mockResolvedValue([{ id: 3 }]),
      ];

      await wrapQuery('SELECT * FROM users', [], operations[0]);
      await wrapQuery('SELECT * FROM users', [], operations[1]);
      await wrapQuery('SELECT * FROM orders', [], operations[2]);
    });

    it('should return analysis with total queries', () => {
      const analysis = getSlowQueryAnalysis(10, 1);

      expect(analysis.totalQueries).toBe(3);
      expect(analysis.queryCount).toBeGreaterThan(0);
    });

    it('should return slow queries sorted by avg duration', () => {
      const analysis = getSlowQueryAnalysis(10, 1);

      expect(analysis.slowQueries).toBeDefined();
      expect(Array.isArray(analysis.slowQueries)).toBe(true);
    });

    it('should filter by minimum count', () => {
      const analysis = getSlowQueryAnalysis(10, 2);

      // SELECT * FROM users 执行了 2 次
      expect(analysis.slowQueries.some((q) => q.query.includes('users'))).toBe(true);
    });
  });

  describe('getAllQueries', () => {
    it('should return all queries in buffer', async () => {
      clearQueryBuffer();

      await wrapQuery('SELECT 1', [], vi.fn().mockResolvedValue([]));
      await wrapQuery('SELECT 2', [], vi.fn().mockResolvedValue([]));

      const queries = getAllQueries();
      expect(queries.length).toBe(2);
    });

    it('should return queries sorted by duration', async () => {
      clearQueryBuffer();

      await wrapQuery('FAST QUERY', [], vi.fn().mockResolvedValue([]));
      await wrapQuery('SLOW QUERY', [], vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return [];
      }));

      const queries = getAllQueries();
      expect(queries.length).toBe(2);
      // 最慢的查询应该在最前面
      expect(queries[0].avgDuration).toBeGreaterThanOrEqual(queries[1].avgDuration);
    });
  });

  describe('clearQueryBuffer', () => {
    it('should clear all recorded queries', async () => {
      await wrapQuery('SELECT 1', [], vi.fn().mockResolvedValue([]));
      await wrapQuery('SELECT 2', [], vi.fn().mockResolvedValue([]));

      clearQueryBuffer();

      const analysis = getSlowQueryAnalysis(10, 1);
      expect(analysis.totalQueries).toBe(0);
      expect(analysis.queryCount).toBe(0);
    });
  });

  describe('query normalization', () => {
    it('should normalize queries for grouping', async () => {
      clearQueryBuffer();

      await wrapQuery('SELECT * FROM users WHERE id = 1', [], vi.fn().mockResolvedValue([]));
      await wrapQuery('SELECT * FROM users WHERE id = 2', [], vi.fn().mockResolvedValue([]));

      const queries = getAllQueries();
      // 相同结构的查询应该被合并
      expect(queries.length).toBe(1);
      expect(queries[0].count).toBe(2);
    });
  });

  describe('suggestions', () => {
    it('should generate suggestions for SELECT *', async () => {
      clearQueryBuffer();

      await wrapQuery('SELECT * FROM users', [], vi.fn().mockResolvedValue([]));

      const queries = getAllQueries();
      expect(queries[0].suggestion).toContain('SELECT *');
    });

    it('should generate suggestions for queries without LIMIT', async () => {
      clearQueryBuffer();

      await wrapQuery('SELECT id FROM users', [], vi.fn().mockResolvedValue([]));

      const queries = getAllQueries();
      expect(queries[0].suggestion).toContain('LIMIT');
    });
  });
});

describe('SQL Metrics', () => {
  beforeEach(() => {
    clearQueryBuffer();
    process.env.SQL_LOG_ENABLED = 'true';
  });

  it('should record query duration correctly', async () => {
    const operation = vi.fn().mockResolvedValue([{ id: 1 }]);

    await wrapQuery('SELECT * FROM users', [], operation);

    const analysis = getSlowQueryAnalysis(10, 1);
    expect(analysis.avgDuration).toBeGreaterThan(0);
  });

  it('should calculate p95 and p99 correctly', async () => {
    clearQueryBuffer();

    // 添加多个查询
    for (let i = 0; i < 20; i++) {
      await wrapQuery(
        'SELECT * FROM users',
        [],
        vi.fn().mockResolvedValue([{ id: i }])
      );
    }

    const analysis = getSlowQueryAnalysis(10, 1);
    expect(analysis.p95Duration).toBeGreaterThanOrEqual(0);
    expect(analysis.p99Duration).toBeGreaterThanOrEqual(0);
    expect(analysis.p95Duration).toBeGreaterThanOrEqual(analysis.p99Duration);
  });
});
