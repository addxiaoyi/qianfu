import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServerStatus, getServerStatusById, getServerStatusByServerId, updateServerStatus, deleteServerStatus, } from '../services/serverStatusService.js';
import { prisma } from '../db.js'; // Import Prisma instance
// Mock the entire prisma client
vi.mock('../db.js', () => ({
    prisma: {
        serverStatus: {
            create: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}));
describe('serverStatusService', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Clear all mocks before each test
    });
    it('should create a new server status', async () => {
        const mockServerStatus = {
            id: 1,
            serverId: 1,
            online: true,
            host: 'test.com',
            port: 25565,
            versionNameRaw: '1.19.4',
            versionProtocol: 762,
            playersOnline: 10,
            playersMax: 100,
            playersList: '[]',
            motdRaw: 'Welcome',
            motdClean: 'Welcome',
            motdHtml: '<span>Welcome</span>',
            favicon: null,
            srvRecord: null,
            lastUpdated: new Date(),
            createdAt: new Date(),
        };
        prisma.serverStatus.create.mockResolvedValue(mockServerStatus);
        const newServerStatusData = {
            online: true,
            host: 'test.com',
            port: 25565,
            server: { connect: { id: 1 } }
        };
        const result = await createServerStatus(newServerStatusData);
        expect(prisma.serverStatus.create).toHaveBeenCalledWith({ data: newServerStatusData });
        expect(result).toEqual(mockServerStatus);
    });
    it('should get server status by ID', async () => {
        const mockServerStatus = {
            id: 1,
            serverId: 1,
            online: true,
            host: 'test.com',
            port: 25565,
            versionNameRaw: '1.19.4',
            versionProtocol: 762,
            playersOnline: 10,
            playersMax: 100,
            playersList: '[]',
            motdRaw: 'Welcome',
            motdClean: 'Welcome',
            motdHtml: '<span>Welcome</span>',
            favicon: null,
            srvRecord: null,
            lastUpdated: new Date(),
            createdAt: new Date(),
        };
        prisma.serverStatus.findUnique.mockResolvedValue(mockServerStatus);
        const result = await getServerStatusById(1);
        expect(prisma.serverStatus.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
        expect(result).toEqual(mockServerStatus);
    });
    it('should get server status by serverId', async () => {
        const mockServerStatus = {
            id: 1,
            serverId: 1,
            online: true,
            host: 'test.com',
            port: 25565,
            versionNameRaw: '1.19.4',
            versionProtocol: 762,
            playersOnline: 10,
            playersMax: 100,
            playersList: '[]',
            motdRaw: 'Welcome',
            motdClean: 'Welcome',
            motdHtml: '<span>Welcome</span>',
            favicon: null,
            srvRecord: null,
            lastUpdated: new Date(),
            createdAt: new Date(),
        };
        prisma.serverStatus.findUnique.mockResolvedValue(mockServerStatus);
        const result = await getServerStatusByServerId(1);
        expect(prisma.serverStatus.findUnique).toHaveBeenCalledWith({ where: { serverId: 1 } });
        expect(result).toEqual(mockServerStatus);
    });
    it('should update an existing server status', async () => {
        const updatedServerStatus = {
            id: 1,
            serverId: 1,
            online: false,
            host: 'updated.com',
            port: 25565,
            versionNameRaw: '1.20',
            versionProtocol: 763,
            playersOnline: 5,
            playersMax: 50,
            playersList: '[]',
            motdRaw: 'Updated Welcome',
            motdClean: 'Updated Welcome',
            motdHtml: '<span>Updated Welcome</span>',
            favicon: null,
            srvRecord: null,
            lastUpdated: new Date(),
            createdAt: new Date(),
        };
        prisma.serverStatus.update.mockResolvedValue(updatedServerStatus);
        const updateData = { online: false, host: 'updated.com' };
        const result = await updateServerStatus(1, updateData);
        expect(prisma.serverStatus.update).toHaveBeenCalledWith({ where: { id: 1 }, data: updateData });
        expect(result).toEqual(updatedServerStatus);
    });
    it('should delete a server status', async () => {
        const deletedServerStatus = {
            id: 1,
            serverId: 1,
            online: true,
            host: 'test.com',
            port: 25565,
            versionNameRaw: '1.19.4',
            versionProtocol: 762,
            playersOnline: 10,
            playersMax: 100,
            playersList: '[]',
            motdRaw: 'Welcome',
            motdClean: 'Welcome',
            motdHtml: '<span>Welcome</span>',
            favicon: null,
            srvRecord: null,
            lastUpdated: new Date(),
            createdAt: new Date(),
        };
        prisma.serverStatus.delete.mockResolvedValue(deletedServerStatus);
        const result = await deleteServerStatus(1);
        expect(prisma.serverStatus.delete).toHaveBeenCalledWith({ where: { id: 1 } });
        expect(result).toEqual(deletedServerStatus);
    });
});
//# sourceMappingURL=serverStatusService.test.js.map