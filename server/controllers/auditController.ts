import { Response, NextFunction } from 'express';
import prisma from '../db';
import { AuditAnalyzer } from '../config/auditConfig';
import { AuthRequest } from '../middleware/auth';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess, sendListResponse } from '../utils/response';
import { logAction } from '../services/auditService';
import { withCache } from '../services/cache';
import { auditLogQuerySchema, auditStatsQuerySchema, auditTimeSeriesQuerySchema, auditReportSchema, auditCleanupSchema, auditExportSchema } from '../utils/validation';
import {
  buildDateRange,
  buildPagination,
  resolveSortField,
  resolveSortOrder,
} from '../utils/queryBuilder';
import { getPrimaryDbProvider } from '../utils/dbProvider';

/**
 * Get audit logs
 */
export const getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = auditLogQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }

    const { 
      action, 
      userId, 
      search,
      startDate, 
      endDate,
      level,
      sortBy,
      sortOrder,
      page,
      limit
    } = validation.data;

    const { skip, take } = buildPagination({ page, limit });

    const whereClause: any = {};

    if (action) {
      const normalizedAction = action.trim();
      if (normalizedAction.includes('*')) {
        const pattern = normalizedAction.replaceAll('*', '');
        if (pattern.length > 0) {
          whereClause.action = { contains: pattern };
        }
      } else {
        whereClause.action = normalizedAction;
      }
    }

    if (userId) {
      whereClause.user_id = userId;
    }

    if (level) {
      whereClause.level = level;
    }

    if (search) {
      whereClause.OR = [
        { action: { contains: search } },
        { target: { contains: search } },
        { details: { contains: search } },
        { ip_address: { contains: search } },
      ];
    }

    const range = buildDateRange({ startDate, endDate });
    if (range) {
      whereClause.created_at = range;
    }

    const normalizedSortField = resolveSortField(
      sortBy,
      ['created_at', 'action'] as const,
      'created_at',
    );
    const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');

    const [auditLogs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              username: true,
              email: true,
              role: true
            }
          }
        } as const,
        skip,
        take,
        orderBy: {
          [normalizedSortField]: normalizedSortOrder,
        }
      }),
      prisma.auditLog.count({
        where: whereClause
      })
    ]);

    return sendListResponse(res, auditLogs, totalCount, page, limit, { resource: 'Audit log' });

  } catch (error) {
    next(error);
  }
};

/**
 * Get audit statistics
 */
export const getAuditStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = auditStatsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { days: daysNum } = validation.data;
    const cacheKey = `audit:stats:${daysNum}`;

    const stats = await withCache(cacheKey, async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const [totalEvents, todayEvents, eventsByType, eventsByUser] = await Promise.all([
        prisma.auditLog.count({
          where: {
            created_at: {
              gte: startDate
            }
          }
        }),
        prisma.auditLog.count({
          where: {
            created_at: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          _count: {
            id: true
          },
          where: {
            created_at: {
              gte: startDate
            }
          },
          orderBy: {
            _count: {
              id: 'desc'
            }
          }
        }),
        prisma.auditLog.groupBy({
          by: ['user_id'],
          _count: {
            id: true
          },
          where: {
            created_at: {
              gte: startDate
            }
          },
          orderBy: {
            _count: {
              id: 'desc'
            }
          },
          take: 10
        })
      ]);

      const userEvents = await Promise.all(
        eventsByUser.map(async (item) => {
          if (!item.user_id) return null;
          const user = await prisma.user.findUnique({
            where: { id: item.user_id },
            select: {
              username: true,
              email: true,
              role: true
            }
          });

          return {
            user_id: item.user_id,
            username: user?.username,
            email: user?.email,
            role: user?.role,
            event_count: item._count.id
          };
        })
      );

      return {
        period: `${daysNum}d`,
        totalEvents,
        todayEvents,
        eventsByType: eventsByType.reduce((acc: any, item) => {
          acc[item.action] = item._count.id;
          return acc;
        }, {}),
        topUsers: userEvents.filter(Boolean),
        startDate,
        endDate: new Date()
      };
    }, { ttl: 300000 }); // Cache for 5 minutes

    return sendSuccess(res, stats, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit log time series data
 */
export const getAuditTimeSeries = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = auditTimeSeriesQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { days, interval } = validation.data;

    const cacheKey = `audit:timeseries:${days}:${interval}`;

    const data = await withCache(cacheKey, async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const provider = getPrimaryDbProvider();
      let results: any[] = [];
      if (provider === 'sqlite') {
        const dateFormat = interval === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
        results = await prisma.$queryRawUnsafe(
          `SELECT strftime(?, created_at) as time, count(*) as count
           FROM AuditLog
           WHERE created_at >= ?
           GROUP BY time
           ORDER BY time ASC`,
          dateFormat,
          startDate.toISOString()
        );
      } else if (provider === 'mysql') {
        const dateFormat = interval === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
        results = await prisma.$queryRawUnsafe(
          `SELECT DATE_FORMAT(created_at, ?) as time, COUNT(*) as count
           FROM AuditLog
           WHERE created_at >= ?
           GROUP BY time
           ORDER BY time ASC`,
          dateFormat,
          startDate
        );
      } else {
        const dateFormat = interval === 'hour' ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD';
        results = await prisma.$queryRawUnsafe(
          `SELECT TO_CHAR(created_at, ?) as time, COUNT(*) as count
           FROM "AuditLog"
           WHERE created_at >= ?
           GROUP BY time
           ORDER BY time ASC`,
          dateFormat,
          startDate
        );
      }

      // Fill in gaps if any
      const timeSeries = [];
      const current = new Date(startDate);
      const end = new Date();

      while (current <= end) {
        let timeStr;
        if (interval === 'hour') {
          // Format to match strftime '%Y-%m-%d %H:00'
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          const h = String(current.getHours()).padStart(2, '0');
          timeStr = `${y}-${m}-${d} ${h}:00`;
        } else {
          // Format to match strftime '%Y-%m-%d'
          const y = current.getFullYear();
          const m = String(current.getMonth() + 1).padStart(2, '0');
          const d = String(current.getDate()).padStart(2, '0');
          timeStr = `${y}-${m}-${d}`;
        }
        
        const match = results.find(r => r.time === timeStr);
        timeSeries.push({
          time: timeStr,
          count: match ? Number(match.count) : 0
        });

        if (interval === 'hour') {
          current.setHours(current.getHours() + 1);
        } else {
          current.setDate(current.getDate() + 1);
        }
      }

      return timeSeries;
    }, { ttl: 300000 }); // 5-minute cache

    return sendSuccess(res, data, 'Success');

  } catch (error) {
    next(error);
  }
};

