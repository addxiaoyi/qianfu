import { Response, NextFunction } from 'express';
import prisma from '../db';
import { logAction } from '../services/auditService';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AppError, ErrorCode } from '../utils/errors';
import { AuthRequest } from '../middleware/auth';
import { Port5555AccessStats, validatePort5555Access, getPort5555AccessInfo } from '../config/port5555';
import { 
  port5555LogQuerySchema, 
  port5555ExportSchema, 
  port5555CleanupSchema, 
  port5555DetailsSchema,
  port5555StatsQuerySchema
} from '../utils/validation';

const safeParseDetails = (details: string | null | undefined) => {
  if (!details) return port5555DetailsSchema.parse({});
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : details;
    // Backward/forward compatibility for inconsistent key naming:
    // middleware may write `ipAddress`, while schema/controller expect `ip_address`.
    if (parsed && typeof parsed === 'object') {
      const anyParsed = parsed as any;
      if (anyParsed.ip_address == null && typeof anyParsed.ipAddress === 'string') {
        anyParsed.ip_address = anyParsed.ipAddress;
      }
    }
    return port5555DetailsSchema.parse(parsed || {});
  } catch {
    return port5555DetailsSchema.parse({});
  }
};

// Retrieve Port 5555 access statistics
export const getPort5555Stats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verify Port 5555 access permissions
    if (!req.port5555Access?.hasAccess) {
      throw new AppError('Insufficient permissions', 403, ErrorCode.FORBIDDEN);
    }

    const validation = port5555StatsQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }
    const { days } = validation.data;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Aggregate statistics
    const totalAccesses = await prisma.auditLog.count({
      where: {
        action: {
          in: ['PORT5555_ACCESS_GRANTED', 'PORT5555_ACCESS_DENIED']
        },
        created_at: { gte: startDate }
      }
    });

    const successfulAccesses = await prisma.auditLog.count({
      where: {
        action: 'PORT5555_ACCESS_GRANTED',
        created_at: { gte: startDate }
      }
    });

    const failedAccesses = await prisma.auditLog.count({
      where: {
        action: 'PORT5555_ACCESS_DENIED',
        created_at: { gte: startDate }
      }
    });

    const uniqueUsers = await prisma.auditLog.groupBy({
      by: ['user_id'],
      where: {
        action: {
          in: ['PORT5555_ACCESS_GRANTED', 'PORT5555_ACCESS_DENIED']
        },
        created_at: { gte: startDate }
      }
    });

    const lastAccess = await prisma.auditLog.findFirst({
      where: {
        action: 'PORT5555_ACCESS_GRANTED'
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const topAccessPaths = await prisma.auditLog.groupBy({
      by: ['details'],
      where: {
        action: 'PORT5555_ACCESS_GRANTED',
        created_at: { gte: startDate }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    await prisma.auditLog.groupBy({
      by: ['details'],
      where: {
        action: 'PORT5555_ACCESS_GRANTED',
        created_at: { gte: startDate }
      },
      _count: {
        id: true
      }
    });

    const stats: Port5555AccessStats = {
      totalAccesses,
      successfulAccesses,
      failedAccesses,
      uniqueUsers: uniqueUsers.length,
      averageAccessTime: 0,
      lastAccess: lastAccess?.created_at || new Date(),
      topAccessPaths: topAccessPaths.map(item => ({
        path: safeParseDetails(item.details as string).path,
        count: item._count.id
      })),
      accessByRole: {
        ADMIN: 0,
        VISITOR: 0,
        COLLABORATOR: 0,
        SPONSOR: 0,
        CONTRIBUTOR: 0,
        OPERATOR: 0,
        NORMAL: 0
      }
    };

    if (req.user) {
      await logAction(req.user.id, 'PORT5555_STATS_VIEWED', 'port5555', req as any, {
        stats
      });
    }

    return sendSuccess(res, { stats }, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Get Port 5555 access logs
 */
export const getPort5555AccessLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.port5555Access?.hasAccess) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    const validation = port5555LogQuerySchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }

    const { page, limit, search, action, status, method, startDate, endDate } = validation.data;
    const skip = (page - 1) * limit;

    const where: any = {
      action: {
        in: [
          'PORT5555_ACCESS_GRANTED', 
          'PORT5555_ACCESS_DENIED', 
          'PORT5555_SESSION_EXPIRED', 
          'PORT5555_RATE_LIMIT_EXCEEDED'
        ]
      }
    };

    if (status) {
      where.action = {
        in:
          status === 'success'
            ? ['PORT5555_ACCESS_GRANTED']
            : ['PORT5555_ACCESS_DENIED', 'PORT5555_SESSION_EXPIRED', 'PORT5555_RATE_LIMIT_EXCEEDED']
      };
    }

    if (search) {
      where.OR = [
        { user: { username: { contains: search } } },
        { details: { contains: search } }
      ];
    }

    if (action) {
      where.action = action;
    }

    if (method) {
      where.details = { contains: method };
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true
          }
        }
      }
    });

    const total = await prisma.auditLog.count({ where });

    const formattedLogs = logs.map(log => {
      const details = safeParseDetails(log.details as string);
      return {
        id: log.id,
        userId: log.user_id,
        username: log.user?.username,
        userRole: log.user?.role,
        ipAddress: details.ip_address,
        userAgent: details.userAgent,
        time: log.created_at,
        action: log.action,
        path: details.path,
        method: details.method,
        statusCode: log.action === 'PORT5555_ACCESS_GRANTED' ? 200 : 403,
        errorMessage: log.action === 'PORT5555_ACCESS_DENIED' ? 'Forbidden' : undefined,
        sessionId: details.sessionId,
        recheckedAt: (log as any).rechecked_at ?? null,
        recheckStatus: (log as any).recheck_status ?? null,
        recheckedBy: (log as any).rechecked_by ?? null
      };
    });

    if (req.user) {
      await logAction(req.user.id, 'PORT5555_LOGS_VIEWED', 'port5555', req as any, {
        page,
        limit,
        total,
        search,
        action, startDate, endDate
      });
    }

    return sendPaginated(res, formattedLogs, total, page, limit, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Export Port 5555 access logs
 */
export const exportPort5555AccessLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.port5555Access?.hasAccess) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    const validation = port5555ExportSchema.safeParse(req.query);
    if (!validation.success) {
      throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
    }

    const { format, search, status, method, startDate, endDate } = validation.data;

    const where: any = {
      action: {
        in: [
          'PORT5555_ACCESS_GRANTED', 
          'PORT5555_ACCESS_DENIED', 
          'PORT5555_SESSION_EXPIRED', 
          'PORT5555_RATE_LIMIT_EXCEEDED'
        ]
      }
    };

    if (status) {
      where.action = {
        in:
          status === 'success'
            ? ['PORT5555_ACCESS_GRANTED']
            : ['PORT5555_ACCESS_DENIED', 'PORT5555_SESSION_EXPIRED', 'PORT5555_RATE_LIMIT_EXCEEDED']
      };
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate as string);
      }
    }

    if (search) {
      where.OR = [
        { user: { username: { contains: search } } },
        { details: { contains: search } }
      ];
    }

    if (method) {
      where.details = { contains: method };
    }

    // Limit export to prevent memory issues/DoS
    const MAX_EXPORT_RECORDS = 5000;
    
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        created_at: 'desc'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true
          }
        }
      },
      take: MAX_EXPORT_RECORDS
    });

    const formattedLogs = logs.map(log => {
      const d = JSON.parse(log.details as string) as any;
      return ({
      'Log ID': log.id,
      'User ID': log.user_id,
      'Username': log.user?.username,
      'User Role': log.user?.role,
      'IP Address': d?.ip_address || d?.ipAddress || 'Unknown',
      'User Agent': JSON.parse(log.details as string)?.userAgent || 'Unknown',
      'Timestamp': log.created_at.toISOString(),
      'Action': log.action,
      'Path': d?.path || 'Unknown',
      'Method': d?.method || 'Unknown',
      'Status Code': log.action === 'PORT5555_ACCESS_GRANTED' ? 200 : 403,
      'Error Message': log.action === 'PORT5555_ACCESS_DENIED' ? 'Forbidden' : ''
      });
    });

    await logAction(req.user!.id, 'PORT5555_LOGS_EXPORTED', 'port5555', req as any, {
      format,
      count: formattedLogs.length,
      limit_reached: formattedLogs.length === MAX_EXPORT_RECORDS
    });

    let exportData: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      exportData = JSON.stringify(formattedLogs, null, 2);
      contentType = 'application/json';
      filename = `port5555-access-logs-${new Date().toISOString().split('T')[0]}.json`;
    } else {
      const headers = Object.keys(formattedLogs[0] || {}).join(',');
      const rows = formattedLogs.map(log => 
        Object.values(log).map(value => {
          let strValue = String(value).replace(/"/g, '""');
          if (/^[\=\+\-@]/.test(strValue)) {
            strValue = "'" + strValue;
          }
          return `"${strValue}"`;
        }).join(',')
      );
      exportData = [headers, ...rows].join('\n');
      contentType = 'text/csv';
      filename = `port5555-access-logs-${new Date().toISOString().split('T')[0]}.csv`;
    }

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(exportData, 'utf8').toString()
    });

    await logAction(req.user!.id, 'PORT5555_LOGS_EXPORTED', 'port5555', req as any, {
      format,
      recordCount: formattedLogs.length,
      startDate,
      endDate
    });

    res.send(exportData);
  } catch (error) {
    next(error);
  }
};

