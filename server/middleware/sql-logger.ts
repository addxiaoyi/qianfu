/**
 * SQL 日志记录中间件 - server/middleware/sql-logger.ts
 *
 * 功能:
 * - SQL 执行日志记录
 * - 慢查询自动检测
 * - 查询性能指标收集
 * - 结构化日志输出
 */

import { logger } from '../lib/logger';
import { env } from '../config/env';

// ============================================================
// Types
// ============================================================

export interface SqlLogEntry {
  timestamp: string;
  query: string;
  params?: unknown[];
  duration: number;
  rowCount?: number;
  error?: string;
  requestId?: string;
  userId?: string | number;
  operation?: string;
  table?: string;
}

export interface SlowQueryConfig {
  /** 是否启用 SQL 日志 */
  enabled: boolean;
  /** 慢查询阈值 (毫秒) */
  threshold: number;
  /** 是否记录所有查询 */
  logAll: boolean;
  /** 最大日志长度 */
  maxQueryLength: number;
  /** 是否记录查询参数 */
  logParams: boolean;
  /** 是否包含 EXPLAIN ANALYZE */
  includeExplain: boolean;
  /** 忽略的查询模式 (正则表达式数组) */
  ignorePatterns: RegExp[];
}

interface QueryRecord {
  count: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  durations: number[];
  lastSeen: Date;
  query: string;
}

// ============================================================
// Configuration
// ============================================================

const defaultConfig: SlowQueryConfig = {
  enabled: true,
  threshold: 1000, // 1秒
  logAll: false,
  maxQueryLength: 1000,
  logParams: false,
  includeExplain: false,
  ignorePatterns: [/^SELECT 1$/i, /^SELECT NOW\(\)$/i],
};

const getConfig = (): SlowQueryConfig => {
  return {
    enabled: process.env.SQL_LOG_ENABLED !== 'false',
    threshold: parseInt(process.env.SQL_SLOW_QUERY_THRESHOLD || '1000', 10),
    logAll: process.env.SQL_LOG_ALL === 'true',
    maxQueryLength: parseInt(process.env.SQL_MAX_QUERY_LENGTH || '1000', 10),
    logParams: process.env.SQL_LOG_PARAMS === 'true',
    includeExplain: process.env.SQL_INCLUDE_EXPLAIN === 'true',
    ignorePatterns: defaultConfig.ignorePatterns,
  };
};

// ============================================================
// Query Buffer for Analysis
// ============================================================

const queryBuffer = new Map<string, QueryRecord>();
const BUFFER_SIZE = 1000;

function updateQueryBuffer(
  query: string,
  duration: number,
  requestId?: string,
  userId?: string | number
): void {
  const normalized = normalizeQuery(query);

  // 检查是否应该忽略
  const config = getConfig();
  if (config.ignorePatterns.some((pattern) => pattern.test(query))) {
    return;
  }

  let record = queryBuffer.get(normalized);
  if (!record) {
    if (queryBuffer.size >= BUFFER_SIZE) {
      // 删除最老的记录
      const oldestKey = queryBuffer.keys().next().value;
      if (oldestKey) queryBuffer.delete(oldestKey);
    }
    record = {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: duration,
      durations: [],
      lastSeen: new Date(),
      query: query.substring(0, 500),
    };
    queryBuffer.set(normalized, record);
  }

  record.count++;
  record.totalDuration += duration;
  record.avgDuration = record.totalDuration / record.count;
  record.maxDuration = Math.max(record.maxDuration, duration);
  record.minDuration = Math.min(record.minDuration, duration);
  record.lastSeen = new Date();

  // 保留最近 100 个耗时记录用于统计
  if (record.durations.length < 100) {
    record.durations.push(duration);
  } else {
    // 替换随机位置
    const idx = Math.floor(Math.random() * record.durations.length);
    record.durations[idx] = duration;
  }
}

// ============================================================
// Query Normalization
// ============================================================