/**
 * Generate audit report
 */
export const generateAuditReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = auditReportSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { startDate, endDate, reportType } = validation.data;

    let reportStartDate: Date;
    let reportEndDate: Date = new Date();

    switch (reportType) {
      case 'daily':
        reportStartDate = new Date();
        reportStartDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        reportStartDate = new Date();
        reportStartDate.setDate(reportStartDate.getDate() - 7);
        break;
      case 'monthly':
        reportStartDate = new Date();
        reportStartDate.setMonth(reportStartDate.getMonth() - 1);
        break;
      default:
        reportStartDate = new Date(startDate || new Date().setDate(new Date().getDate() - 30));
        reportEndDate = new Date(endDate || new Date());
    }

    // Limit report generation to a maximum number of records to prevent memory issues/DoS
    const MAX_REPORT_RECORDS = 10000;
    
    const auditEvents = await prisma.auditLog.findMany({
      where: {
        created_at: {
          gte: reportStartDate,
          lte: reportEndDate
        }
      },
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        }
      } as const,
      take: MAX_REPORT_RECORDS
    });

    const events = auditEvents.map(event => ({
      id: event.id,
      user_id: event.user_id || 0,
      action: event.action,
      target: event.target || '',
      level: 'INFO',
      ip: event.ip_address || 'unknown',
      details: event.details ? JSON.parse(event.details as string) : {},
      timestamp: event.created_at
    }));

    const report = AuditAnalyzer.generateReport(events, reportStartDate, reportEndDate);
    
    // Add warning if truncated
    if (auditEvents.length === MAX_REPORT_RECORDS) {
      (report as any).warning = `Report generated from the latest ${MAX_REPORT_RECORDS} records. Results may be partial.`;
    }

    return sendSuccess(res, report, 'Success');

  } catch (error) {
    next(error);
  }
};

/**
 * Cleanup old audit logs
 */
export const cleanupAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = auditCleanupSchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { days: daysNum } = validation.data;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const deletedCount = await prisma.auditLog.deleteMany({
      where: {
        created_at: {
          lt: cutoffDate
        }
      }
    });

    await logAction(req.user.id, 'AUDIT_LOG_CLEANUP', 'audit_system', req, {
      days: daysNum,
      deleted_count: deletedCount.count,
      cutoff_date: cutoffDate.toISOString()
    });

    return sendSuccess(res, {
      deleted_count: deletedCount.count,
      cutoff_date: cutoffDate
    }, `Cleaned up ${deletedCount.count} logs`);

  } catch (error) {
    next(error);
  }
};

/**
 * Export audit logs
 */
export const exportAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = auditExportSchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }
    const { format, startDate, endDate } = validation.data;

    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.created_at.lte = new Date(endDate as string);
      }
    }

    // Limit exports to a maximum number of records to prevent memory issues/DoS
    const MAX_EXPORT_RECORDS = 5000;
    
    const auditLogs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true,
            email: true
          }
        }
      } as const,
      orderBy: {
        created_at: 'desc'
      },
      take: MAX_EXPORT_RECORDS
    });

    await logAction(req.user.id, 'AUDIT_LOG_EXPORTED', 'audit_system', req, {
      format,
      start_date: startDate,
      end_date: endDate,
      exported_count: auditLogs.length,
      limit_reached: auditLogs.length === MAX_EXPORT_RECORDS
    });

    if (format === 'csv') {
      const csvHeaders = 'Time,User,Action,Target,IP,Details\n';
      
      const sanitizeForCsv = (str: string) => {
        if (!str) return '';
        const s = String(str);
        if (/^[=+\-@]/.test(s)) {
          return "'" + s.replaceAll('"', '""');
        }
        return s.replaceAll('"', '""');
      };

      const csvRows = auditLogs.map(log => 
        `"${log.created_at.toISOString()}","${sanitizeForCsv(log.user?.username || log.user?.email || 'Unknown')}","${sanitizeForCsv(log.action || '')}","${sanitizeForCsv(log.target || '')}","${sanitizeForCsv(log.ip_address || '')}","${sanitizeForCsv(JSON.stringify(log.details) || '')}"`
      ).join('\n');

      const csvContent = csvHeaders + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvContent);
    } else {
      return sendSuccess(res, auditLogs, 'Success');
    }

  } catch (error) {
    next(error);
  }
};
