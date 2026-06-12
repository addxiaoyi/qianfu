import { Request } from 'express';
import prisma from '../db';
import safeStringify from 'json-stringify-safe';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getJwtSecret } from '../utils/securityConfig';

const HMAC_SECRET = getJwtSecret();

/**
 * Calculate HMAC signature for an audit log entry to ensure integrity
 */
function calculateLogHash(entry: {
  user_id: number | null;
  action: string;
  target: string | null;
  details: string | null;
  ip_address: string | null;
  previous_hash: string | null;
  created_at: Date;
}): string {
  const data = JSON.stringify({
    u: entry.user_id,
    a: entry.action,
    t: entry.target,
    d: entry.details,
    i: entry.ip_address,
    p: entry.previous_hash,
    c: entry.created_at.getTime(),
  });

  return crypto.createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}

export async function logAction(userId: number | null, action: string, target: string, req: Request, details?: Record<string, unknown> | unknown) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ipAddress = typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown';
    
    // Parse action context
    let finalDetails: string | null = null;
    if (details !== undefined && details !== null) {
      try {
        const maskedDetails = logger.maskData(details);
        const detailsStr = safeStringify(maskedDetails);
        // Truncate to 5000 characters if it's too long
        finalDetails = detailsStr.length > 5000 ? detailsStr.slice(0, 5000) + '... [TRUNCATED]' : detailsStr;
      } catch (e) {
        finalDetails = '[Error stringifying details]';
      }
    }

    // Get the latest log entry to link the hash chain
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { created_at: 'desc' },
      select: { hash: true }
    });

    const previousHash = lastLog?.hash || null;
    const createdAt = new Date();

    const hash = calculateLogHash({
      user_id: userId,
      action,
      target,
      details: finalDetails,
      ip_address: ipAddress,
      previous_hash: previousHash,
      created_at: createdAt
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId || undefined,
        action,
        target,
        ip_address: ipAddress,
        details: finalDetails,
        previous_hash: previousHash,
        hash,
        created_at: createdAt
      },
    });
  } catch (error) {
    // We don't want audit logging to crash the main application, but we should log the failure
    logger.error('[AuditLog Critical Error] Failed to write audit log:', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      action,
      target,
    });
  }
}

/**
 * Data change snapshot logging
 */
export async function logDataChange(
  userId: number | null, 
  action: string, 
  target: string, 
  req: Request, 
  before: any, 
  after: any
) {
  const safeBefore = before || {};
  const safeAfter = after || {};

  return logAction(userId, action, target, req, {
    snapshot: {
      before,
      after,
      changed_fields: Object.keys(safeAfter).filter(key => {
        try {
          return safeStringify(safeBefore[key]) !== safeStringify(safeAfter[key]);
        } catch (e) {
          return true; // Assume changed if comparison fails
        }
      })
    }
  });
}

/**
 * Batch audit logging
 */
export async function logBatchActions(
  actions: Array<{
    userId?: number;
    action: string;
    target: string;
    ip: string;
    details?: any;
  }>
): Promise<void> {
  try {
    // We need to process them sequentially to maintain the hash chain
    // or at least get the starting hash correctly
    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { created_at: 'desc' },
      select: { hash: true }
    });
    let previousHash = lastLog?.hash || null;

    for (const action of actions) {
      const ipAddress = typeof action.ip === 'string' ? action.ip.split(',')[0].trim() : 'unknown';
      let finalDetails: string | null = null;
      if (action.details !== undefined && action.details !== null) {
        try {
          const maskedDetails = logger.maskData(action.details);
          const detailsStr = safeStringify(maskedDetails);
          finalDetails = detailsStr.length > 5000 ? detailsStr.slice(0, 5000) + '... [TRUNCATED]' : detailsStr;
        } catch (e) {
          finalDetails = '[Error stringifying details]';
        }
      }

      const createdAt = new Date();
      const hash = calculateLogHash({
        user_id: action.userId || null,
        action: action.action,
        target: action.target,
        details: finalDetails,
        ip_address: ipAddress,
        previous_hash: previousHash,
        created_at: createdAt
      });

      await prisma.auditLog.create({
        data: {
          user_id: action.userId || undefined,
          action: action.action,
          target: action.target,
          ip_address: ipAddress,
          details: finalDetails,
          previous_hash: previousHash,
          hash,
          created_at: createdAt
        }
      });
      previousHash = hash;
    }
  } catch (error) {
    logger.error('[AuditLog Critical Error] Failed to write batch audit logs:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Verify the integrity of the entire audit log chain
 * Returns the first ID where a mismatch occurs, or null if everything is correct
 */
export async function verifyAuditChain(): Promise<{ 
  isValid: boolean; 
  corruptedId?: number; 
  reason?: string 
}> {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { created_at: 'asc' }
    });

    let previousHash: string | null = null;
    let startedVerification = false;

    for (const log of logs) {
      // Skip legacy logs that don't have a hash
      if (!log.hash) {
        if (startedVerification) {
          return {
            isValid: false,
            corruptedId: log.id,
            reason: 'Legacy log (null hash) found after verification had already started. Chain broken.'
          };
        }
        continue;
      }

      startedVerification = true;

      // 1. Check if previous_hash matches the actual previous entry's hash
      if (log.previous_hash !== previousHash) {
        return { 
          isValid: false, 
          corruptedId: log.id, 
          reason: `Previous hash mismatch. Expected ${previousHash || 'null'}, got ${log.previous_hash}` 
        };
      }

      // 2. Recalculate hash and compare with stored hash
      const calculatedHash = calculateLogHash({
        user_id: log.user_id,
        action: log.action,
        target: log.target,
        details: log.details,
        ip_address: log.ip_address,
        previous_hash: log.previous_hash,
        created_at: log.created_at
      });

      if (log.hash !== calculatedHash) {
        return { 
          isValid: false, 
          corruptedId: log.id, 
          reason: `Stored hash mismatch. Expected ${calculatedHash}, got ${log.hash}` 
        };
      }

      previousHash = log.hash;
    }

    return { isValid: true };
  } catch (error) {
    logger.error('[AuditLog Integrity Check Error]:', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { isValid: false, reason: 'Check failed due to internal error' };
  }
}

/**
 * Audit statistics retrieval
 */
export async function getAuditStats(options?: {
  startDate?: Date;
  endDate?: Date;
  userId?: number;
  action?: string;
}) {
  const whereClause: any = {};

  if (options?.startDate || options?.endDate) {
    whereClause.created_at = {};
    if (options.startDate) {
      whereClause.created_at.gte = options.startDate;
    }
    if (options.endDate) {
      whereClause.created_at.lte = options.endDate;
    }
  }

  if (options?.userId) {
    whereClause.user_id = options.userId;
  }

  if (options?.action) {
    whereClause.action = options.action;
  }

  return await prisma.auditLog.count({
    where: whereClause
  });
}
