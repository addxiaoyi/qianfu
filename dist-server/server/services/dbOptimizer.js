import prisma from '../db';
import { logger } from '../utils/logger';
function assertSqlIdent(name) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`Invalid SQL identifier: ${name}`);
    }
    return name;
}
const queryLog = [];
export function getQueryLog() {
    return [...queryLog];
}
export function clearQueryLog() {
    queryLog.length = 0;
}
export function getSlowQueries(thresholdMs = 100) {
    return queryLog.filter(q => q.duration > thresholdMs);
}
export async function withTransaction(fn) {
    return prisma.$transaction(async (tx) => {
        return fn(tx);
    }, {
        maxWait: 5000,
        timeout: 10000,
    });
}
export async function batchCreate(model, data, batchSize = 100) {
    const modelDelegate = prisma[model];
    let totalCreated = 0;
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const result = await modelDelegate.createMany({ data: batch });
        totalCreated += result.count;
    }
    return totalCreated;
}
export async function batchUpdate(model, data, batchSize = 100) {
    const modelDelegate = prisma[model];
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
export async function batchUpsert(model, data, uniqueField, batchSize = 100) {
    const modelDelegate = prisma[model];
    let totalUpserted = 0;
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        for (const item of batch) {
            const uniqueValue = item[uniqueField];
            const where = { [String(uniqueField)]: uniqueValue };
            await modelDelegate.upsert({
                where,
                create: item,
                update: item,
            });
            totalUpserted++;
        }
    }
    return totalUpserted;
}
export async function paginate(model, options) {
    const { where, page = 1, limit = 20, orderBy, include, } = options;
    const modelDelegate = prisma[model];
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
export function createSearchQuery(searchTerm, _searchableFields) {
    return {
        contains: searchTerm,
        mode: 'insensitive',
    };
}
export function buildWhereClause(filters, searchTerm, searchFields) {
    const where = { ...filters };
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
            }
            else {
                results.push({ index: idx.indexName, status: 'already_exists' });
            }
        }
        catch (error) {
            // Log error but don't throw to prevent 500 errors in background tasks
            logger.error(`[DB Optimizer] Failed to optimize index ${idx.indexName}:`, {
                error: error instanceof Error ? error.message : String(error),
                code: error?.code
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
export function explainQuery(query) {
    return `EXPLAIN QUERY PLAN ${query}`;
}
export async function getIndexes(tableName) {
    try {
        const result = await prisma.$queryRaw `
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'index' AND tbl_name = ${tableName}
    `;
        return result || [];
    }
    catch (error) {
        logger.error(`[DB Optimizer] Failed to get indexes for table ${tableName}:`, error);
        return [];
    }
}
export async function analyzeTable(tableName) {
    const t = assertSqlIdent(tableName);
    await prisma.$executeRawUnsafe(`ANALYZE ${t}`);
}
export function createCompositeIndex(tableName, columns, indexName) {
    const name = indexName || `idx_${tableName}_${columns.join('_')}`;
    return `CREATE INDEX IF NOT EXISTS ${name} ON ${tableName}(${columns.join(', ')})`;
}
export async function createCustomIndex(tableName, columns, indexName) {
    const safeTable = assertSqlIdent(tableName);
    for (const c of columns)
        assertSqlIdent(c);
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
        }
        catch (err) {
            logger.error('[DbOptimizer] Scheduled optimization failed:', err);
        }
    }, INTERVAL);
}
export async function dropIndex(indexName) {
    const n = assertSqlIdent(indexName);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS ${n}`);
}
//# sourceMappingURL=dbOptimizer.js.map