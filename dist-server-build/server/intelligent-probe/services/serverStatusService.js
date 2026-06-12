import { prisma } from '../db.js';
import { syncServerStatusToMainDB } from '../../services/syncService.js';
import { logger } from '../../utils/logger.js';
export const createServerStatus = async (data) => {
    const status = await prisma.serverStatus.create({ data });
    // Trigger background sync
    syncServerStatusToMainDB(status.serverId).catch(err => {
        logger.error(`[Sync] Status create sync failed for server ${status.serverId}:`, { error: err.message });
    });
    return status;
};
export const getServerStatusById = async (id) => {
    return prisma.serverStatus.findUnique({ where: { id } });
};
export const getServerStatusByServerId = async (serverId) => {
    return prisma.serverStatus.findUnique({ where: { serverId } });
};
export const updateServerStatus = async (id, data) => {
    const status = await prisma.serverStatus.update({ where: { id }, data });
    // Trigger background sync
    syncServerStatusToMainDB(status.serverId).catch(err => {
        logger.error(`[Sync] Status update sync failed for server ${status.serverId}:`, { error: err.message });
    });
    return status;
};
export const deleteServerStatus = async (id) => {
    return prisma.serverStatus.delete({ where: { id } });
};
//# sourceMappingURL=serverStatusService.js.map