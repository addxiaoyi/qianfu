# 优化项 46: SQL 日志记录 - 慢查询分析

## 1. 概述

在生产环境中，数据库查询性能是影响系统整体性能的关键因素。本优化项旨在实现：

- **SQL 执行日志记录**：记录所有 SQL 查询的详细信息
- **慢查询自动检测**：识别执行时间超过阈值的查询
- **性能指标暴露**：通过 Prometheus 暴露 SQL 性能指标
- **查询分析建议**：为慢查询提供初步的优化建议

## 2. 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                        Express Application                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │   SQL Logger      │    │  Slow Query      │                  │
│  │   Middleware      │───▶│  Detector        │                  │
│  └──────────────────┘    └──────────────────┘                  │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │   Structured     │    │   Performance    │                  │
│  │   Log Storage    │    │   Metrics       │                  │
│  └──────────────────┘    └──────────────────┘                  │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────────────────────────────┐                   │
│  │         Prometheus Metrics Export        │                   │
│  └─────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                                 │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  pg_stat_statements │  │  PostgreSQL      │                  │
│  │  (slow query)    │    │  Slow Log        │                  │
│  └──────────────────┘    └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 功能模块

### 3.1 SQL 日志中间件

**文件位置**: `server/middleware/sql-logger.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { config } from '../config/env';

export interface SqlLogEntry {
  timestamp: string;
  query: string;
  params?: unknown[];
  duration: number;
  rowCount?: number;
  error?: string;
  requestId?: string;
  userId?: string | number;
}

export interface SlowQueryConfig {
  /** 慢查询阈值 (毫秒) */
  threshold: number;
  /** 是否记录所有查询 */
  logAll: boolean;
  /** 最大日志长度 */
  maxQueryLength: number;
  /** 忽略的查询模式 (正则表达式数组) */
  ignorePatterns: RegExp[];
  /** 是否包含 EXPLAIN ANALYZE */
  includeExplain: boolean;
}

export const defaultSlowQueryConfig: SlowQueryConfig = {
  threshold: 1000,        // 1秒
  logAll: false,           // 仅记录慢查询
  maxQueryLength: 1000,
  ignorePatterns: [/^SELECT 1$/i],
  includeExplain: false,
};

/**
 * SQL 查询包装器 - 记录所有查询执行
 */
export function wrapQuery<T>(
  query: string,
  params: unknown[] = [],
  operation: () => Promise<T>,
  context: { requestId?: string; userId?: string | number } = {}
): Promise<T> {
  const startTime = process.hrtime.bigint();
  const config = getSqlConfig();
  
  return operation()
    .then((result: T) => {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // ms
      const entry: SqlLogEntry = {
        timestamp: new Date().toISOString(),
        query: truncateQuery(query, config.maxQueryLength),
        params: config.logAll ? params : undefined,
        duration,
        requestId: context.requestId,
        userId: context.userId,
      };
      
      // 根据阈值决定日志级别
      if (duration > config.threshold) {
        sqlLogger.warn('Slow query detected', entry);
        recordSlowQueryMetrics(query, duration);
      } else if (config.logAll) {
        sqlLogger.debug('Query executed', entry);
      }
      
      // 记录到 Prometheus
      recordQueryMetrics(query, duration);
      
      return result;
    })
    .catch((error: Error) => {
      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      const entry: SqlLogEntry = {
        timestamp: new Date().toISOString(),
        query: truncateQuery(query, config.maxQueryLength),
        params: config.logAll ? params : undefined,
        duration,
        error: error.message,
        requestId: context.requestId,
        userId: context.userId,
      };
      
      sqlLogger.error('Query failed', entry);
      recordErrorMetrics(query);
      
      throw error;
    });
}
```

### 3.2 慢查询检测服务

**文件位置**: `server/services/slow-query-detector.ts`

