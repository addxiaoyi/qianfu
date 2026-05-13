import { prisma } from '../db.js';
import { Prisma } from '../../../prisma/generated/local-client';
import { syncServerToMainDB } from '../../services/syncService';
import { logger } from '../../utils/logger';

export const createServer = async (data: Prisma.ServerCreateInput) => {
  const server = await prisma.server.create({ data });
  // Trigger background sync
  syncServerToMainDB(server.id).catch(err => {
    logger.error(`[Sync] Server create sync failed for server ${server.id}:`, { error: err.message });
  });
  return server;
};

export const getServerById = async (id: number) => {
  return prisma.server.findUnique({ where: { id } });
};

export const getAllServers = async () => {
  return prisma.server.findMany();
};

export const updateServer = async (id: number, data: Prisma.ServerUpdateInput) => {
  const server = await prisma.server.update({ where: { id }, data });
  // Trigger background sync
  syncServerToMainDB(server.id).catch(err => {
    logger.error(`[Sync] Server update sync failed for server ${server.id}:`, { error: err.message });
  });
  return server;
};

export const deleteServer = async (id: number) => {
  return prisma.server.delete({ where: { id } });
};
