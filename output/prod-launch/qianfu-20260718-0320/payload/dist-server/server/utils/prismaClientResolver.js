import { createRequire } from 'node:module';
import { getLocalDbProvider, getPrimaryDbProvider } from './dbProvider.js';
const require = createRequire(import.meta.url);
function loadClient(modulePath) {
    const mod = require(modulePath);
    return mod.PrismaClient;
}
export function resolvePrimaryPrismaClient() {
    if (getPrimaryDbProvider() === 'postgresql') {
        return loadClient('../../prisma/generated/postgres-client/index.js');
    }
    if (getPrimaryDbProvider() === 'mysql') {
        return loadClient('../../prisma/generated/mysql-client/index.js');
    }
    return loadClient('../../prisma/generated/client/index.js');
}
export function resolveLocalPrismaClient() {
    if (getLocalDbProvider() === 'postgresql') {
        return loadClient('../../prisma/generated/postgres-client/index.js');
    }
    if (getLocalDbProvider() === 'mysql') {
        return loadClient('../../prisma/generated/mysql-client/index.js');
    }
    return loadClient('../../prisma/generated/local-client/index.js');
}
//# sourceMappingURL=prismaClientResolver.js.map