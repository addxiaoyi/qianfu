/**
 * Database Configuration
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://qianfu:password@localhost:5432/qianfu_users';

let prisma: PrismaClient | null = null;

export async function connectDatabase(): Promise<PrismaClient> {
  if (prisma) {
    return prisma;
  }

  prisma = new PrismaClient({
    datasourceUrl: DATABASE_URL,
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

  // Connection event handlers
  prisma.$on('warn', (event) => {
    logger.warn('[Prisma] Warning:', event.message);
  });

  prisma.$on('error', (event) => {
    logger.error('[Prisma] Error:', event.message);
  });

  // Test connection
  await prisma.$connect();
  
  // Verify connection
  await prisma.$executeRaw`SELECT 1`;

  logger.info('[Database] PostgreSQL connected successfully');

  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    logger.info('[Database] Disconnected');
  }
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return prisma;
}

// Health check
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    if (!prisma) return false;
    await prisma.$executeRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
