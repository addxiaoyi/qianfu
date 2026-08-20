/**
 * SQL 性能管理路由 - server/routes/sql-management.ts
 *
 * 功能:
 * - SQL 性能分析报告
 * - 慢查询列表查询
 * - 查询缓冲管理
 */

import { Router, Request, Response } from 'express';
import { getSlowQueryAnalysis, getAllQueries, clearQueryBuffer } from '../middleware/sql-logger';
import { sqlLogger } from '../middleware/sql-logger';
import { logger } from '../lib/logger';

const router = Router();

// ============================================================
// Types
// ============================================================

interface PaginationQuery {
  limit?: string;
  page?: string;
  minCount?: string;
}

interface AnalysisQuery extends PaginationQuery {
  threshold?: string;
}

// ============================================================
// Middleware
// ============================================================

/**
 * 管理员认证中间件 (简化版 - 生产环境需要完整实现)
 */
function adminAuth(req: Request, res: Response, next: () => void): void {
  // 检查是否有管理员权限
  // 生产环境应该检查 req.user.role 或类似字段
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_API_KEY || 'dev-admin-key';

  if (process.env.NODE_ENV === 'production' && adminKey !== expectedKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: '管理员认证失败',
    });
    return;
  }

  next();
}

// ============================================================
// Routes
// ============================================================

/**
 * GET /api/admin/sql/analysis
 * 获取 SQL 性能分析报告
 *
 * Query Parameters:
 * - limit: 返回的慢查询数量 (默认 20)
 * - minCount: 最少执行次数 (默认 1)
 * - threshold: 慢查询阈值(ms) (默认从环境变量读取)
 */
