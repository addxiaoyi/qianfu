import { getLocalDatabaseUrl, isSqliteUrl } from './utils/dbProvider.js';
import { resolveLocalPrismaClient } from './utils/prismaClientResolver.js';
const PrismaClient = resolveLocalPrismaClient();
// ============================================
// Prisma Client connection pool optimization for local database
// ============================================
// Local databases typically have lighter load, but we still optimize for performance
function getLocalDbPoolConfig() {
    const dbUrl = getLocalDatabaseUrl();
    if (isSqliteUrl(dbUrl)) {
        // SQLite: allow more concurrent connections for local development
        return {
            connection_limit: 5,
            pool_timeout: 10,
        };
    }
    // PostgreSQL/MySQL: use moderate pool size for local development
    return {
        connection_limit: 10, // Half of production settings for local dev
        pool_timeout: 10,
    };
}
const poolConfig = getLocalDbPoolConfig();
const dbUrl = getLocalDatabaseUrl() || 'file:./prisma/dev.db';
// Build optimized URL with connection pool parameters
function buildLocalDbUrl(baseUrl, poolConfig) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}connection_limit=${poolConfig.connection_limit}`;
}
const optimizedDbUrl = buildLocalDbUrl(dbUrl, poolConfig);
const localPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: optimizedDbUrl,
        },
    },
});
// Log connection configuration
console.log(`[LocalDB] Connection pool: connection_limit=${poolConfig.connection_limit}, pool_timeout=${poolConfig.pool_timeout}`);
export default localPrisma;
//# sourceMappingURL=localDb.js.map