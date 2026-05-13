import { prisma } from '../db.js';
import { Prisma } from '../../../prisma/generated/local-client';
import { syncServerStatusToMainDB } from '../../services/syncService';
import { logger } from '../../utils/logger';

export const createServerStatus = async (data: Prisma.ServerStatusCreateInput) => {
  const status = await prisma.serverStatus.create({ data });
  // Trigger background sync
  syncServerStatusToMainDB(status.serverId).catch(err => {
    logger.error(`[Sync] Status create sync failed for server ${status.serverId}:`, { error: err.message });
  });
  return status;
};

export const getServerStatusById = async (id: number) => {
  return prisma.serverStatus.findUnique({ where: { id } });
};

export const getServerStatusByServerId = async (serverId: number) => {
  return prisma.serverStatus.findUnique({ where: { serverId } });
};

export const updateServerStatus = async (id: number, data: Prisma.ServerStatusUpdateInput) => {
  const status = await prisma.serverStatus.update({ where: { id }, data });
  // Trigger background sync
  syncServerStatusToMainDB(status.serverId).catch(err => {
    logger.error(`[Sync] Status update sync failed for server ${status.serverId}:`, { error: err.message });
  });
  return status;
};

export const deleteServerStatus = async (id: number) => {
  return prisma.serverStatus.delete({ where: { id } });
};
