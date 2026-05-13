import { Router } from 'express';
import prisma from '../db';
import { sendSuccess } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { withCache, cacheDelete } from '../services/cache';
import { serversLimiter } from '../middleware/rateLimiter';
import { redisService } from '../services/redisService';
import { logger } from '../utils/logger';
const router = Router();
const GLOBAL_STATS_CACHE_KEY = 'global_stats';
router.get('/stats', serversLimiter, async (_req, res, _next) => {
    try {
        const stats = await withCache(GLOBAL_STATS_CACHE_KEY, async () => {
            const [totalUsers, totalServers, onlineServers, totalPlayersData] = await Promise.all([
                prisma.user.count({
                    where: {
                        username: { not: null }
                    }
                }),
                prisma.server.count({ where: { review_status: 'APPROVED' } }),
                prisma.serverStatus.count({
                    where: {
                        online: true,
                        server: {
                            review_status: 'APPROVED'
                        }
                    }
                }),
                prisma.serverStatus.aggregate({
                    where: {
                        server: {
                            review_status: 'APPROVED'
                        }
                    },
                    _sum: {
                        playersOnline: true
                    }
                })
            ]);
            return {
                totalUsers,
                totalServers,
                onlineServers,
                totalPlayers: totalPlayersData._sum.playersOnline || 0
            };
        }, { ttl: 300000 }); // 5 minutes cache
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