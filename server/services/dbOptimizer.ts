import type { PrismaClient } from '../../prisma/generated/client';
import prisma from '../db';
import { logger } from '../utils/logger';

function assertSqlIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return name;
}

type PrismaModel = keyof Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '__dirname'>;

interface QueryInfo {
  query: string;
  params: unknown[];
  duration: number;
  timestamp: Date;
}

const queryLog: QueryInfo[] = [];
export function getQueryLog(): QueryInfo[] {
  return [...queryLog];
}

export function clearQueryLog(): void {
  queryLog.length = 0;
}

export function getSlowQueries(thresholdMs: number = 100): QueryInfo[] {
  return queryLog.filter(q => q.duration > thresholdMs);
}

export async function withTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return fn(tx as PrismaClient);
  }, {
    maxWait: 5000,
    timeout: 10000,
  });
}

export async function batchCreate<T>(
  model: PrismaModel,
  data: T[],
  batchSize: number = 100
): Promise<number> {
  const modelDelegate = (prisma[model] as unknown as { createMany: (args: { data: T[] }) => Promise<{ count: number }> });
  let totalCreated = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const result = await modelDelegate.createMany({ data: batch });
    totalCreated += result.count;
  }

  return totalCreated;
}

export async function batchUpdate<T>(
  model: PrismaModel,
  data: { where: Partial<T>; update: Partial<T> }[],
  batchSize: number = 100
): Promise<number> {
  const modelDelegate = (prisma[model] as unknown as { updateMany: (args: { where: Partial<T>; data: Partial<T> }) => Promise<{ count: number }> });
  let totalUpdated = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    for (const item of batch) {
      const result = await modelDelegate.updateMany({
        where: item.where,
        data: item.update,
      });
      totalUpdated += result.count;
    }
  }

  return totalUpdated;
}

export async function batchUpsert<T>(
  model: PrismaModel,
  data: T[],
  uniqueField: keyof T,
  batchSize: number = 100
): Promise<number> {
  const modelDelegate = (prisma[model] as unknown as { upsert: (args: { where: Record<string, unknown>; create: T; update: Partial<T> }) => Promise<{ id: number }> });
  let totalUpserted = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    for (const item of batch) {
      const uniqueValue = item[uniqueField];
      const where = { [String(uniqueField)]: uniqueValue } as Record<string, unknown>;
      
      await modelDelegate.upsert({
        where,
        create: item,
        update: item as Partial<T>,
      });
      totalUpserted++;
    }
  }

  return totalUpserted;
}

export async function paginate<T>(
  model: PrismaModel,
  options: {
    where?: Partial<T>;
    page?: number;
    limit?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    include?: Record<string, boolean>;
  }
): Promise<{ data: T[]; total: number; page: number; totalPages: number }> {
  const {
    where,
    page = 1,
    limit = 20,
    orderBy,
    include,
  } = options;

  const modelDelegate = (prisma[model] as unknown as {
    findMany: (args?: {
      where?: Partial<T>;
      skip?: number;
      take?: number;
      orderBy?: Record<string, 'asc' | 'desc'>;
      include?: Record<string, boolean>;
    }) => Promise<T[]>;
    count: (args?: { where?: Partial<T> }) => Promise<number>;
  });

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    modelDelegate.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include,
    }),
    modelDelegate.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    total,
    page,
    totalPages,
  };
}

export function createSearchQuery(
  searchTerm: string,
  _searchableFields: string[]
): { contains: string; mode: 'insensitive' } {
  return {
    contains: searchTerm,
    mode: 'insensitive',
  };
}

export function buildWhereClause<T>(
  filters: Partial<T>,
  searchTerm?: string,
  searchFields?: string[]
): Record<string, unknown> {
  const where: Record<string, unknown> = { ...filters };

  if (searchTerm && searchFields && searchFields.length > 0) {
    where.OR = searchFields.map((field) => ({
      [field]: createSearchQuery(searchTerm, [field]),
    }));
  }

  return where;
}

