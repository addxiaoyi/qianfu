import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer, getServerById, getAllServers, updateServer, deleteServer, } from '../services/serverService.js';
import { prisma } from '../db.js'; // Import Prisma instance
// Mock the entire prisma client
vi.mock('../db.js', () => ({
    prisma: {
        server: {
            create: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}));
describe('serverService', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Clear all mocks before each test
    });
    it('should create a new server', async () => {
        const mockServer = {
            id: 1,
            owner_id: 1,
            name: 'Test Server',
            name_en: 'Test Server EN',
            thumbnail: null,
            summary: null,
            summary_en: null,
            content_html: null,
            ip: '127.0.0.1',
            group_number: null,
            tags: '[]',
            link: null,
            activity: 0,
            synced_at: null,
            created_at: new Date(),
            updated_at: new Date(),
        };
        prisma.server.create.mockResolvedValue(mockServer);
        const newServerData = {
            name: 'Test Server',
            ip: '127.0.0.1',
            owner: { connect: { id: 1 } }
        };
        const result = await createServer(newServerData);
        expect(prisma.server.create).toHaveBeenCalledWith({ data: newServerData });
        expect(result).toEqual(mockServer);
    });
    it('should get a server by ID', async () => {
        const mockServer = {
            id: 1,
            owner_id: 1,
            name: 'Test Server',
            name_en: 'Test Server EN',
            thumbnail: null,
            summary: null,
            summary_en: null,
            content_html: null,
            ip: '127.0.0.1',
            group_number: null,
            tags: '[]',
            link: null,
            activity: 0,
            synced_at: null,
            created_at: new Date(),
            updated_at: new Date(),
        };
        prisma.server.findUnique.mockResolvedValue(mockServer);
        const result = await getServerById(1);
        expect(prisma.server.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
        expect(result).toEqual(mockServer);
    });
    it('should get all servers', async () => {
        const mockServers = [
            {
                id: 1,
                owner_id: 1,
                name: 'Test Server 1',
                name_en: 'Test Server 1 EN',
                thumbnail: null,
                summary: null,
                summary_en: null,
                content_html: null,
                ip: '127.0.0.1',
                group_number: null,
                tags: '[]',
                link: null,
                activity: 0,
                synced_at: null,
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: 2,
                owner_id: 1,
                name: 'Test Server 2',
                name_en: 'Test Server 2 EN',
                thumbnail: null,
                summary: null,
                summary_en: null,
                content_html: null,
                ip: '127.0.0.2',
                group_number: null,
                tags: '[]',
                link: null,
                activity: 0,
                synced_at: null,
                created_at: new Date(),
                updated_at: new Date(),
            },
        ];
        prisma.server.findMany.mockResolvedValue(mockServers);
        const result = await getAllServers();
        expect(prisma.server.findMany).toHaveBeenCalledWith();
        expect(result).toEqual(mockServers);
    });
    it('should update an existing server', async () => {
        const updatedServer = {
            id: 1,
            owner_id: 1,
            name: 'Updated Server',
            name_en: 'Updated Server EN',
            thumbnail: null,
            summary: null,
            summary_en: null,
            content_html: null,
            ip: '127.0.0.1',
            group_number: null,
            tags: '[]',
            link: null,
            activity: 0,
            synced_at: null,
            created_at: new Date(),
            updated_at: new Date(),
        };
        prisma.server.update.mockResolvedValue(updatedServer);
        const updateData = { name: 'Updated Server' };
        const result = await updateServer(1, updateData);
        expect(prisma.server.update).toHaveBeenCalledWith({ where: { id: 1 }, data: updateData });
        expect(result).toEqual(updatedServer);
    });
    it('should delete a server', async () => {
        const deletedServer = {
            id: 1,
            owner_id: 1,
            name: 'Test Server',
            name_en: 'Test Server EN',
            thumbnail: null,
            summary: null,
            summary_en: null,
            content_html: null,
            ip: '127.0.0.1',
            group_number: null,
            tags: '[]',
            link: null,
            activity: 0,
            synced_at: null,
            created_at: new Date(),
            updated_at: new Date(),
        };
        prisma.server.delete.mockResolvedValue(deletedServer);
        const result = await deleteServer(1);
        expect(prisma.server.delete).toHaveBeenCalledWith({ where: { id: 1 } });
        expect(result).toEqual(deletedServer);
    });
});
//# sourceMappingURL=serverService.test.js.map