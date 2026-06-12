import { getLocalDatabaseUrl } from './utils/dbProvider.js';
import { resolveLocalPrismaClient } from './utils/prismaClientResolver.js';
const PrismaClient = resolveLocalPrismaClient();
const localPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: getLocalDatabaseUrl() || 'file:./prisma/dev.db?connection_limit=1',
        },
    },
});
export default localPrisma;
//# sourceMappingURL=localDb.js.map