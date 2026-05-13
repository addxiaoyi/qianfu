import { Router } from 'express';
import prisma from '../db';
import { sendSuccess } from '../utils/response';
import { visitLimiter, adminLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';
import { withCache } from '../services/cache';
import { visitSchema, visitStatsQuerySchema } from '../utils/validation';
import { logger } from '../utils/logger';

const router = Router();

router.post('/visit', visitLimiter, async (req, res) => {
  try {
    const validation = visitSchema.safeParse(req.body);
    if (!validation.success) {
      return sendSuccess(res, { recorded: false });
    }
    const { page } = validation.data;
    const userAgent = req.get('User-Agent') || 'unknown';
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    await prisma.auditLog.create({
      data: {
        action: 'PAGE_VISIT',
        target: page || 'homepage',
        ip_address: clientIp as string,
        details: JSON.stringify({
          userAgent,
          referer: req.get('Referer'),
          timestamp: new Date().toISOString()
        }) as string
      }
    });

    return sendSuccess(res, { recorded: true });
  } catch (error: any) {
    logger.error('[Visit] Failed to record visit:', { error: error.message });
    return sendSuccess(res, { recorded: false });
  }
});

router.get('/visit/stats', authenticate, adminLimiter, async (req, res) => {
  try {
    const validation = visitStatsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return sendSuccess(res, { totalVisits: 0, uniqueVisitors: 0, todayVisits: 0 });
    }
    const { days: daysNum } = validation.data;
    const cacheKey = `visit:stats:${daysNum}`;

    const stats = await withCache(cacheKey, async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const [totalVisits, uniqueVisitors, todayVisits] = await Promise.all([
        prisma.auditLog.count({
          where: {
            action: 'PAGE_VISIT',
            created_at: { gte: startDate }
          }
        }),
        prisma.auditLog.groupBy({
          by: ['ip_address'],
          where: {
            action: 'PAGE_VISIT',
            created_at: { gte: startDate }
          }
        }),
        prisma.auditLog.count({
          where: {
            action: 'PAGE_VISIT',
            created_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        })
      ]);

      return {
        totalVisits,
        uniqueVisitors: uniqueVisitors.length,
        todayVisits,
        period: `${daysNum} days`
      };
    }, { ttl: 300000 }); // 5 minutes cache

    return sendSuccess(res, stats);
  } catch (error: any) {
    logger.error('[VisitStats] Failed to get stats:', { error: error.message });
    return sendSuccess(res, {
      totalVisits: 0,
      uniqueVisitors: 0,
      todayVisits: 0
    });
  }
});

router.get('/visit/popular-pages', authenticate, adminLimiter, async (req, res) => {
  try {
    const validation = visitStatsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return sendSuccess(res, { pages: [] });
    }
    const { days: daysNum } = validation.data;
    const cacheKey = `visit:popular-pages:${daysNum}`;

    const result = await withCache(cacheKey, async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const pages = await prisma.auditLog.groupBy({
        by: ['target'],
        where: {
          action: 'PAGE_VISIT',
          created_at: { gte: startDate }
        },
        _count: { target: true },
        orderBy: { _count: { target: 'desc' } },
        take: 10
      });

      return {
        pages: pages.map(p => ({
          page: p.target,
          visits: p._count.target
        }))
      };
    }, { ttl: 300000 }); // 5 minutes cache

    return sendSuccess(res, result);
  } catch (error: any) {
    logger.error('[VisitStats] Failed to get popular pages', { error });
    return sendSuccess(res, { pages: [] });
  }
});

export default router;