router.get('/analysis', adminAuth, (req: Request, res: Response) => {
  try {
    const { limit = '20', minCount = '1' } = req.query as PaginationQuery;

    const analysis = getSlowQueryAnalysis(
      parseInt(limit, 10),
      parseInt(minCount, 10)
    );

    sqlLogger.info('SQL analysis requested', {
      timestamp: new Date().toISOString(),
      query: 'GET /analysis',
      duration: 0,
      requestId: req.headers['x-request-id'] as string,
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalQueries: analysis.totalQueries,
          uniqueQueries: analysis.queryCount,
          avgDuration: analysis.avgDuration.toFixed(2) + 'ms',
          p95Duration: analysis.p95Duration.toFixed(2) + 'ms',
          p99Duration: analysis.p99Duration.toFixed(2) + 'ms',
          totalDuration: analysis.totalDuration.toFixed(2) + 'ms',
        },
        slowQueries: analysis.slowQueries.map((q) => ({
          id: q.id,
          query: q.query,
          count: q.count,
          avgDuration: q.avgDuration.toFixed(2) + 'ms',
          maxDuration: q.maxDuration.toFixed(2) + 'ms',
          minDuration: q.minDuration.toFixed(2) + 'ms',
          totalDuration: q.totalDuration.toFixed(2) + 'ms',
          lastSeen: q.lastSeen.toISOString(),
          suggestion: q.suggestion,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get SQL analysis', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SQL analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/sql/slow-queries
 * 获取慢查询列表
 *
 * Query Parameters:
 * - limit: 返回数量 (默认 50)
 * - minCount: 最少执行次数 (默认 1)
 */
router.get('/slow-queries', adminAuth, (req: Request, res: Response) => {
  try {
    const { limit = '50', minCount = '1' } = req.query as PaginationQuery;

    const queries = getAllQueries();
    const minExecCount = parseInt(minCount, 10);
    const maxResults = parseInt(limit, 10);

    const slowQueries = queries
      .filter((q) => q.count >= minExecCount)
      .slice(0, maxResults);

    res.json({
      success: true,
      data: {
        count: slowQueries.length,
        queries: slowQueries.map((q) => ({
          id: q.id,
          query: q.query,
          count: q.count,
          avgDuration: q.avgDuration.toFixed(2) + 'ms',
          maxDuration: q.maxDuration.toFixed(2) + 'ms',
          suggestion: q.suggestion,
          lastSeen: q.lastSeen.toISOString(),
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get slow queries', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get slow queries',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/sql/query/:id
 * 获取特定查询详情
 */
router.get('/query/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const queries = getAllQueries();
    const query = queries.find((q) => q.id === id);

    if (!query) {
      res.status(404).json({
        success: false,
        error: 'Query not found',
        message: `No query found with id: ${id}`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: query.id,
        query: query.query,
        count: query.count,
        avgDuration: query.avgDuration.toFixed(2) + 'ms',
        maxDuration: query.maxDuration.toFixed(2) + 'ms',
        minDuration: query.minDuration.toFixed(2) + 'ms',
        totalDuration: query.totalDuration.toFixed(2) + 'ms',
        lastSeen: query.lastSeen.toISOString(),
        suggestion: query.suggestion,
        recommendation: generateRecommendation(query),
      },
    });
  } catch (error) {
    logger.error('Failed to get query details', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get query details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/admin/sql/buffer
 * 清除查询缓冲区
 */
router.delete('/buffer', adminAuth, (req: Request, res: Response) => {
  try {
    clearQueryBuffer();

    logger.info('SQL buffer cleared by admin', {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string,
      userId: req.user?.id || 'unknown',
    });

    res.json({
      success: true,
      message: 'Query buffer cleared successfully',
    });
  } catch (error) {
    logger.error('Failed to clear query buffer', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear buffer',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/sql/config
 * 获取 SQL 日志配置
 */
router.get('/config', adminAuth, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: process.env.SQL_LOG_ENABLED !== 'false',
      slowQueryThreshold: process.env.SQL_SLOW_QUERY_THRESHOLD || '1000',
      logAllQueries: process.env.SQL_LOG_ALL === 'true',
      maxQueryLength: process.env.SQL_MAX_QUERY_LENGTH || '1000',
      logParams: process.env.SQL_LOG_PARAMS === 'true',
      includeExplain: process.env.SQL_INCLUDE_EXPLAIN === 'true',
      bufferSize: 1000,
    },
  });
});

/**
 * GET /api/admin/sql/stats
 * 获取实时统计信息
 */
router.get('/stats', adminAuth, (_req: Request, res: Response) => {
  try {
    const analysis = getSlowQueryAnalysis(1000, 1);

    res.json({
      success: true,
      data: {
        realtime: {
          totalQueries: analysis.totalQueries,
          uniqueQueries: analysis.queryCount,
          avgDuration: analysis.avgDuration.toFixed(2) + 'ms',
          p95Duration: analysis.p95Duration.toFixed(2) + 'ms',
          p99Duration: analysis.p99Duration.toFixed(2) + 'ms',
        },
        thresholds: {
          slowQuery: process.env.SQL_SLOW_QUERY_THRESHOLD || '1000',
        },
        database: {
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'postgres',
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get SQL stats', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SQL stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================
// Helper Functions
// ============================================================

function generateRecommendation(query: ReturnType<typeof getAllQueries>[number]): string {
  const recommendations: string[] = [];
  const upperQuery = query.query.toUpperCase();

  // 基于查询特征生成建议
  if (upperQuery.includes('SELECT *')) {
    recommendations.push(
      '优化建议: 避免使用 SELECT *，明确指定需要的字段以减少数据传输量。'
    );
  }

  if (upperQuery.includes('JOIN') && !upperQuery.includes('INDEX')) {
    recommendations.push(
      '优化建议: 检查 JOIN 操作的字段是否有适当的索引。'
    );
  }

  if (upperQuery.match(/LIKE\s+['"]%/) || upperQuery.match(/LIKE\s+['"][^'"]*%/)) {
    recommendations.push(
      '优化建议: 前缀通配符的 LIKE 查询无法使用索引，考虑使用全文索引或前缀索引。'
    );
  }

  if (upperQuery.includes('ORDER BY') && !upperQuery.includes('INDEX')) {
    recommendations.push(
      '优化建议: ORDER BY 的字段如果没有索引，会导致额外的排序开销。'
    );
  }

  if (upperQuery.includes('NOT IN') || upperQuery.includes('NOT EXISTS')) {
    recommendations.push(
      '优化建议: NOT IN/NOT EXISTS 可能效率较低，考虑改写为 LEFT JOIN ... IS NULL。'
    );
  }

  if (!upperQuery.includes('LIMIT') && upperQuery.startsWith('SELECT')) {
    recommendations.push(
      '优化建议: 没有 LIMIT 限制可能导致返回过多数据，考虑添加 LIMIT。'
    );
  }

  if (recommendations.length === 0) {
    return '优化建议: 建议使用 EXPLAIN ANALYZE 查看实际执行计划以进一步分析。';
  }

  return recommendations.join('\n');
}

// ============================================================
// Export
// ============================================================

export default router;
