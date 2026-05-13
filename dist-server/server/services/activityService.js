import localPrisma from '../localDb';
import { logger } from '../utils/logger';
import { getMultipleServerStatus } from '../intelligent-probe/services/minecraftProbeService';
import { clearPublicServersCache } from './publicServerCache';
/**
 * Service to manage server activity calculations and updates
 */
export class ActivityService {
    static interval = null;
    static IS_RUNNING = false;
    /**
     * Start the periodic activity update job
     * @param intervalMs How often to update (default 10 minutes)
     */
    static start(intervalMs = 10 * 60 * 1000) {
        if (this.interval)
            return;
        logger.info(`[ActivityService] Starting periodic activity updates every ${intervalMs / 60000}m`);
        // Initial run after a short delay
        setTimeout(() => this.updateAllServerActivity(), 5000);
        this.interval = setInterval(() => {
            this.updateAllServerActivity();
        }, intervalMs);
    }
    /**
     * Stop the periodic job
     */
    static stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    /**
     * Update activity for all approved servers
     */
    static async updateAllServerActivity() {
        if (this.IS_RUNNING) {
            logger.warn('[ActivityService] Update already in progress, skipping...');
            return;
        }
        this.IS_RUNNING = true;
        const startTime = Date.now();
        try {
            // 1. Get all approved servers with current activity and status
            const servers = await localPrisma.server.findMany({
                where: { review_status: 'APPROVED' },
                select: {
                    id: true,
                    ip: true,
                    tags: true,
                    activity: true
                }
            });
            if (servers.length === 0) {
                logger.debug('[ActivityService] No approved servers to probe');
                this.IS_RUNNING = false;
                return;
            }
            logger.info(`[ActivityService] Probing ${servers.length} servers...`);
            // 2. Prepare probe requests
            const probeRequests = servers.map(s => {
                const isBedrock = s.tags?.toLowerCase().includes('bedrock') || s.tags?.toLowerCase().includes('基岩');
                return {
                    id: String(s.id),
                    host: s.ip,
                    bedrock: !!isBedrock
                };
            });
            // 3. Perform parallel probe
            const results = await getMultipleServerStatus(probeRequests);
            // 4. Update database - Use batch updates to avoid N+1 queries
            let updatedCount = 0;
            const serverUpdates = [];
            const statusUpserts = [];
            for (const result of results) {
                if (!result.id)
                    continue;
                const serverId = parseInt(result.id);
                const server = servers.find(s => s.id === serverId);
                if (!server)
                    continue;
                const currentActivity = server.activity || 0;
                const wasOnline = false;
                const isOnline = result.status?.online || false;
                const instantScore = this.calculateInstantScore(result);
                let activityScore;
                if (isOnline) {
                    // EMA (Exponential Moving Average) for smoothing
                    // 0.8 old + 0.2 new (Standard)
                    const alpha = 0.2;
                    activityScore = Math.floor(currentActivity * (1 - alpha) + instantScore * alpha);
                    // Stability bonus: if was online last time, add small consistency bonus
                    if (wasOnline) {
                        activityScore += 2;
                    }
                    // Minimum activity for online servers to ensure visibility
                    activityScore = Math.max(activityScore, 5);
                }
                else {
                    // Decay score when offline (Exponential decay)
                    // 0.9 retention rate per update interval
                    activityScore = Math.floor(currentActivity * 0.9);
                }
                // Collect server activity update
                serverUpdates.push({ id: serverId, activity: activityScore });
                // Collect server status upsert data
                const status = result.status;
                statusUpserts.push({
                    serverId,
                    online: isOnline,
                    host: status.host || result.host,
                    port: status.port || (result.bedrock ? 19132 : 25565),
                    versionNameRaw: status.version?.name_raw || null,
                    versionProtocol: status.version?.protocol || null,
                    playersOnline: status.players?.online || 0,
                    playersMax: status.players?.max || 0,
                    playersList: JSON.stringify(status.players?.list || []),
                    motdRaw: status.motd?.raw || null,
                    motdClean: status.motd?.clean || null,
                    motdHtml: status.motd?.html || null,
                    favicon: status.favicon || null,
                    srvRecord: status.srv_record ? JSON.stringify(status.srv_record) : null,
                    lastUpdated: new Date()
                });
                updatedCount++;
            }
            // Execute batch updates in a single transaction
            if (serverUpdates.length > 0 || statusUpserts.length > 0) {
                await localPrisma.$transaction(async (tx) => {
                    // Batch update server activities
                    if (serverUpdates.length > 0) {
                        const activityUpdatePromises = serverUpdates.map(({ id, activity }) => tx.server.update({ where: { id }, data: { activity } }));
                        await Promise.all(activityUpdatePromises);
                    }
                    // Batch upsert server statuses
                    for (const statusData of statusUpserts) {
                        await tx.serverStatus.upsert({
                            where: { serverId: statusData.serverId },
                            update: statusData,
                            create: statusData
                        });
                    }
                });
            }
            // 5. Clear cache to reflect new activity scores
            if (updatedCount > 0) {
                await clearPublicServersCache();
            }
            const duration = Date.now() - startTime;
            logger.info(`[ActivityService] Successfully updated ${updatedCount} servers in ${duration}ms`);
        }
        catch (error) {
            logger.error('[ActivityService] Error during activity update:', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            this.IS_RUNNING = false;
        }
    }
    /**
     * Calculate instant activity score based on current probe status
     * @param result Probe result including status and duration
     */
    static calculateInstantScore(result) {
        const status = result.status;
        if (!status || !status.online)
            return 0;
        let score = 0;
        // 1. Online Base Score
        score += 10;
        // 2. Player Count Score (Logarithmic scale to balance small/large servers)
        // Avoids massive servers dominating simply by raw count
        // log10(1) = 0, log10(10) = 1, log10(100) = 2, log10(1000) = 3
        const playersOnline = status.players?.online || 0;
        if (playersOnline > 0) {
            score += Math.floor(Math.log10(playersOnline) * 20);
        }
        // 3. Uptime/Stability (approximated by success/duration)
        // Reward lower response times (duration is in ms)
        const duration = result.duration || 1000;
        const latencyBonus = Math.max(0, 20 - Math.floor(duration / 50)); // Max 20 points for <50ms
        score += latencyBonus;
        // 4. Version Bonus (Encourage latest versions)
        // This is hard to determine dynamically without a version map, so we skip for now
        // or give small static bonus if version info is present
        if (status.version?.name_raw) {
            score += 5;
        }
        return score;
    }
}
//# sourceMappingURL=activityService.js.map