import { createRequire } from 'node:module';
import { getLocalDbProvider, getPrimaryDbProvider } from './dbProvider';

const require = createRequire(import.meta.url);

type PrismaClientCtor = new (...args: any[]) => any;

function loadClient(modulePath: string): PrismaClientCtor {
  const mod = require(modulePath) as { PrismaClient: PrismaClientCtor };
  return mod.PrismaClient;
}

export function resolvePrimaryPrismaClient(): PrismaClientCtor {
  if (getPrimaryDbProvider() === 'postgresql') {
    return loadClient('../../prisma/generated/postgres-client/index.js');
  }
  if (getPrimaryDbProvider() === 'mysql') {
    return loadClient('../../prisma/generated/mysql-client/index.js');
  }
  return loadClient('../../prisma/generated/client/index.js');
}

export function resolveLocalPrismaClient(): PrismaClientCtor {
  if (getLocalDbProvider() === 'postgresql') {
    return loadClient('../../prisma/generated/postgres-client/index.js');
  }
  if (getLocalDbProvider() === 'mysql') {
    return loadClient('../../prisma/generated/mysql-client/index.js');
  }
  return loadClient('../../prisma/generated/local-client/index.js');
}