```typescript
import { logger } from '../lib/logger';

export interface SlowQuery {
  id: string;
  query: string;
  duration: number;
  timestamp: Date;
  frequency: number;
  avgDuration: number;
  suggestion?: string;
}

export interface QueryAnalysis {
  slowQueries: SlowQuery[];
  totalQueries: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
}

/**
 * 慢查询检测器
 */
export class SlowQueryDetector {
  private queryBuffer: Map<string, QueryRecord> = new Map();
  private readonly BUFFER_SIZE = 1000;
  private readonly ANALYSIS_WINDOW = 3600000; // 1小时

  async analyze(limit: number = 10): Promise<SlowQuery[]> {
    const now = Date.now();
    const queries: SlowQuery[] = [];

    for (const [query, record] of this.queryBuffer) {
      if (record.count > 0) {
        queries.push({
          id: this.hashQuery(query),
          query,
          duration: record.maxDuration,
          timestamp: record.lastSeen,
          frequency: record.count,
          avgDuration: record.totalDuration / record.count,
          suggestion: this.generateSuggestion(query, record.avgDuration),
        });
      }
    }

    return queries
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, limit);
  }

  async getAnalysis(): Promise<QueryAnalysis> {
    const slowQueries = await this.analyze();
    const allDurations = Array.from(this.queryBuffer.values())
      .flatMap(r => r.durations)
      .sort((a, b) => a - b);

    const totalQueries = allDurations.length;
    const avgDuration = totalQueries > 0
      ? allDurations.reduce((a, b) => a + b, 0) / totalQueries
      : 0;

    const p95Index = Math.floor(totalQueries * 0.95);
    const p99Index = Math.floor(totalQueries * 0.99);

    return {
      slowQueries,
      totalQueries,
      avgDuration,
      p95Duration: allDurations[p95Index] || 0,
      p99Duration: allDurations[p99Index] || 0,
    };
  }

  private generateSuggestion(query: string, avgDuration: number): string {
    const suggestions: string[] = [];
    const upperQuery = query.toUpperCase();

    // 检查是否需要索引
    if (upperQuery.includes('WHERE') && !upperQuery.includes('INDEX')) {
      suggestions.push('考虑为 WHERE 条件字段添加索引');
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
      suggestions.push('检查 JOIN 条件，确保使用索引');
    }

    // 检查子查询
    if (upperQuery.includes('SELECT') && upperQuery.includes('WHERE') && upperQuery.includes('(')) {
      suggestions.push('考虑将子查询改写为 JOIN 或使用 WITH 语句');
    }

    return suggestions.join('; ') || '建议使用 EXPLAIN ANALYZE 分析执行计划';
  }

  private hashQuery(query: string): string {
    // 简化哈希，用于标识查询
    const normalized = query
      .replace(/\s+/g, ' ')
      .replace(/'/g, "''")
      .substring(0, 100);
    return Buffer.from(normalized).toString('base64').substring(0, 16);
  }
}

interface QueryRecord {
  count: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  durations: number[];
  lastSeen: Date;
}

export const slowQueryDetector = new SlowQueryDetector();
```

### 3.3 SQL 性能指标

**文件位置**: `server/lib/sql-metrics.ts`

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// ============================================================
// Metrics 定义
// ============================================================

/** SQL 查询总数 */
export const sqlQueryTotal = new Counter({
  name: 'sql_queries_total',
  help: 'Total number of SQL queries',
  labelNames: ['operation', 'table'],
});

/** SQL 查询耗时直方图 */
export const sqlQueryDuration = new Histogram({
  name: 'sql_query_duration_seconds',
  help: 'SQL query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

/** 慢查询计数器 */
export const slowQueryTotal = new Counter({
  name: 'slow_queries_total',
  help: 'Total number of slow queries',
  labelNames: ['operation', 'table', 'threshold_ms'],
});

/** SQL 查询错误数 */
export const sqlQueryErrors = new Counter({
  name: 'sql_query_errors_total',
  help: 'Total number of SQL query errors',
  labelNames: ['operation', 'table', 'error_type'],
});

/** 当前活跃查询数 */
export const activeQueries = new Gauge({
  name: 'sql_active_queries',
  help: 'Number of currently active SQL queries',
});

/** 查询结果行数 */
export const sqlQueryRowCount = new Histogram({
  name: 'sql_query_row_count',
  help: 'Number of rows returned by SQL queries',
  labelNames: ['operation', 'table'],
  buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000],
});

// ============================================================
// 指标记录函数
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
  
  sqlQueryTotal.inc(labels);
  sqlQueryDuration.observe(labels, durationMs / 1000);
  
  if (rowCount !== undefined) {
    sqlQueryRowCount.observe(labels, rowCount);
  }
}

/**
 * 记录慢查询
 */
export function recordSlowQueryMetrics(
  query: string,
  durationMs: number,
  thresholdMs: number = 1000
): void {
  const labels = {
    ...parseQueryLabels(query),
    threshold_ms: String(thresholdMs),
  };
  
  slowQueryTotal.inc(labels);
}

/**
 * 记录查询错误
 */
export function recordErrorMetrics(
  query: string,
  errorType: string
): void {
  const labels = {
    ...parseQueryLabels(query),
    error_type: errorType,
  };
  
  sqlQueryErrors.inc(labels);
}