function normalizeQuery(query: string): string {
  return query
    .replace(/\s+/g, ' ')
    .replace(/'/g, "''")
    .replace(/\d+\s*\.\s*\d+\s*\.\s*\d+\s*\.\s*\d+/g, '0.0.0.0') // IP 地址
    .replace(/\$\d+/g, '$N') // 参数占位符
    .trim()
    .substring(0, 200);
}

function truncateQuery(query: string, maxLength: number): string {
  if (query.length <= maxLength) return query;
  return query.substring(0, maxLength) + '...[truncated]';
}

function parseQueryLabels(query: string): { operation: string; table: string } {
  const normalized = query.replace(/\s+/g, ' ').trim().toUpperCase();

  // 提取操作类型
  let operation = 'other';
  if (normalized.startsWith('SELECT')) operation = 'SELECT';
  else if (normalized.startsWith('INSERT')) operation = 'INSERT';
  else if (normalized.startsWith('UPDATE')) operation = 'UPDATE';
  else if (normalized.startsWith('DELETE')) operation = 'DELETE';
  else if (normalized.startsWith('CREATE')) operation = 'CREATE';
  else if (normalized.startsWith('ALTER')) operation = 'ALTER';
  else if (normalized.startsWith('DROP')) operation = 'DROP';
  else if (normalized.startsWith('TRUNCATE')) operation = 'TRUNCATE';

  // 提取表名 (简化实现)
  let table = 'unknown';
  const fromMatch = normalized.match(/FROM\s+(\w+)/i);
  const intoMatch = normalized.match(/INTO\s+(\w+)/i);
  const updateMatch = normalized.match(/UPDATE\s+(\w+)/i);
  const deleteMatch = normalized.match(/DELETE\s+FROM\s+(\w+)/i);

  if (fromMatch) table = fromMatch[1].toLowerCase();
  else if (intoMatch) table = intoMatch[1].toLowerCase();
  else if (updateMatch) table = updateMatch[1].toLowerCase();
  else if (deleteMatch) table = deleteMatch[1].toLowerCase();

  return { operation, table };
}

// ============================================================
// SQL Logger
// ============================================================

export const sqlLogger = {
  debug(message: string, entry?: SqlLogEntry): void {
    if (!env.isProduction) {
      logger.debug(`[SQL] ${message}`, entry);
    }
  },

  info(message: string, entry?: SqlLogEntry): void {
    logger.info(`[SQL] ${message}`, entry);
  },

  warn(message: string, entry?: SqlLogEntry): void {
    logger.warn(`[SQL] ${message}`, entry);
  },

  error(message: string, error?: unknown, entry?: SqlLogEntry): void {
    logger.error(`[SQL] ${message}`, error, entry);
  },
};

// ============================================================
// Query Wrapper
// ============================================================

export interface QueryContext {
  requestId?: string;
  userId?: string | number;
}

/**
 * SQL 查询包装器 - 记录所有查询执行
 *
 * @param query SQL 查询语句
 * @param params 查询参数
 * @param operation 实际执行的操作
 * @param context 请求上下文
 * @returns 查询结果
 */
export async function wrapQuery<T>(
  query: string,
  params: unknown[],
  operation: () => Promise<T>,
  context: QueryContext = {}
): Promise<T> {
  const config = getConfig();

  // 检查是否禁用
  if (!config.enabled) {
    return operation();
  }

  // 检查是否应该忽略
  if (config.ignorePatterns.some((pattern) => pattern.test(query))) {
    return operation();
  }

  const startTime = process.hrtime.bigint();
  const labels = parseQueryLabels(query);

  // 增加活跃查询数
  try {
    const result = await operation();
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // ms

    const entry: SqlLogEntry = {
      timestamp: new Date().toISOString(),
      query: truncateQuery(query, config.maxQueryLength),
      params: config.logParams ? params : undefined,
      duration,
      operation: labels.operation,
      table: labels.table,
      requestId: context.requestId,
      userId: context.userId,
    };

    // 更新查询缓冲
    updateQueryBuffer(query, duration, context.requestId, context.userId);

    // 根据阈值决定日志级别
    if (duration > config.threshold) {
      sqlLogger.warn('Slow query detected', entry);
    } else if (config.logAll) {
      sqlLogger.debug('Query executed', entry);
    }

    return result;
  } catch (error) {
    const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const entry: SqlLogEntry = {
      timestamp: new Date().toISOString(),
      query: truncateQuery(query, config.maxQueryLength),
      params: config.logParams ? params : undefined,
      duration,
      error: errorMessage,
      operation: labels.operation,
      table: labels.table,
      requestId: context.requestId,
      userId: context.userId,
    };

    sqlLogger.error('Query failed', error, entry);
    throw error;
  }
}

/**
 * SQL 查询包装器 - 简化版本
 *
 * @param query SQL 查询语句
 * @param params 查询参数
 * @param operation 实际执行的操作
 * @returns 查询结果
 */
export async function withSqlLogging<T>(
  query: string,
  params: unknown[],
  operation: () => Promise<T>
): Promise<T> {
  return wrapQuery(query, params, operation);
}

// ============================================================
// Slow Query Detection
// ============================================================

export interface SlowQuery {
  id: string;
  query: string;
  count: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  totalDuration: number;
  lastSeen: Date;
  suggestion?: string;
}

export interface QueryAnalysis {
  slowQueries: SlowQuery[];
  totalQueries: number;
  totalDuration: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  queryCount: number;
}

/**
 * 获取慢查询分析报告
 *
 * @param limit 返回的慢查询数量
 * @param minCount 最少执行次数
 */
export function getSlowQueryAnalysis(limit: number = 20, minCount: number = 1): QueryAnalysis {
  const queries: SlowQuery[] = [];
  let totalQueries = 0;
  let totalDuration = 0;

  for (const [normalized, record] of queryBuffer) {
    totalQueries += record.count;
    totalDuration += record.totalDuration;

    if (record.count >= minCount) {
      queries.push({
        id: hashQuery(normalized),
        query: record.query,
        count: record.count,
        avgDuration: record.avgDuration,
        maxDuration: record.maxDuration,
        minDuration: record.minDuration,
        totalDuration: record.totalDuration,
        lastSeen: record.lastSeen,
        suggestion: generateSuggestion(record.query, record.avgDuration),
      });
    }
  }

  // 按平均耗时排序
  queries.sort((a, b) => b.avgDuration - a.avgDuration);

  // 计算百分位数
  const allDurations: number[] = [];
  for (const record of queryBuffer.values()) {
    allDurations.push(...record.durations);
  }
  allDurations.sort((a, b) => a - b);

  const p95Index = Math.floor(allDurations.length * 0.95);
  const p99Index = Math.floor(allDurations.length * 0.99);

  return {
    slowQueries: queries.slice(0, limit),
    totalQueries,
    totalDuration,
    avgDuration: totalQueries > 0 ? totalDuration / totalQueries : 0,
    p95Duration: allDurations[p95Index] || 0,
    p99Duration: allDurations[p99Index] || 0,
    queryCount: queryBuffer.size,
  };
}

/**
 * 获取当前缓冲区中的所有查询记录
 */
export function getAllQueries(): SlowQuery[] {
  const queries: SlowQuery[] = [];

  for (const [normalized, record] of queryBuffer) {
    queries.push({
      id: hashQuery(normalized),
      query: record.query,
      count: record.count,
      avgDuration: record.avgDuration,
      maxDuration: record.maxDuration,
      minDuration: record.minDuration,
      totalDuration: record.totalDuration,
      lastSeen: record.lastSeen,
      suggestion: generateSuggestion(record.query, record.avgDuration),
    });
  }

  return queries.sort((a, b) => b.avgDuration - a.avgDuration);
}

/**
 * 清除查询缓冲区
 */
export function clearQueryBuffer(): void {
  queryBuffer.clear();
  sqlLogger.info('Query buffer cleared');
}

// ============================================================
// Suggestions
// ============================================================

function generateSuggestion(query: string, avgDuration: number): string {
  const suggestions: string[] = [];
  const upperQuery = query.toUpperCase();
  const config = getConfig();

  // 阈值提示
  if (avgDuration > config.threshold) {
    suggestions.push(`执行时间 ${avgDuration.toFixed(0)}ms 超过阈值 ${config.threshold}ms`);
  }

  // 检查 SELECT *
  if (upperQuery.includes('SELECT *')) {
    suggestions.push('避免使用 SELECT *，只查询需要的字段');
  }

  // 检查是否缺少 LIMIT
  if (upperQuery.includes('SELECT') && !upperQuery.includes('LIMIT')) {
    suggestions.push('添加 LIMIT 限制返回行数');
  }

  // 检查 JOIN
  if (upperQuery.includes('JOIN')) {
    suggestions.push('检查 JOIN 条件，确保连接字段有索引');
    if (!upperQuery.includes('INDEX') && !upperQuery.includes('HINT')) {
      suggestions.push('考虑使用 EXPLAIN ANALYZE 分析 JOIN 效率');
    }
  }

  // 检查子查询
  if (upperQuery.match(/\(SELECT.*FROM/i)) {
    suggestions.push('考虑将子查询改写为 JOIN 或使用 WITH 语句');
  }

  // 检查 ORDER BY
  if (upperQuery.includes('ORDER BY')) {
    suggestions.push('检查 ORDER BY 字段是否有索引');
  }

  // 检查 LIKE 模糊查询
  if (upperQuery.includes('LIKE')) {
    suggestions.push('LIKE 前缀模糊查询会导致全表扫描，考虑使用全文索引');
  }

  // 检查 NOT IN / NOT EXISTS
  if (upperQuery.includes('NOT IN') || upperQuery.includes('NOT EXISTS')) {
    suggestions.push('NOT IN/NOT EXISTS 效率较低，考虑改写为 LEFT JOIN ... IS NULL');
  }

  // 检查 OR 条件
  if (upperQuery.match(/\bWHERE\b.*\bOR\b/i)) {
    suggestions.push('多个 OR 条件可能导致索引失效，考虑改写为 UNION');
  }

  if (suggestions.length === 0) {
    return '建议使用 EXPLAIN ANALYZE 分析执行计划';
  }

  return suggestions.join('; ');
}

function hashQuery(normalized: string): string {
  // 简化哈希，用于标识查询
  const hash = require('crypto').createHash('md5');
  hash.update(normalized);
  return hash.digest('hex').substring(0, 12);
}

// ============================================================
// Express Middleware
// ============================================================

/**
 * SQL 日志中间件工厂
 *
 * @param options 配置选项
 * @returns Express 中间件
 */
export function createSqlLogMiddleware(options: Partial<SlowQueryConfig> = {}) {
  const middlewareConfig = { ...defaultConfig, ...options };

  return (req: any, _res: any, next: () => void) => {
    // 将 SQL 日志上下文附加到请求对象
    req.sqlContext = {
      requestId: req.requestId || req.headers['x-request-id'],
      userId: req.user?.id,
      config: middlewareConfig,
    };
    next();
  };
}

// ============================================================
// Default Export
// ============================================================

export default {
  sqlLogger,
  wrapQuery,
  withSqlLogging,
  getSlowQueryAnalysis,
  getAllQueries,
  clearQueryBuffer,
  createSqlLogMiddleware,
};
