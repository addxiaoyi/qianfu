import { PrismaClient } from '../prisma/generated/local-client';
const localPrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
export default localPrisma;
//# sourceMappingURL=localDb.js.map