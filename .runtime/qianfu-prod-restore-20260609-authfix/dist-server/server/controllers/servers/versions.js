import localPrisma from '../../localDb.js';
import prisma from '../../db.js';
import { idParamSchema, rollbackSchema, serverHistoryQuerySchema, compareVersionsQuerySchema } from '../../utils/validation.js';
import { AppError, ErrorCode, handleError } from '../../utils/errors.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { logDataChange } from '../../services/auditService.js';
import { syncServerToMainDB } from '../../services/syncService.js';
import { clearPublicServersCache } from '../../services/publicServerCache.js';
import { PermissionGroupManager } from '../../config/permissionGroups.js';
/**
 * Rollback server to a previous version
 */
export const rollbackServer = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
        }
        const { id: serverId } = idValidation.data;
        const user = req.user;
        const validation = rollbackSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const toVersion = validation.data.version;
        const server = await localPrisma.server.findUnique({
            where: { id: serverId }
        });
        if (!server) {
            throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
        }
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        const isAdmin = PermissionGroupManager.hasPermission(userPermissions, 'admin') || user.role === 'ADMIN';
        const version = await localPrisma.serverVersion.findFirst({
            where: { server_id: serverId, version: toVersion }
        });
        if (!version) {
            throw new AppError('Version not found', 404, ErrorCode.NOT_FOUND);
        }
        // Use atomic transaction with proper locking to prevent race conditions during rollback
        const updatedServer = await localPrisma.$transaction(async (tx) => {
            // Re-fetch server within transaction to get latest state and lock it if possible
            const currentServer = await tx.server.findUnique({
                where: { id: serverId }
            });
            if (!currentServer) {
                throw new AppError('Server not found during rollback', 404, ErrorCode.NOT_FOUND);
            }
            // 1. Create a new version of the current state before rolling back
            const lastVersion = await tx.serverVersion.findFirst({
                where: { server_id: serverId },
                orderBy: { version: 'desc' }
            });
            const nextVersionNum = (lastVersion?.version || 0) + 1;
            await tx.serverVersion.create({
                data: {
                    server_id: serverId,
                    version: nextVersionNum,
                    name: currentServer.name,
                    summary: currentServer.summary,
                    content_html: currentServer.content_html,
                    tags: currentServer.tags,
                    ip: currentServer.ip,
                    editor_id: user.id
                }
            });
            // 2. Rollback to target version
            return await tx.server.update({
                where: { id: serverId },
                data: {
                    name: version.name || currentServer.name,
                    summary: version.summary,
                    content_html: version.content_html,
                    tags: version.tags,
                    ip: version.ip,
                    review_status: isAdmin ? currentServer.review_status : 'PENDING',
                    updated_at: new Date()
                }
            });
        });
        await logDataChange(user.id, 'ROLLBACK_SERVER', `server_${updatedServer.id}`, req, server, updatedServer);
        await syncServerToMainDB(updatedServer.id);
        await clearPublicServersCache();
        return sendSuccess(res, updatedServer, `Server rolled back to version ${toVersion}`);
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * Get server details by ID
 */
export const getServer = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
        }
        const { id: serverId } = idValidation.data;
        const authReq = req;
        const user = authReq.user;
        // Try local database first
        let server = await localPrisma.server.findUnique({
            where: { id: serverId },
            include: {
                owner: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        avatar_url: true
                    }
                }
            }
        });
        // Fallback to main database if not in local
        server ??= await prisma.server.findUnique({
            where: { id: serverId },
            include: {
                owner: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        avatar_url: true
                    }
                }
            }
        });
        if (!server) {
            throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
        }
        const listingExpired = Boolean(server.listing_expires_at &&
            new Date(server.listing_expires_at).getTime() <= Date.now());
        if (listingExpired && server.review_status === 'APPROVED') {
            const userPermissions = user?.permissions ? JSON.parse(user.permissions) : [];
            const isAdmin = user?.role === 'ADMIN' || userPermissions.includes('admin') || userPermissions.includes('manage_content');
            if (!user || (server.owner_id !== user.id && !isAdmin)) {
                throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
            }
        }
        // Protection: only owner or admin can view rejected/pending servers
        if (server.review_status !== 'APPROVED') {
            const userPermissions = user?.permissions ? JSON.parse(user.permissions) : [];
            const isAdmin = user?.role === 'ADMIN' || userPermissions.includes('admin') || userPermissions.includes('manage_content');
            if (!user || (server.owner_id !== user.id && !isAdmin)) {
                throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND); // Hide existence
            }
        }
        return sendSuccess(res, server, 'Success');
    }
    catch (error) {
        next(error);
    }
};
/**
 * List server versions
 */
export const listVersions = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
        }
        const { id: serverId } = idValidation.data;
        const user = req.user;
        const queryValidation = serverHistoryQuerySchema.safeParse(req.query);
        if (!queryValidation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, queryValidation.error.issues);
        }
        const { page, limit } = queryValidation.data;
        const skip = (page - 1) * limit;
        const [versions, total] = await Promise.all([
            localPrisma.serverVersion.findMany({
                where: { server_id: serverId },
                include: {
                    editor: {
                        select: {
                            id: true,
                            username: true,
                            display_name: true,
                            avatar_url: true
                        }
                    }
                },
                orderBy: { version: 'desc' },
                skip,
                take: limit,
            }),
            localPrisma.serverVersion.count({ where: { server_id: serverId } })
        ]);
        return sendPaginated(res, versions, total, page, limit);
    }
    catch (error) {
        next(error);
    }
};
/**
 * Compare two saved server content versions (side-by-side data for admin/owner).
 */
export const compareServerVersions = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
        }
        const { id: serverId } = idValidation.data;
        const qVal = compareVersionsQuerySchema.safeParse(req.query);
        if (!qVal.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, qVal.error.issues);
        }
        const { old: vOld, new: vNew } = qVal.data;
        if (vOld === vNew) {
            throw new AppError('old and new version must differ', 400, ErrorCode.VALIDATION_ERROR);
        }
        const user = req.user;
        const versions = await localPrisma.serverVersion.findMany({
            where: { server_id: serverId, version: { in: [vOld, vNew] } },
            include: {
                editor: {
                    select: {
                        id: true,
                        username: true,
                        display_name: true,
                        avatar_url: true,
                    },
                },
            },
        });
        if (versions.length !== 2) {
            throw new AppError('One or both versions were not found', 404, ErrorCode.NOT_FOUND);
        }
        const left = versions.find((v) => v.version === Math.min(vOld, vNew));
        const right = versions.find((v) => v.version === Math.max(vOld, vNew));
        return sendSuccess(res, { left, right, server_id: serverId }, 'Success');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=versions.js.map