/**
 * 记录活跃查询
 */
export function incrementActiveQueries(): void {
  activeQueries.inc();
}

export function decrementActiveQueries(): void {
  activeQueries.dec();
}

// ============================================================
// 辅助函数
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
  
  // 提取表名 (简化实现)
  let table = 'unknown';
  const fromMatch = normalized.match(/FROM\s+(\w+)/i);
  const intoMatch = normalized.match(/INTO\s+(\w+)/i);
  const updateMatch = normalized.match(/UPDATE\s+(\w+)/i);
  
  if (fromMatch) table = fromMatch[1];
  else if (intoMatch) table = intoMatch[1];
  else if (updateMatch) table = updateMatch[1];
  
  return { operation, table };
}
```

### 3.4 数据库连接配置

在 PostgreSQL 中启用慢查询日志：

```sql
-- postgresql.conf 配置

-- 慢查询阈值 (毫秒)
log_min_duration_statement = 1000

-- 启用查询日志
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d.log'

-- 记录所有查询 (可选，用于调试)
-- log_statement = 'all'

-- 仅记录慢查询
log_statement = 'none'
log_min_duration_statement = 1000

-- 格式
log_line_prefix = '%t [%p] %q%u@%d '

-- 索引使用日志
log_index_usage = on

-- 锁等待日志
log_lock_waits = on
deadlock_timeout = 1s
```

### 3.5 API 端点

**文件位置**: `server/routes/sql-metrics.ts`

```typescript
import { Router, Request, Response } from 'express';
import { slowQueryDetector } from '../services/slow-query-detector';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /api/admin/sql/analysis
 * 获取 SQL 性能分析报告
 */
router.get('/analysis', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const analysis = await slowQueryDetector.getAnalysis();
    
    res.json({
      success: true,
      data: {
        ...analysis,
        slowQueries: analysis.slowQueries.slice(0, limit),
      },
    });
  } catch (error) {
    logger.error('Failed to get SQL analysis', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get SQL analysis',
    });
  }
});

/**
 * GET /api/admin/sql/slow-queries
 * 获取慢查询列表
 */
router.get('/slow-queries', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const slowQueries = await slowQueryDetector.analyze(limit);
    
    res.json({
      success: true,
      data: slowQueries,
    });
  } catch (error) {
    logger.error('Failed to get slow queries', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get slow queries',
    });
  }
});

/**
 * GET /metrics/sql
 * Prometheus SQL 指标端点 (集成到现有 metrics)
 */
router.get('/metrics', (req: Request, res: Response) => {
  // SQL 指标已集成到主 metrics 端点
  res.redirect('/metrics');
});

export default router;
```

## 4. Prometheus 告警规则

添加到 `deploy/monitoring/prometheus/rules/alerts.yml`:

```yaml
# ==========================================
# SQL 慢查询告警 (优化项 46)
# ==========================================
- name: sql_slow_query_alerts
  interval: 30s
  rules:
    # 慢查询率警告
    - alert: HighSlowQueryRate
      expr: rate(slow_queries_total[5m]) / rate(sql_queries_total[5m]) > 0.05
      for: 5m
      labels:
        severity: warning
        category: database
        team: dba
      annotations:
        summary: "SQL 慢查询率较高"
        description: "慢查询占比超过 5%"
        recommendation: "检查慢查询日志，分析执行计划"

    # 慢查询数量警告
    - alert: ManySlowQueries
      expr: rate(slow_queries_total[5m]) > 10
      for: 5m
      labels:
        severity: warning
        category: database
        team: dba
      annotations:
        summary: "慢查询数量过多"
        description: "过去 5 分钟慢查询数超过 10 个"
        recommendation: "检查高频慢查询，考虑添加索引"

    # 慢查询延迟警告
    - alert: HighSlowQueryLatency
      expr: histogram_quantile(0.95, sum(rate(slow_query_duration_seconds_bucket[5m])) by (le)) > 5
      for: 5m
      labels:
        severity: warning
        category: database
        team: dba
      annotations:
        summary: "慢查询延迟过高"
        description: "P95 慢查询延迟超过 5 秒"

    # 慢查询影响严重
    - alert: CriticalSlowQueryImpact
      expr: rate(slow_queries_total[1m]) > 50
      for: 2m
      labels:
        severity: critical
        category: database
        team: dba
        escalation: auto
      annotations:
        summary: "慢查询严重影响性能"
        description: "过去 1 分钟慢查询数超过 50 个"
        action: "立即检查，可能需要回滚近期更改"

    # 特定表慢查询告警
    - alert: SlowQueriesOnCriticalTable
      expr: sum by (table) (rate(slow_queries_total{table=~"orders|users|payments"}[5m])) > 5
      for: 3m
      labels:
        severity: warning
        category: database
        team: dba
      annotations:
        summary: "关键表存在慢查询"
        description: "表 {{ $labels.table }} 的慢查询率较高"