export async function optimizeDatabaseIndexes() {
  const tableIndexes = [
    { table: 'Server', columns: ['name'], indexName: 'idx_server_name_search' },
    { table: 'Server', columns: ['activity', 'updated_at'], indexName: 'idx_server_activity_updated' },
    { table: 'Server', columns: ['review_status', 'activity'], indexName: 'idx_server_status_activity' },
    { table: 'User', columns: ['username'], indexName: 'idx_user_username_search' },
    { table: 'User', columns: ['role', 'created_at'], indexName: 'idx_user_role_created' },
  ];

  const results = [];
  
  for (const idx of tableIndexes) {
    try {
      // Check if the index already exists using a safe query
      const existingIndexes = await getIndexes(idx.table);
      const exists = existingIndexes.some(ei => ei && typeof ei === 'object' && 'name' in ei && String(ei.name).toLowerCase() === idx.indexName.toLowerCase());
      
      if (!exists) {
        const columnsStr = idx.columns.join(', ');
        // SQLite syntax to create an index
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${idx.indexName} ON ${idx.table} (${columnsStr})`);
        results.push({ index: idx.indexName, status: 'created' });
      } else {
        results.push({ index: idx.indexName, status: 'already_exists' });
      }
    } catch (error) {
      // Log error but don't throw to prevent 500 errors in background tasks
      logger.error(`[DB Optimizer] Failed to optimize index ${idx.indexName}:`, { 
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code
      });
      results.push({ index: idx.indexName, status: 'failed', error: String(error) });
    }
  }

  return results;
}

export async function optimizeServerQueries() {
  const oftenAccessedServers = await prisma.server.findMany({
    where: { review_status: 'APPROVED' },
    orderBy: { activity: 'desc' },
    take: 100,
    select: { id: true, name: true, activity: true },
  });

  return oftenAccessedServers;
}

export async function getServerStats() {
  const [totalServers, approvedServers, pendingServers, rejectedServers] = await Promise.all([
    prisma.server.count(),
    prisma.server.count({ where: { review_status: 'APPROVED' } }),
    prisma.server.count({ where: { review_status: 'PENDING' } }),
    prisma.server.count({ where: { review_status: 'REJECTED' } }),
  ]);

  const [totalUsers, activeUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        last_login_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    servers: { total: totalServers, approved: approvedServers, pending: pendingServers, rejected: rejectedServers },
    users: { total: totalUsers, active: activeUsers },
  };
}

export function explainQuery(query: string): string {
  return `EXPLAIN QUERY PLAN ${query}`;
}

export async function getIndexes(tableName: string): Promise<{ name: string; sql: string }[]> {
  try {
    const result = await prisma.$queryRaw<{ name: string; sql: string }[]>`
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'index' AND tbl_name = ${tableName}
    `;
    return result || [];
  } catch (error) {
    logger.error(`[DB Optimizer] Failed to get indexes for table ${tableName}:`, error);
    return [];
  }
}

export async function analyzeTable(tableName: string): Promise<void> {
  const t = assertSqlIdent(tableName);
  await prisma.$executeRawUnsafe(`ANALYZE ${t}`);
}

export function createCompositeIndex(tableName: string, columns: string[], indexName?: string): string {
  const name = indexName || `idx_${tableName}_${columns.join('_')}`;
  return `CREATE INDEX IF NOT EXISTS ${name} ON ${tableName}(${columns.join(', ')})`;
}

export async function createCustomIndex(
  tableName: string,
  columns: string[],
  indexName?: string
): Promise<void> {
  const safeTable = assertSqlIdent(tableName);
  for (const c of columns) assertSqlIdent(c);
  const name = assertSqlIdent(indexName || `idx_${tableName}_${columns.join('_')}`);
  const columnList = columns.join(', ');
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${name} ON ${safeTable} (${columnList})`);
}

/**
 * Start periodic database optimization scheduler
 */
export function startDbOptimizerScheduler() {
  logger.info('[DbOptimizer] Starting daily database index optimization scheduler...');
  
  // Run optimization once immediately
  optimizeDatabaseIndexes().then(results => {
    const n = results.filter(r => r.status === 'created').length;
    logger.info(`[DbOptimizer] Initial optimization complete: ${n} new indexes created`);
  }).catch(err => {
    logger.error('[DbOptimizer] Initial optimization failed:', err);
  });

  // Run every 24 hours (e.g., at 3 AM daily)
  const INTERVAL = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      logger.info('[DbOptimizer] Running scheduled database optimization...');
      const results = await optimizeDatabaseIndexes();
      logger.info('[DbOptimizer] Scheduled optimization complete:', results);
    } catch (err) {
      logger.error('[DbOptimizer] Scheduled optimization failed:', err);
    }
  }, INTERVAL);
}

export async function dropIndex(indexName: string): Promise<void> {
  const n = assertSqlIdent(indexName);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${n}`);
}
