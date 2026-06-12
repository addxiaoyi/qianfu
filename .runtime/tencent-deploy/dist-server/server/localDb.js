import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../prisma/generated/local-client/index.js');
const localPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: process.env.LOCAL_DATABASE_URL ||
                process.env.DATABASE_URL ||
                'file:./prisma/dev.db?connection_limit=1',
        },
    },
});
export default localPrisma;
//# sourceMappingURL=localDb.js.map