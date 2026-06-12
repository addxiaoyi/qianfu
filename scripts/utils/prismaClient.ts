import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function normalizeUrl(url: string | undefined | null): string {
  return String(url || '').trim().toLowerCase();
}

function isPostgres(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function isMySql(url: string): boolean {
  return url.startsWith('mysql://');
}

export function createScriptPrismaClient() {
  const databaseUrl = normalizeUrl(process.env.DATABASE_URL);
  if (isPostgres(databaseUrl)) {
    const { PrismaClient } = require('../../prisma/generated/postgres-client/index.js') as {
      PrismaClient: new (...args: any[]) => any;
    };
    return new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  if (isMySql(databaseUrl)) {
    const { PrismaClient } = require('../../prisma/generated/mysql-client/index.js') as {
      PrismaClient: new (...args: any[]) => any;
    };
    return new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  const { PrismaClient } = require('../../prisma/generated/client/index.js') as {
    PrismaClient: new (...args: any[]) => any;
  };
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}
