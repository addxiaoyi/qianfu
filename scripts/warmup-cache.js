import prisma from '../server/db';
import { redisService } from '../server/services/redisService';
import { logger } from '../server/utils/logger';
const GLOBAL_STATS_CACHE_KEY = 'global_stats';
const PUBLIC_SERVERS_CACHE_PREFIX = 'server:public_list:';
const PUBLIC_SERVERS_TTL = 3600; // 预热时可以设置长一点，或者根据业务需求
const GLOBAL_STATS_TTL = 3600;
/**
 * 缓存预热脚本
 * 目的：在系统启动或定期执行，提前填充高频访问的 Redis 缓存，减少冷启动压力
 */
async function warmUpCache() {
    logger.info('[WarmUp] Starting Redis cache warm-up...');
    try {
        // 1. 等待 Redis 连接
        if (!redisService.getStatus()) {
            logger.info('[WarmUp] Waiting for Redis connection...');
            for (let i = 0; i < 50; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (redisService.getStatus())
                    break;
            }
        }
        if (!redisService.getStatus()) {
            logger.error('[WarmUp] Redis not connected, skipping warm-up.');
            return;
        }
        // 2. 预热全局统计数据 (Global Stats)
        logger.info('[WarmUp] Warming up global statistics...');
        const [totalUsers, totalServers, onlineServers, totalPlayersData] = await Promise.all([
            prisma.user.count({
                where: { username: { not: null } }
            }),
            prisma.server.count({ where: { review_status: 'APPROVED' } }),
            prisma.serverStatus.count({
                where: {
                    online: true,
                    server: { review_status: 'APPROVED' }
                }
            }),
            prisma.serverStatus.aggregate({
                where: {
                    server: { review_status: 'APPROVED' }
                },
                _sum: { playersOnline: true }
            })
        ]);
        const stats = {
            totalUsers,
            totalServers,
            onlineServers,
            totalPlayers: totalPlayersData._sum.playersOnline || 0,
            warmed_at: new Date().toISOString()
        };
        await redisService.set(GLOBAL_STATS_CACHE_KEY, stats, GLOBAL_STATS_TTL);
        logger.info('[WarmUp] Global statistics warmed up.');
        // 3. 预热首页服务器列表 (第一页)
        logger.info('[WarmUp] Warming up public server list (Page 1)...');
        const page = 1;
        const limit = 20; // 默认每页数量
        const cacheKey = `${PUBLIC_SERVERS_CACHE_PREFIX}${page}_${limit}____`; // 对应 listAllServers 的 key 生成逻辑
        const servers = await prisma.server.findMany({
            where: { review_status: 'APPROVED' },
            select: {
                id: true,
                name: true,
                name_en: true,
                thumbnail: true,
                summary: true,
                summary_en: true,
                ip: true,
                group_number: true,
                tags: true,
                activity: true,
                updated_at: true,
                owner_id: true,
                link: true,
                review_status: true
            },
            orderBy: [
                { activity: 'desc' },
                { updated_at: 'desc' }
            ],
            skip: 0,
            take: limit,
        });
        const total = await prisma.server.count({ where: { review_status: 'APPROVED' } });
        await redisService.set(cacheKey, { servers, total }, PUBLIC_SERVERS_TTL);
        logger.info(`[WarmUp] Public server list (Page 1) warmed up with ${servers.length} servers.`);
        logger.info('[WarmUp] Cache warm-up completed successfully.');
    }
    catch (error) {
        logger.error('[WarmUp] Cache warm-up failed:', error.message);
    }
    finally {
        // 如果是独立脚本运行，可以退出
        if (isMain) {
            process.exit(0);
        }
    }
}
// 如果直接运行此文件
const isMain = typeof require !== 'undefined' && require.main === module || (typeof import.meta.url !== 'undefined' && process.argv[1]?.includes('warmup-cache'));
if (isMain) {
    warmUpCache();
}
export { warmUpCache };
//# sourceMappingURL=warmup-cache.js.map