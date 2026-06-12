import { Router } from 'express';
import prisma from '../db.js';
import { sendSuccess } from '../utils/response.js';
import { authenticate } from '../middleware/auth.js';
import { csrfProtection } from '../middleware/csrf.js';
import { withCache, cacheDelete } from '../services/cache.js';
import { serversLimiter } from '../middleware/rateLimiter.js';
import { redisService } from '../services/redisService.js';
import { logger } from '../utils/logger.js';
const router = Router();
const GLOBAL_STATS_CACHE_KEY = 'global_stats';
async function getGlobalStats() {
    const activeListingWhere = {
        review_status: 'APPROVED',
        OR: [
            { listing_expires_at: null },
            { listing_expires_at: { gt: new Date() } },
        ],
    };
    return withCache(GLOBAL_STATS_CACHE_KEY, async () => {
        const [totalUsers, totalServers, onlineServers, totalPlayersData] = await Promise.all([
            prisma.user.count({
                where: {
                    username: { not: null },
                },
            }),
            prisma.server.count({ where: activeListingWhere }),
            prisma.serverStatus.count({
                where: {
                    online: true,
                    server: {
                        ...activeListingWhere,
                    },
                },
            }),
            prisma.serverStatus.aggregate({
                where: {
                    server: {
                        ...activeListingWhere,
                    },
                },
                _sum: {
                    playersOnline: true,
                },
            }),
        ]);
        return {
            totalUsers,
            totalServers,
            onlineServers,
            totalPlayers: totalPlayersData._sum?.playersOnline || 0,
        };
    }, { ttl: 300000 });
}
router.get('/stats', serversLimiter, async (_req, res, _next) => {
    try {
        const stats = await getGlobalStats();
        return sendSuccess(res, stats, 'Statistics retrieved successfully');
    }
    catch (error) {
        logger.error('[Stats] Failed to get stats:', { error: error.message });
        return sendSuccess(res, {
            totalUsers: 0,
            totalServers: 0,
            onlineServers: 0,
            totalPlayers: 0
        }, 'Using fallback statistics');
    }
});
// Legacy frontend compatibility route used by the landing page.
router.get('/servers/stats', serversLimiter, async (_req, res) => {
    try {
        const stats = await getGlobalStats();
        const availability = stats.totalServers > 0
            ? `${Math.round((stats.onlineServers / stats.totalServers) * 100)}%`
            : '0%';
        return sendSuccess(res, {
            onlineNodes: stats.onlineServers,
            syncLatency: '<1s',
            avgResponseTime: '18ms',
            availability,
            totalServers: stats.totalServers,
            totalUsers: stats.totalUsers,
            totalPlayers: stats.totalPlayers,
        }, 'Landing statistics retrieved successfully', 200, undefined, { mask: false });
    }
    catch (error) {
        logger.error('[Stats] Failed to get legacy landing stats:', { error: error.message });
        return sendSuccess(res, {
            onlineNodes: 0,
            syncLatency: '—',
            avgResponseTime: '—',
            availability: '0%',
            totalServers: 0,
            totalUsers: 0,
            totalPlayers: 0,
        }, 'Using fallback landing statistics', 200, undefined, { mask: false });
    }
});
/**
 * Force clear stats cache (Admin only)
 */
router.post('/stats/clear', authenticate, csrfProtection, async (req, res, next) => {
    try {
        const userPermissions = req.user?.permissions ? JSON.parse(req.user.permissions) : [];
        if (!req.isAdmin && !userPermissions.includes('manage_stats')) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        cacheDelete('global_stats');
        await redisService.del('global_stats');
        return sendSuccess(res, null, 'Stats cache cleared');
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=stats.js.map