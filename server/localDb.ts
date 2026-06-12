import { getLocalDatabaseUrl } from './utils/dbProvider';
import { resolveLocalPrismaClient } from './utils/prismaClientResolver';

const PrismaClient = resolveLocalPrismaClient() as new (...args: any[]) => any;

const localPrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: getLocalDatabaseUrl() || 'file:./prisma/dev.db?connection_limit=1',
    },
  },
});

export default localPrisma;