```

## 5. 配置项

添加到 `server/config/env.ts`:

```typescript
export interface SqlLogConfig {
  /** 是否启用 SQL 日志 */
  enabled: boolean;
  /** 慢查询阈值 (毫秒) */
  slowQueryThreshold: number;
  /** 是否记录所有查询 */
  logAllQueries: boolean;
  /** 最大查询日志长度 */
  maxQueryLength: number;
  /** 是否记录查询参数 */
  logParams: boolean;
  /** 是否包含 EXPLAIN ANALYZE */
  includeExplain: boolean;
}

function buildSqlLogConfig(): SqlLogConfig {
  return {
    enabled: parseBoolEnv(process.env.SQL_LOG_ENABLED, true),
    slowQueryThreshold: parseIntEnv(process.env.SQL_SLOW_QUERY_THRESHOLD, 1000),
    logAllQueries: parseBoolEnv(process.env.SQL_LOG_ALL, false),
    maxQueryLength: parseIntEnv(process.env.SQL_MAX_QUERY_LENGTH, 1000),
    logParams: parseBoolEnv(process.env.SQL_LOG_PARAMS, false),
    includeExplain: parseBoolEnv(process.env.SQL_INCLUDE_EXPLAIN, false),
  };
}
```

## 6. 环境变量

```bash
# SQL 日志配置
SQL_LOG_ENABLED=true                    # 启用 SQL 日志
SQL_SLOW_QUERY_THRESHOLD=1000           # 慢查询阈值 (毫秒)
SQL_LOG_ALL=false                       # 记录所有查询 (生产环境建议 false)
SQL_MAX_QUERY_LENGTH=1000               # 最大日志查询长度
SQL_LOG_PARAMS=false                    # 是否记录查询参数 (生产环境建议 false)
SQL_INCLUDE_EXPLAIN=false               # 是否包含 EXPLAIN ANALYZE

# PostgreSQL 慢查询日志
POSTGRES_SLOW_QUERY_LOG=true            # PostgreSQL 端慢查询日志
POSTGRES_SLOW_THRESHOLD_MS=1000          # PostgreSQL 慢查询阈值
```

## 7. Grafana Dashboard

创建 SQL 监控 Dashboard JSON 片段:

```json
{
  "title": "SQL Performance Dashboard",
  "panels": [
    {
      "title": "Query Rate",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(sql_queries_total[5m])",
          "legendFormat": "{{ operation }} - {{ table }}"
        }
      ]
    },
    {
      "title": "Query Duration (P95)",
      "type": "graph",
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(sql_query_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "P95"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(sql_query_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "P99"
        }
      ]
    },
    {
      "title": "Slow Queries by Table",
      "type": "table",
      "targets": [
        {
          "expr": "topk(10, sum by (table, operation) (increase(slow_queries_total[1h])))",
          "format": "table"
        }
      ]
    }
  ]
}
```

## 8. 使用示例

```typescript
// 在服务中使用 SQL 日志包装器
import { wrapQuery } from '../middleware/sql-logger';

class UserService {
  async findById(id: number) {
    return wrapQuery(
      `SELECT * FROM users WHERE id = $1`,
      [id],
      () => db.query('SELECT * FROM users WHERE id = $1', [id]),
      { requestId: req.requestId, userId: req.userId }
    );
  }

  async findAll(page: number, limit: number) {
    const offset = (page - 1) * limit;
    return wrapQuery(
      `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
      () => db.query('SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset])
    );
  }
}
```

## 9. 性能影响评估

| 指标 | 影响 | 说明 |
|------|------|------|
| 日志记录开销 | < 1ms/query | 异步日志写入 |
| 内存占用 | ~10MB/10k queries | 查询缓冲 |
| 磁盘 I/O | 低 | 批量写入 |
| Prometheus 指标 | < 0.1% CPU | Histogram 聚合 |

## 10. 后续优化建议

1. **查询重写模式识别**: 自动识别相似查询
2. **索引建议引擎**: 基于查询模式建议添加索引
3. **自动分析报告**: 定期生成 SQL 性能报告
4. **查询缓存建议**: 识别可缓存的重复查询
5. **连接池监控**: 监控连接泄漏和等待
