import dotenv from 'dotenv';
dotenv.config();
import { logger } from './utils/logger.js';
import { getDatabaseUrl, getPrimaryDbProvider } from './utils/dbProvider.js';
import { resolvePrimaryPrismaClient } from './utils/prismaClientResolver.js';
const PrismaClient = resolvePrimaryPrismaClient();
// ============================================
// Prisma Client connection pool optimization
// ============================================
// Connection pool settings vary by database provider:
// - SQLite: limited concurrency, use connection_limit=1 for writes, up to 5 for reads
// - PostgreSQL/MySQL: use connection_limit based on Node.js threads and expected load
function getOptimalConnectionConfig() {
    const provider = getPrimaryDbProvider();
    const dbUrl = getDatabaseUrl();
    // For SQLite, use minimal connection limit to avoid file locking issues
    if (provider === 'sqlite') {
        return {
            connection_limit: 5, // Allow up to 5 concurrent read connections
            pool_timeout: 10, // Pool acquire timeout in seconds
        };
    }
    // For PostgreSQL/MySQL, calculate optimal pool size
    // Formula: min(50, CPU cores * 2 + number of spindles)
    // With typical 2 cores and SSD, we use 20 as a safe default
    return {
        connection_limit: 20, // Max concurrent connections to DB
        pool_timeout: 10, // Seconds to wait for a connection from pool
        connect_timeout: 10, // Connection establishment timeout
    };
}
const poolConfig = getOptimalConnectionConfig();
const dbUrl = getDatabaseUrl();
// Build optimized datasource URL with connection pool parameters
function buildOptimizedDbUrl(baseUrl, poolConfig, provider) {
    // If URL already has query params, append; otherwise add ?
    const separator = baseUrl.includes('?') ? '&' : '?';
    if (provider === 'sqlite') {
        // SQLite connection parameters
        // Note: connection_limit controls max simultaneous readers
        // For SQLite, we use WAL mode (set in optimizeDB()) for better concurrency
        return `${baseUrl}${separator}connection_limit=${poolConfig.connection_limit}`;
    }
    // PostgreSQL/MySQL connection parameters
    const params = new URLSearchParams();
    params.set('connection_limit', String(poolConfig.connection_limit));
    params.set('pool_timeout', String(poolConfig.pool_timeout));
    // PostgreSQL-specific optimizations
    if (provider === 'postgresql') {
        // Statement timeout in ms (30 seconds) - prevents runaway queries
        params.set('statement_timeout', '30000');
        // Idle in transaction timeout (prevent long transactions holding connections)
        params.set('idle_in_transaction_session_timeout', '60000');
        // Connection lifetime (recycle connections every 30 minutes)
        params.set('connection_limit', String(Math.floor(poolConfig.connection_limit / 2)));
    }
    // MySQL-specific optimizations
    if (provider === 'mysql') {
        // Wait timeout for idle connections (10 minutes)
        params.set('wait_timeout', '600');
        // Interactive timeout for TCP connections
        params.set('interactive_timeout', '600');
    }
    // Append to existing query params if any
    if (baseUrl.includes('?')) {
        const [base, existingParams] = baseUrl.split('?');
        return `${base}?${existingParams}&${params.toString()}`;
    }
    return `${baseUrl}?${params.toString()}`;
}
const optimizedDbUrl = buildOptimizedDbUrl(dbUrl || 'file:./prisma/dev.db', poolConfig, getPrimaryDbProvider());
// Add connection timeout and retry logic
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'minimal',
    datasources: {
        db: {
            url: optimizedDbUrl
        }
    }
});
// Log connection pool configuration on startup
logger.info(`[DB] Connection pool configured: provider=${getPrimaryDbProvider()}, connection_limit=${poolConfig.connection_limit}, pool_timeout=${poolConfig.pool_timeout}`);
// SQLite-only engine tuning. Skip these PRAGMAs on PostgreSQL/MySQL.
async function optimizeDB() {
    if (getPrimaryDbProvider() !== 'sqlite')
        return;
    try {
        // WAL mode: allows concurrent reads while writing (major performance improvement)
        await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
        // NORMAL sync: balanced durability/performance (not FULL which is safer but slower)
        await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
        // 10000 pages cache (~40MB for 4KB pages) - reduce disk I/O
        await prisma.$queryRawUnsafe('PRAGMA cache_size=10000;');
        // Temp tables in memory - faster sorting and temporary data
        await prisma.$queryRawUnsafe('PRAGMA temp_store=MEMORY;');
        // 5 second busy timeout - wait up to 5s for locked database before failing
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;');
        // Additional SQLite optimizations
        // Cache shared table metadata
        await prisma.$queryRawUnsafe('PRAGMA cache_table_metadata=ON;');
        // Faster auto_vacuum (incremental)
        await prisma.$queryRawUnsafe('PRAGMA auto_vacuum=INCREMENTAL;');
        // mmap_size for read-ahead (256MB on 64-bit systems)
        await prisma.$queryRawUnsafe('PRAGMA mmap_size=268435456;');
        logger.info('[DB] SQLite optimized: WAL mode, Normal sync, Memory temp store, 40MB cache, 256MB mmap enabled');
    }
    catch (err) {
        logger.warn('[DB] Failed to optimize SQLite:', err);
    }
}
optimizeDB();
// ============================================
// Prisma Middleware: Query Performance Monitoring
// ============================================
// Log queries exceeding the threshold (default: 500ms)
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.PRISMA_SLOW_QUERY_THRESHOLD || '500', 10);
const SLOW_RAW_QUERY_THRESHOLD_MS = parseInt(process.env.PRISMA_SLOW_RAW_QUERY_THRESHOLD || '200', 10);
prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
        logger.warn(`[Prisma SlowQuery] ${params.model}.${params.action} took ${duration}ms`);
    }
    // Track very slow queries (>2 seconds) with more detail
    if (duration > 2000) {
        logger.warn(`[Prisma VerySlowQuery] ${params.model}.${params.action} took ${duration}ms - possible performance issue`);
    }
    return result;
});
// Prisma Middleware: Transaction Monitor (Extension for internal visibility)
// Since we use $transaction in some places, we want to know if they are taking too long
prisma.$use(async (params, next) => {
    if (params.action === 'executeRaw' || params.action === 'queryRaw') {
        const start = Date.now();
        const result = await next(params);
        const duration = Date.now() - start;
        if (duration > SLOW_RAW_QUERY_THRESHOLD_MS) {
            const query = params.args && typeof params.args === 'object' && 'query' in params.args
                ? params.args.query
                : undefined;
            // Mask potentially sensitive parameters in raw queries
            const sanitizedQuery = typeof query === 'string'
                ? query.replace(/(password|token|secret|email)\s*=\s*['"][^'"]+['"]/gi, '$1=***MASKED***')
                : query;
            logger.warn(`[Prisma RawQuery] took ${duration}ms: ${sanitizedQuery}`);
        }
        return result;
    }
    return next(params);
});
// Prisma Middleware: Soft Delete (Example for scalability)
// You can add logic here to handle deleted_at if needed in the future
// Test connection on startup with a timeout
let isDbConnected = false;
const connectWithRetry = async (retries = 2, interval = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            // Use a raw query with a short timeout to check connection
            await Promise.race([
                prisma.$queryRaw `SELECT 1`,
                new Promise((_, reject) => setTimeout(() => reject(new Error('DB Connection Timeout')), 2000))
            ]);
            isDbConnected = true;
            logger.info('[DB] Database connected successfully');
            return true;
        }
        catch (err) {
            logger.warn(`[DB] Connection attempt ${i + 1} failed: ${err.message}`);
            if (i < retries - 1)
                await new Promise(r => setTimeout(r, interval));
        }
    }
    logger.error('[DB] Failed to connect to database after retries');
    return false;
};
connectWithRetry();
export { isDbConnected };
export default prisma;
//# sourceMappingURL=db.js.map