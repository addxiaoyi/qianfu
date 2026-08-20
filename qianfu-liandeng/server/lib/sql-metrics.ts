/**
 * SQL 性能指标 - server/lib/sql-metrics.ts
 *
 * 功能:
 * - SQL 查询 Prometheus 指标
 * - 查询性能直方图
 * - 慢查询计数器
 * - 活跃查询监控
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

// ============================================================
// Metrics 定义
// ============================================================

const register = new Registry();

/** SQL 查询总数 */
export const sqlQueryTotal = new Counter({
  name: 'sql_queries_total',
  help: 'Total number of SQL queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

/** SQL 查询耗时直方图 */
export const sqlQueryDuration = new Histogram({
  name: 'sql_query_duration_seconds',
  help: 'SQL query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/** 慢查询计数器 */
export const slowQueryTotal = new Counter({
  name: 'slow_queries_total',
  help: 'Total number of slow queries (queries exceeding threshold)',
  labelNames: ['operation', 'table', 'threshold_ms'],
  registers: [register],
});

/** SQL 查询错误数 */
export const sqlQueryErrors = new Counter({
  name: 'sql_query_errors_total',
  help: 'Total number of SQL query errors',
  labelNames: ['operation', 'table', 'error_type'],
  registers: [register],
});

/** 当前活跃查询数 */
export const activeQueries = new Gauge({
  name: 'sql_active_queries',
  help: 'Number of currently active SQL queries',
  labelNames: ['operation'],
  registers: [register],
});

/** 查询结果行数 */
export const sqlQueryRowCount = new Histogram({
  name: 'sql_query_row_count',
  help: 'Number of rows returned by SQL queries',
  labelNames: ['operation', 'table'],
  buckets: [0, 1, 10, 50, 100, 500, 1000, 5000, 10000, 50000],
  registers: [register],
});

/** 查询延迟百分位数 (自定义指标) */
export const sqlQueryLatencyP95 = new Gauge({
  name: 'sql_query_latency_p95_seconds',
  help: 'P95 latency for SQL queries in seconds',
  labelNames: ['operation', 'table'],
  registers: [register],
});

/** 查询延迟百分位数 (自定义指标) */
export const sqlQueryLatencyP99 = new Gauge({
  name: 'sql_query_latency_p99_seconds',
  help: 'P99 latency for SQL queries in seconds',
  labelNames: ['operation', 'table'],
  registers: [register],
});

/** 连接池使用情况 */
export const dbConnectionPoolUsed = new Gauge({
  name: 'db_connection_pool_used',
  help: 'Number of used database connections',
  registers: [register],
});

/** 连接池空闲数 */
export const dbConnectionPoolIdle = new Gauge({
  name: 'db_connection_pool_idle',
  help: 'Number of idle database connections',
  registers: [register],
});

/** 连接池等待数 */
export const dbConnectionPoolWaiting = new Gauge({
  name: 'db_connection_pool_waiting',
  help: 'Number of queries waiting for a connection',
  registers: [register],
});

// ============================================================
// Query Duration Aggregator (用于计算百分位数)
// ============================================================

interface DurationBucket {
  operation: string;
  table: string;
  durations: number[];
  maxSamples: number;
}

const durationBuckets = new Map<string, DurationBucket>();

function getDurationBucket(operation: string, table: string): DurationBucket {
  const key = `${operation}:${table}`;
  let bucket = durationBuckets.get(key);

  if (!bucket) {
    bucket = {
      operation,
      table,
      durations: [],
      maxSamples: 1000, // 保留最近 1000 个样本
    };
    durationBuckets.set(key, bucket);
  }

  return bucket;
}

function recordDuration(operation: string, table: string, durationMs: number): void {
  const bucket = getDurationBucket(operation, table);

  // 添加新样本
  bucket.durations.push(durationMs);

  // 限制样本数量
  if (bucket.durations.length > bucket.maxSamples) {
    bucket.durations.shift();
  }

  // 更新百分位数指标
  updateLatencyMetrics(operation, table);
}

function updateLatencyMetrics(operation: string, table: string): void {
  const bucket = getDurationBucket(operation, table);
  const durations = [...bucket.durations].sort((a, b) => a - b);

  if (durations.length === 0) return;

  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  const p95Value = durations[p95Index] || 0;
  const p99Value = durations[p99Index] || 0;

  sqlQueryLatencyP95.set({ operation, table }, p95Value / 1000);
  sqlQueryLatencyP99.set({ operation, table }, p99Value / 1000);
}

// ============================================================
// Metrics Record Functions
// ============================================================

/**
 * 记录查询指标
 */
export function recordQueryMetrics(
  query: string,
  durationMs: number,
  rowCount?: number
): void {
  const labels = parseQueryLabels(query);

  // 记录成功查询
  sqlQueryTotal.inc({ ...labels, status: 'success' });
  sqlQueryDuration.observe(labels, durationMs / 1000);

  // 记录行数
  if (rowCount !== undefined) {
    sqlQueryRowCount.observe(labels, rowCount);
  }

  // 更新百分位数
  recordDuration(labels.operation, labels.table, durationMs);
}

/**
 * 记录慢查询
 */
export function recordSlowQueryMetrics(
  query: string,
  durationMs: number,
  thresholdMs: number = 1000
): void {
  const labels = parseQueryLabels(query);

  slowQueryTotal.inc({
    ...labels,
    threshold_ms: String(thresholdMs),
  });
}

/**
 * 记录查询错误
 */
export function recordErrorMetrics(
  query: string,
  errorType: string
): void {
  const labels = parseQueryLabels(query);

  sqlQueryTotal.inc({ ...labels, status: 'error' });
  sqlQueryErrors.inc({
    ...labels,
    error_type: errorType,
  });
}

/**
 * 记录活跃查询
 */
export function incrementActiveQueries(operation: string = 'other'): void {
  activeQueries.inc({ operation });
}

export function decrementActiveQueries(operation: string = 'other'): void {
  activeQueries.dec({ operation });
}

/**
 * 更新连接池指标
 */
export function updateConnectionPoolMetrics(
  used: number,
  idle: number,
  waiting: number
): void {
  dbConnectionPoolUsed.set(used);
  dbConnectionPoolIdle.set(idle);
  dbConnectionPoolWaiting.set(waiting);
}

// ============================================================
// Helper Functions
// ============================================================

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
// Metrics Export
// ============================================================

/**
 * 获取 Prometheus 格式的指标
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * 获取指标内容类型
 */
export function getMetricsContentType(): string {
  return register.contentType;
}

// ============================================================
// Metrics Reset (for testing)
// ============================================================

/**
 * 重置所有指标 (主要用于测试)
 */
export function resetMetrics(): void {
  register.resetMetrics();
  durationBuckets.clear();
}

// ============================================================
// Default Export
// ============================================================

export default {
  // Metrics
  sqlQueryTotal,
  sqlQueryDuration,
  slowQueryTotal,
  sqlQueryErrors,
  activeQueries,
  sqlQueryRowCount,
  sqlQueryLatencyP95,
  sqlQueryLatencyP99,
  dbConnectionPoolUsed,
  dbConnectionPoolIdle,
  dbConnectionPoolWaiting,

  // Functions
  recordQueryMetrics,
  recordSlowQueryMetrics,
  recordErrorMetrics,
  incrementActiveQueries,
  decrementActiveQueries,
  updateConnectionPoolMetrics,
  getMetrics,
  getMetricsContentType,
  resetMetrics,
};