/**
 * Cleanup Port 5555 access logs
 */
export const cleanupPort5555Logs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.port5555Access?.hasAccess) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    const validation = port5555CleanupSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, {
        issues: validation.error.issues,
      });
    }

    const { retentionDays } = validation.data;

    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - retentionDays);

    const deletedCount = await prisma.auditLog.deleteMany({
      where: {
        action: {
          in: [
            'PORT5555_ACCESS_GRANTED', 
            'PORT5555_ACCESS_DENIED', 
            'PORT5555_SESSION_EXPIRED', 
            'PORT5555_RATE_LIMIT_EXCEEDED'
          ]
        },
        created_at: {
          lt: cleanupDate
        }
      }
    });

    await logAction(req.user!.id, 'PORT5555_LOGS_CLEANED', 'port5555', req as any, {
      retentionDays,
      cleanupDate,
      deletedCount: deletedCount.count
    });

    return sendSuccess(res, { 
      deletedCount: deletedCount.count,
      retentionDays,
      cleanupDate
    }, `Cleaned up ${deletedCount.count} logs`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get current Port 5555 configuration
 */
export const getPort5555Config = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.port5555Access?.hasAccess) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    import('../config/port5555').then(({ PORT_5555_CONFIG }) => {
      logAction(req.user!.id, 'PORT5555_CONFIG_VIEWED', 'port5555', req as any, {});
      return sendSuccess(res, { config: PORT_5555_CONFIG }, 'Success');
    }).catch(error => {
      next(error);
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Recheck a specific port5555 access log record.
 * Compares "actual" access outcome stored in AuditLog.action with the
 * expected access outcome derived from the target user's role/permissions.
 */
export const recheckPort5555AccessLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.port5555Access?.hasAccess) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    const rawId = req.params.id;
    const logId = Number(rawId);
    if (!Number.isFinite(logId) || logId <= 0) {
      throw new AppError('Invalid log id', 400, ErrorCode.VALIDATION_ERROR);
    }

    const log = await prisma.auditLog.findUnique({
      where: { id: logId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            permissions: true,
          },
        },
      },
    });

    if (!log) {
      throw new AppError('Log not found', 404, ErrorCode.NOT_FOUND);
    }

    const targetUserRole = (log.user?.role ?? 'NORMAL') as any;
    let targetUserPermissions: string[] = [];
    try {
      targetUserPermissions = Array.isArray(JSON.parse(log.user?.permissions ?? '[]'))
        ? (JSON.parse(log.user?.permissions ?? '[]') as string[])
        : [];
    } catch {
      targetUserPermissions = [];
    }

    const expectedGranted = validatePort5555Access(targetUserRole, targetUserPermissions);
    const actualGranted = log.action === 'PORT5555_ACCESS_GRANTED';
    const mismatch = expectedGranted !== actualGranted;

    const accessInfo = getPort5555AccessInfo(targetUserRole, targetUserPermissions);
    const recheckStatus = mismatch ? 'MISMATCH' : 'MATCH';

    // Best effort: mark original log record with recheck status fields.
    // This may fail before DB schema migration is applied; if it does, we still return recheck result.
    try {
      await prisma.auditLog.update({
        where: { id: logId },
        data: {
          rechecked_at: new Date(),
          recheck_status: recheckStatus,
          rechecked_by: req.user!.id
        } as any
      });
    } catch {
      // Ignore migration lag; audit trail entry below remains authoritative.
    }

    await logAction(req.user!.id, 'PORT5555_LOG_RECHECKED', 'port5555', req as any, {
      logId,
      actualGranted,
      expectedGranted,
      mismatch,
      recheckStatus,
      actualAction: log.action,
      targetUserRole,
    });

    return sendSuccess(
      res,
      {
        logId,
        userId: log.user_id,
        username: log.user?.username ?? log.user?.email ?? null,
        userRole: targetUserRole,
        actualGranted,
        expectedGranted,
        mismatch,
        recheckStatus,
        recheckedBy: req.user!.id,
        recheckedAt: new Date().toISOString(),
        accessInfo,
      },
      'Success'
    );
  } catch (error) {
    next(error);
  }
};