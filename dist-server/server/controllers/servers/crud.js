import localPrisma from '../../localDb';
import { serverSchema, idParamSchema, validateHost, isSafeHostname } from '../../utils/validation';
import { sanitize } from '../../services/sanitize';
import { AppError, ErrorCode, handleError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import { syncServerToMainDB } from '../../services/syncService';
import { ModerationService } from '../../services/moderationService';
import { redisService } from '../../services/redisService';
import { logDataChange } from '../../services/auditService';
import { hookService, MotiaHook } from '../../services/hookService';
import { clearPublicServersCache } from '../../services/publicServerCache';
import { PermissionGroupManager } from '../../config/permissionGroups';
import { getEffectiveServerLimit, userCanPublishServers } from '../../services/userLevelService';
import { logger } from '../../utils/logger';
/**
 * Helper: Check effective server creation limit
 */
function effectiveServerCap(user) {
    return getEffectiveServerLimit(user);
}
/**
 * Create a new server
 */
export const createServer = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        if (!userCanPublishServers(user)) {
            throw new AppError('需要开通发布权限或订阅套餐后才能创建服务器', 403, ErrorCode.PERMISSION_DENIED);
        }
        const validation = serverSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { name, name_en, thumbnail, summary, summary_en, content_html, ip, group_number, tags, link, activity, platform, category, online_mode, supported_versions, network_env } = validation.data;
        // Strict sanitization for all fields
        const cleanName = sanitize(name, { allowedTags: [] });
        const cleanNameEn = name_en ? sanitize(name_en, { allowedTags: [] }) : undefined;
        const cleanSummary = summary ? sanitize(summary, { allowedTags: [] }) : undefined;
        const cleanSummaryEn = summary_en ? sanitize(summary_en, { allowedTags: [] }) : undefined;
        const cleanGroupNumber = group_number ? sanitize(group_number, { allowedTags: [] }) : undefined;
        const cleanLink = link ? sanitize(link, { allowedTags: [] }) : undefined;
        const cleanCategory = category ? sanitize(category, { allowedTags: [] }) : undefined;
        const sanitizedContent = content_html ? sanitize(content_html) : '';
        // Sanitize tags (JSON array of strings)
        let cleanTags = '[]';
        if (tags) {
            try {
                const parsedTags = JSON.parse(tags);
                if (Array.isArray(parsedTags)) {
                    const sanitizedTags = parsedTags.map(tag => sanitize(String(tag), { allowedTags: [] }));
                    cleanTags = JSON.stringify(sanitizedTags);
                }
            }
            catch (e) {
                cleanTags = '[]';
            }
        }
        const limit = effectiveServerCap(user);
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        const isAdmin = PermissionGroupManager.hasPermission(userPermissions, 'admin') || user.role === 'ADMIN';
        // Activity and owner_id protection: only admins can set these
        const finalActivity = isAdmin && activity !== undefined ? activity : 0;
        const finalOwnerId = isAdmin && validation.data.owner_id !== undefined ? validation.data.owner_id : user.id;
        // IP/Host Normalization & Duplicate Check
        let cleanIp = undefined;
        if (ip) {
            cleanIp = ip.toLowerCase().trim().replace(/^https?:\/\//, '');
            const hostError = validateHost(cleanIp);
            if (hostError) {
                throw new AppError(hostError.message, 400, ErrorCode.VALIDATION_ERROR);
            }
            if (!await isSafeHostname(cleanIp)) {
                throw new AppError('Access to internal network addresses is forbidden', 400, ErrorCode.VALIDATION_ERROR);
            }
            const duplicateServer = await localPrisma.server.findFirst({
                where: {
                    ip: { equals: cleanIp },
                    review_status: { not: 'REJECTED' }
                }
            });
            if (duplicateServer) {
                throw new AppError('A server with this IP is already listed', 400, ErrorCode.VALIDATION_ERROR);
            }
        }
        const server = await redisService.withLock(`user:create_server:${user.id}`, async () => {
            const count = await localPrisma.server.count({ where: { owner_id: user.id } });
            if (count >= limit && !isAdmin) {
                throw new AppError('Server limit exceeded', 403, ErrorCode.FORBIDDEN);
            }
            const moderationText = `${cleanName} ${cleanSummary || ''} ${sanitizedContent} ${cleanIp || ''} ${cleanGroupNumber || ''} ${cleanTags || ''}`;
            const moderationResult = await ModerationService.checkText(moderationText, user.id);
            if (!moderationResult.passed) {
                throw new AppError(moderationResult.reason || 'Content violation', 400, ErrorCode.VALIDATION_ERROR);
            }
            return await localPrisma.server.create({
                data: {
                    name: cleanName,
                    name_en: cleanNameEn,
                    thumbnail,
                    summary: cleanSummary,
                    summary_en: cleanSummaryEn,
                    content_html: sanitizedContent,
                    ip: cleanIp,
                    group_number: cleanGroupNumber,
                    tags: cleanTags,
                    link: cleanLink,
                    activity: finalActivity,
                    owner_id: finalOwnerId,
                    review_status: isAdmin ? 'APPROVED' : 'PENDING',
                    platform: platform ?? undefined,
                    category: cleanCategory,
                    online_mode: online_mode ?? undefined,
                    supported_versions: supported_versions ?? undefined,
                    network_env: network_env ?? undefined,
                }
            });
        });
        await logDataChange(user.id, 'CREATE_SERVER', `server_${server.id}`, req, null, server);
        await syncServerToMainDB(server.id);
        hookService.trigger(MotiaHook.SERVER_CREATED, { server, user });
        await clearPublicServersCache();
        return sendSuccess(res, server, 'Success');
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * Update an existing server
 */
export const updateServer = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
        }
        const { id: serverId } = idValidation.data;
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const existingServer = await localPrisma.server.findUnique({
            where: { id: serverId }
        });
        if (!existingServer) {
            throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
        }
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        const isAdmin = PermissionGroupManager.hasPermission(userPermissions, 'admin') || user.role === 'ADMIN';
        if (existingServer.owner_id !== user.id && !isAdmin) {
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        }
        const validation = serverSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { name, name_en, summary, summary_en, content_html, ip, group_number, tags, link, platform, category, online_mode, supported_versions, network_env, thumbnail: bodyThumbnail, activity: bodyActivity, owner_id: bodyOwnerId, } = validation.data;
        // Strict sanitization for all fields
        const cleanName = sanitize(name, { allowedTags: [] });
        const cleanNameEn = name_en ? sanitize(name_en, { allowedTags: [] }) : undefined;
        const cleanSummary = summary ? sanitize(summary, { allowedTags: [] }) : undefined;
        const cleanSummaryEn = summary_en ? sanitize(summary_en, { allowedTags: [] }) : undefined;
        const cleanGroupNumber = group_number ? sanitize(group_number, { allowedTags: [] }) : undefined;
        const cleanLink = link ? sanitize(link, { allowedTags: [] }) : undefined;
        const cleanCategory = category !== undefined ? (category ? sanitize(category, { allowedTags: [] }) : null) : undefined;
        const sanitizedContent = content_html ? sanitize(content_html) : '';
        // Sanitize tags (JSON array of strings)
        let cleanTags = existingServer.tags;
        if (tags) {
            try {
                const parsedTags = JSON.parse(tags);
                if (Array.isArray(parsedTags)) {
                    const sanitizedTags = parsedTags.map(tag => sanitize(String(tag), { allowedTags: [] }));
                    cleanTags = JSON.stringify(sanitizedTags);
                }
            }
            catch (e) {
                cleanTags = '[]';
            }
        }
        // IP/Host Normalization & Duplicate Check
        let finalIp = existingServer.ip ?? '';
        if (ip) {
            finalIp = ip.toLowerCase().trim().replace(/^https?:\/\//, '');
            if (finalIp !== existingServer.ip) {
                const hostError = validateHost(finalIp);
                if (hostError) {
                    throw new AppError(hostError.message, 400, ErrorCode.VALIDATION_ERROR);
                }
                if (!await isSafeHostname(finalIp)) {
                    throw new AppError('Access to internal network addresses is forbidden', 400, ErrorCode.VALIDATION_ERROR);
                }
                const duplicateServer = await localPrisma.server.findFirst({
                    where: {
                        ip: { equals: finalIp },
                        id: { not: serverId },
                        review_status: { not: 'REJECTED' }
                    }
                });
                if (duplicateServer) {
                    throw new AppError('A server with this IP is already listed', 400, ErrorCode.VALIDATION_ERROR);
                }
            }
        }
        const cleanIp = finalIp;
        const moderationText = `${cleanName} ${cleanSummary || ''} ${sanitizedContent} ${cleanIp || ''} ${cleanGroupNumber || ''} ${cleanTags || ''}`;
        const moderationResult = await ModerationService.checkText(moderationText, user.id);
        if (!moderationResult.passed) {
            throw new AppError(moderationResult.reason || 'Content violation', 400, ErrorCode.VALIDATION_ERROR);
        }
        const updateData = {
            name: cleanName,
            name_en: cleanNameEn,
            summary: cleanSummary,
            summary_en: cleanSummaryEn,
            ip: cleanIp,
            group_number: cleanGroupNumber,
            tags: cleanTags,
            link: cleanLink,
            content_html: sanitizedContent,
            thumbnail: bodyThumbnail !== undefined ? bodyThumbnail : existingServer.thumbnail,
            platform: platform !== undefined ? platform : existingServer.platform,
            category: category !== undefined ? cleanCategory : existingServer.category,
            online_mode: online_mode !== undefined ? online_mode : existingServer.online_mode,
            supported_versions: supported_versions !== undefined ? supported_versions : existingServer.supported_versions,
            network_env: network_env !== undefined ? network_env : existingServer.network_env,
            review_status: isAdmin ? existingServer.review_status : 'PENDING',
            reviewed_at: isAdmin ? existingServer.reviewed_at : null,
            reviewed_by: isAdmin ? existingServer.reviewed_by : null,
        };
        if (isAdmin && bodyActivity !== undefined) {
            updateData.activity = bodyActivity;
        }
        if (isAdmin && bodyOwnerId !== undefined) {
            updateData.owner_id = bodyOwnerId;
        }
        const updatedServer = await localPrisma.$transaction(async (tx) => {
            // 1. Save current version before updating
            const lastVersion = await tx.serverVersion.findFirst({
                where: { server_id: serverId },
                orderBy: { version: 'desc' }
            });
            const nextVersionNum = (lastVersion?.version || 0) + 1;
            await tx.serverVersion.create({
                data: {
                    server_id: serverId,
                    version: nextVersionNum,
                    name: existingServer.name,
                    summary: existingServer.summary,
                    content_html: existingServer.content_html,
                    tags: existingServer.tags,
                    ip: existingServer.ip,
                    editor_id: user.id
                }
            });
            // 2. Update server
            return await tx.server.update({
                where: { id: serverId },
                data: updateData
            });
        });
        await logDataChange(user.id, 'UPDATE_SERVER', `server_${updatedServer.id}`, req, existingServer, updatedServer);
        await syncServerToMainDB(updatedServer.id);
        hookService.trigger(MotiaHook.SERVER_UPDATED, {
            old: existingServer,
            new: updatedServer,
            user
        });
        await clearPublicServersCache();
        return sendSuccess(res, updatedServer, 'Success');
    }
    catch (error) {
        next(error);
    }
};
/**
 * Delete a server
 */
