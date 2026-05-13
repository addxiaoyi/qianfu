import crypto from 'crypto';
import { logger } from '../utils/logger';
import axios from 'axios';
import prisma from '../db';
import localPrisma from '../localDb';
// SECURITY: CMS configuration must be provided via environment variables
const CMS_URL = process.env.CMS_URL;
const CMS_API_KEY = process.env.CMS_API_KEY;
// Validate CMS configuration
if (!CMS_URL || !CMS_API_KEY) {
    logger.warn('[Sync] CMS not configured - user/server sync to CMS will be disabled');
}
const cmsClient = CMS_URL && CMS_API_KEY ? axios.create({
    baseURL: CMS_URL,
    timeout: 5000,
    headers: {
        'Authorization': `users API-Key ${CMS_API_KEY}`
    }
}) : null;
/**
 * Syncs local server data to the main Supabase database
 */
export const syncServerToMainDB = async (localServerId) => {
    try {
        const localServer = await localPrisma.server.findUnique({
            where: { id: localServerId }
        });
        if (!localServer)
            return;
        // 1. Upsert to main database
        const syncedServer = await prisma.server.upsert({
            where: { id: localServerId },
            update: {
                name: localServer.name,
                name_en: localServer.name_en,
                thumbnail: localServer.thumbnail,
                summary: localServer.summary,
                summary_en: localServer.summary_en,
                content_html: localServer.content_html,
                ip: localServer.ip,
                group_number: localServer.group_number,
                tags: localServer.tags,
                link: localServer.link,
                activity: localServer.activity,
                owner_id: localServer.owner_id,
                review_status: localServer.review_status,
                review_notes: localServer.review_notes,
                reviewed_by: localServer.reviewed_by,
                reviewed_at: localServer.reviewed_at,
                updated_at: localServer.updated_at,
                platform: localServer.platform,
                category: localServer.category,
                online_mode: localServer.online_mode,
                supported_versions: localServer.supported_versions,
                network_env: localServer.network_env,
                like_count: localServer.like_count,
                comment_count: localServer.comment_count,
            },
            create: {
                id: localServerId,
                name: localServer.name,
                name_en: localServer.name_en,
                thumbnail: localServer.thumbnail,
                summary: localServer.summary,
                summary_en: localServer.summary_en,
                content_html: localServer.content_html,
                ip: localServer.ip,
                group_number: localServer.group_number,
                tags: localServer.tags,
                link: localServer.link,
                activity: localServer.activity,
                owner_id: localServer.owner_id,
                review_status: localServer.review_status,
                review_notes: localServer.review_notes,
                reviewed_by: localServer.reviewed_by,
                reviewed_at: localServer.reviewed_at,
                created_at: localServer.created_at,
                updated_at: localServer.updated_at,
                platform: localServer.platform,
                category: localServer.category,
                online_mode: localServer.online_mode,
                supported_versions: localServer.supported_versions,
                network_env: localServer.network_env,
                like_count: localServer.like_count,
                comment_count: localServer.comment_count,
            }
        });
        // 2. Update local sync status
        await localPrisma.server.update({
            where: { id: localServerId },
            data: { synced_at: new Date() }
        });
        // 3. Sync to CMS (non-blocking)
        syncServerToCMS(syncedServer).catch(err => {
            logger.error(`[Sync] Background CMS sync failed for server ${localServerId}:`, {
                error: err instanceof Error ? err.message : String(err),
            });
        });
        // 4. Sync status (non-blocking)
        syncServerStatusToMainDB(localServerId).catch(err => {
            logger.error(`[Sync] Background status sync failed for server ${localServerId}:`, {
                error: err instanceof Error ? err.message : String(err),
            });
        });
        logger.info(`[Sync] Successfully initiated sync for server ${localServerId} to main DB`);
        return syncedServer;
    }
    catch (err) {
        logger.error(`[Sync] Failed to sync server ${localServerId} to main DB:`, {
            error: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
};
/**
 * Syncs local server status to the main Supabase database
 */
export const syncServerStatusToMainDB = async (serverId) => {
    try {
        const localStatus = await localPrisma.serverStatus.findUnique({
            where: { serverId }
        });
        if (!localStatus)
            return;
        // Verify server exists in main DB to maintain referential integrity
        const mainServer = await prisma.server.findUnique({
            where: { id: serverId },
            select: { id: true }
        });
        if (!mainServer) {
            logger.warn(`[Sync] Skipping status sync for server ${serverId}: Not found in main DB`);
            return;
        }
        await prisma.serverStatus.upsert({
            where: { serverId },
            update: {
                online: localStatus.online,
                host: localStatus.host,
                port: localStatus.port,
                versionNameRaw: localStatus.versionNameRaw,
                versionProtocol: localStatus.versionProtocol,
                playersOnline: localStatus.playersOnline,
                playersMax: localStatus.playersMax,
                playersList: localStatus.playersList,
                motdRaw: localStatus.motdRaw,
                motdClean: localStatus.motdClean,
                motdHtml: localStatus.motdHtml,
                favicon: localStatus.favicon,
                srvRecord: localStatus.srvRecord,
                lastUpdated: localStatus.lastUpdated,
            },
            create: {
                serverId: localStatus.serverId,
                online: localStatus.online,
                host: localStatus.host,
                port: localStatus.port,
                versionNameRaw: localStatus.versionNameRaw,
                versionProtocol: localStatus.versionProtocol,
                playersOnline: localStatus.playersOnline,
                playersMax: localStatus.playersMax,
                playersList: localStatus.playersList,
                motdRaw: localStatus.motdRaw,
                motdClean: localStatus.motdClean,
                motdHtml: localStatus.motdHtml,
                favicon: localStatus.favicon,
                srvRecord: localStatus.srvRecord,
                lastUpdated: localStatus.lastUpdated,
            }
        });
        logger.debug(`[Sync] Synced status for server ${serverId} to main DB`);
    }
    catch (err) {
        logger.error(`[Sync] Failed to sync status for server ${serverId}:`, {
            error: err instanceof Error ? err.message : String(err),
        });
        throw err; // Propagate for batch handling
    }
};
/**
 * Periodically sync all unsynced or updated servers and clean up stale data
 */
export const startPeriodicSync = () => {
    const SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes
    const CONCURRENCY_LIMIT = 5; // Max concurrent sync operations
    /**
     * Process items with controlled concurrency
     */
    async function processWithConcurrency(items, processor, concurrency) {
        const results = [];
        for (let i = 0; i < items.length; i += concurrency) {
            const batch = items.slice(i, i + concurrency);
            const batchResults = await Promise.allSettled(batch.map(item => processor(item).catch(err => {
                logger.error(`[Sync] Failed to process item:`, {
                    error: err instanceof Error ? err.message : String(err),
                });
                return null;
            })));
            results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => r.value));
        }
        return results;
    }
    const runSync = async () => {
        try {
            logger.info('[Sync] Starting periodic background sync...');
            // 1. Sync updates/creates for servers with concurrency control
            const unsyncedServers = await localPrisma.$queryRaw `
        SELECT id FROM "Server"
        WHERE synced_at IS NULL OR updated_at > synced_at
        LIMIT 50
      `;
            await processWithConcurrency(unsyncedServers, (server) => syncServerToMainDB(server.id), CONCURRENCY_LIMIT);
            // 2. Sync server statuses (ensure all active servers have status in main DB)
            const approvedServers = await localPrisma.server.findMany({
                where: { review_status: 'APPROVED' },
                select: { id: true }
            });
            await processWithConcurrency(approvedServers, (server) => syncServerStatusToMainDB(server.id), CONCURRENCY_LIMIT);
            // 3. Sync deletions (cleanup main DB servers)
            const mainServerIds = await prisma.server.findMany({
                select: { id: true }
            });
            const localServerIds = new Set((await localPrisma.server.findMany({
                select: { id: true }
            })).map(s => s.id));
            const deletedServerIds = mainServerIds
                .map(s => s.id)
                .filter(id => !localServerIds.has(id));
            if (deletedServerIds.length > 0) {
                logger.info(`[Sync] Found ${deletedServerIds.length} stale servers in main DB. Deleting...`);
                await prisma.server.deleteMany({
                    where: { id: { in: deletedServerIds } }
                });
            }
            // 4. Cleanup orphaned statuses in main DB
            const currentMainServerIds = new Set((await prisma.server.findMany({
                select: { id: true }
            })).map(s => s.id));
            const staleStatusIds = (await prisma.serverStatus.findMany({
                select: { serverId: true }
            }))
                .map(s => s.serverId)
                .filter(id => !currentMainServerIds.has(id));
            if (staleStatusIds.length > 0) {
                logger.info(`[Sync] Found ${staleStatusIds.length} orphaned statuses in main DB. Deleting...`);
                await prisma.serverStatus.deleteMany({
                    where: { serverId: { in: staleStatusIds } }
                });
            }
        }
        catch (err) {
            logger.error('[Sync] Background sync error:', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        finally {
            // Schedule next sync only after current one finishes
            setTimeout(runSync, SYNC_INTERVAL);
        }
    };
    // Start the first sync after a short delay
    setTimeout(runSync, 60000);
};
export const syncUserToCMS = async (user) => {
    if (!cmsClient) {
        if (process.env.NODE_ENV !== 'production') {
            logger.info(`[Sync] CMS not configured - skipping user sync for ${logger.maskData(user.email)}`);
        }
        return;
    }
    try {
        logger.info(`[Sync] Syncing user ${logger.maskData(user.email)} to CMS...`);
        await cmsClient.post('/api/users', {
            email: user.email,
            roles: user.role === 'ADMIN' ? ['admin'] : ['editor'],
            password: crypto.randomBytes(16).toString('hex'),
        }).catch(async (err) => {
            const isDuplicateError = (err.response?.status === 422) ||
                (err.response?.status === 400 && err.response?.data?.errors?.[0]?.data?.errors?.[0]?.message?.includes('already registered'));
            if (isDuplicateError) {
                // User might already exist, try update
                logger.info(`[Sync] User ${logger.maskData(user.email)} already exists, updating...`);
                // Find user ID first
                // SECURITY: Using encodeURIComponent for email query param
                const findRes = await cmsClient.get(`/api/users?where[email][equals]=${encodeURIComponent(user.email)}`);
                if (findRes.data.docs.length > 0) {
                    const cmsUserId = findRes.data.docs[0].id;
                    return cmsClient.patch(`/api/users/${cmsUserId}`, {
                        roles: user.role === 'ADMIN' ? ['admin'] : ['editor'],
                    });
                }
            }
            throw err;
        });
        logger.info(`[Sync] Successfully synced user ${logger.maskData(user.email)} to CMS`);
    }
    catch (err) {
        if (err.code === 'ECONNREFUSED' || String(err.message || '').includes('ECONNREFUSED')) {
            if (process.env.NODE_ENV !== 'production') {
                logger.info(`[Sync] CMS service not available (port 3030) - skipping user sync in development`);
            }
            else {
                logger.warn(`[Sync] CMS service unavailable - user sync failed`);
            }
            return;
        }
        if (err.response) {
            logger.error(`[Sync] CMS response error:`, {
                error: logger.maskData(err.response.data),
            });
        }
    }
};
export const syncServerToCMS = async (server) => {
    if (!cmsClient) {
        logger.debug(`[Sync] CMS not configured - skipping server sync for ${server.name}`);
        return;
    }
    try {
        logger.info(`[Sync] Syncing server ${server.name} to CMS...`);
        await cmsClient.post('/api/servers', {
            name: server.name,
            slug: `server-${server.id}`,
            ip: server.ip,
            summary: server.summary,
            content_html: server.content_html,
            owner_id: server.owner_id,
            original_id: server.id.toString(),
        }).catch(async (err) => {
            const isDuplicateError = (err.response?.status === 422) ||
                (err.response?.status === 400 && err.response?.data?.errors?.[0]?.data?.errors?.[0]?.message?.includes('already exists'));
            if (isDuplicateError) {
                logger.info(`[Sync] Server ${server.name} already exists, updating...`);
                // Find by original_id
                // SECURITY: Using encodeURIComponent for query params
                const findRes = await cmsClient.get(`/api/servers?where[original_id][equals]=${encodeURIComponent(server.id)}`);
                if (findRes.data.docs.length > 0) {
                    const cmsId = findRes.data.docs[0].id;
                    return cmsClient.patch(`/api/servers/${cmsId}`, {
                        name: server.name,
                        ip: server.ip,
                        summary: server.summary,
                        content_html: server.content_html,
                        owner_id: server.owner_id,
                    });
                }
            }
            throw err;
        });
        logger.info(`[Sync] Successfully synced server ${server.name} to CMS`);
    }
    catch (err) {
        logger.error(`[Sync] Failed to sync server to CMS:`, {
            error: err instanceof Error ? err.message : String(err),
        });
    }
};
//# sourceMappingURL=syncService.js.map