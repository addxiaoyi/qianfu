import dotenv from 'dotenv';
dotenv.config();
import { createRequire } from 'node:module';
import { logger } from './utils/logger.js';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../prisma/generated/client/index.js');
// Add connection timeout and retry logic
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'minimal',
    datasources: {
        db: {
            url: process.env.DATABASE_URL || 'file:./prisma/dev.db?connection_limit=1'
        }
    }
});
// SQLite WAL mode optimization
async function optimizeDB() {
    // Only run optimization for SQLite
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl.startsWith('file:') && !dbUrl.includes('.db'))
        return;
    try {
        // Use $queryRaw instead of $executeRawUnsafe for PRAGMA statements that return values
        await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
        await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
        await prisma.$queryRawUnsafe('PRAGMA cache_size=10000;');
        await prisma.$queryRawUnsafe('PRAGMA temp_store=MEMORY;');
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;');
        logger.info('[DB] SQLite optimized: WAL mode, Normal sync, Memory temp store enabled');
    }
    catch (err) {
        logger.warn('[DB] Failed to optimize SQLite:', err);
    }
}
optimizeDB();
// Prisma Middleware: Query Performance Monitoring
prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;
    if (duration > 500) { // Log slow queries (> 500ms)
        logger.warn(`[Prisma SlowQuery] ${params.model}.${params.action} took ${duration}ms`);
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
        if (duration > 200) {
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