export const deleteServer = async (req, res, next) => {
    try {
        const idValidation = idParamSchema.safeParse(req.params);
        if (!idValidation.success) {
            throw new AppError('Invalid server ID', 400, ErrorCode.VALIDATION_ERROR, false, idValidation.error.issues);
        }
        const { id: serverId } = idValidation.data;
        const user = req.user;
        const existingServer = await localPrisma.server.findUnique({
            where: { id: serverId }
        });
        if (!existingServer) {
            throw new AppError('Server not found', 404, ErrorCode.NOT_FOUND);
        }
        const userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        const isAdmin = PermissionGroupManager.hasPermission(userPermissions, 'admin') || user.role === 'ADMIN';
        if (existingServer.owner_id !== user.id && !isAdmin) {
            throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
        }
        await localPrisma.server.delete({
            where: { id: serverId }
        });
        try {
            // 主数据库删除（可选，周期性同步会处理）
            // 注意：这里不需要显式删除，syncService 会处理
        }
        catch (e) {
            logger.warn(`[Delete] Main DB delete failed for server ${serverId}, periodic sync will handle it.`);
        }
        await logDataChange(user.id, 'DELETE_SERVER', `server_${serverId}`, req, existingServer, null);
        hookService.trigger(MotiaHook.SERVER_DELETED, { server: existingServer, user });
        await clearPublicServersCache();
        return sendSuccess(res, null, 'Server deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=crud.js.map