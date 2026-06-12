import { prisma } from '../db.js';
import { syncServerToMainDB } from '../../services/syncService.js';
import { logger } from '../../utils/logger.js';
export const createServer = async (data) => {
    const server = await prisma.server.create({ data });
    // Trigger background sync
    syncServerToMainDB(server.id).catch(err => {
        logger.error(`[Sync] Server create sync failed for server ${server.id}:`, { error: err.message });
    });
    return server;
};
export const getServerById = async (id) => {
    return prisma.server.findUnique({ where: { id } });
};
export const getAllServers = async () => {
    return prisma.server.findMany();
};
export const updateServer = async (id, data) => {
    const server = await prisma.server.update({ where: { id }, data });
    // Trigger background sync
    syncServerToMainDB(server.id).catch(err => {
        logger.error(`[Sync] Server update sync failed for server ${server.id}:`, { error: err.message });
    });
    return server;
};
export const deleteServer = async (id) => {
    return prisma.server.delete({ where: { id } });
};
//# sourceMappingURL=serverService.js.map