import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import prisma from '../db';
import { AuthRequest } from '../middleware/auth';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess, sendListResponse } from '../utils/response';
import { logAction } from '../services/auditService';
import { withCache, invalidateCache } from '../services/cache';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(prefix: string): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${randomBytes}`;
}

export const createApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const body = req.body;
    const name = body.name as string;
    const permissionsRaw = body.permissions;
    const expiresInDays = body.expiresInDays as number | undefined;

    if (!name) {
      throw new AppError('API key name is required', 400, ErrorCode.VALIDATION_ERROR);
    }

    const plainKey = generateApiKey('qf');
    const keyHash = hashKey(plainKey);

    let expiresAt: Date | null = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    let permArray: string[] = [];
    if (permissionsRaw) {
      if (Array.isArray(permissionsRaw)) {
        permArray = permissionsRaw.map((p: string) => String(p).trim()).filter(Boolean);
      } else if (typeof permissionsRaw === 'string') {
        try {
          permArray = JSON.parse(permissionsRaw);
        } catch {
          permArray = [permissionsRaw.trim()];
        }
      }
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key_hash: keyHash,
        user_id: req.user.id,
        permissions: JSON.stringify(permArray),
        expires_at: expiresAt
      },
      select: {
        id: true, name: true, user_id: true, permissions: true,
        expires_at: true, is_active: true, created_at: true
      }
    });

    await logAction(req.user.id, 'API_KEY_CREATED', 'api_key', req, {
      key_id: apiKey.id, key_name: name, permissions: permArray,
      expires_at: expiresAt?.toISOString()
    });

    await invalidateCache('api:key:*');

    return sendSuccess(res, { ...apiKey, key: plainKey },
      'API key created successfully. Save it now — it won\'t be shown again.');

  } catch (error) { next(error); }
};

export const listApiKeys = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const query = req.query;
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20));
    const isActive = query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined;

    const whereClause: any = { user_id: req.user.id };
    if (isActive !== undefined) whereClause.is_active = isActive;

    const [apiKeys, totalCount] = await Promise.all([
      prisma.apiKey.findMany({
        where: whereClause,
        select: {
          id: true, name: true, permissions: true, expires_at: true,
          last_used_at: true, is_active: true, created_at: true, updated_at: true
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.apiKey.count({ where: whereClause })
    ]);

    const maskedApiKeys = apiKeys.map(key => ({
      ...key,
      permissions: key.permissions ? JSON.parse(key.permissions) : [],
      key_preview: `qf_****${(key.id?.toString().padStart(4, '0')) || '????'}`
    }));

    return sendListResponse(res, maskedApiKeys, totalCount, page, limit, { resource: 'ApiKeys' });

  } catch (error) { next(error); }
};

export const deleteApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const id = parseInt(req.query.id as string);
    if (isNaN(id)) {
      throw new AppError('Valid key ID is required', 400, ErrorCode.VALIDATION_ERROR);
    }

    const apiKey = await prisma.apiKey.findFirst({
      where: { id, user_id: req.user.id }
    });

    if (!apiKey) {
      throw new AppError('API key not found', 404, ErrorCode.NOT_FOUND);
    }

    await prisma.apiKey.update({ where: { id }, data: { is_active: false } });

    await logAction(req.user.id, 'API_KEY_DELETED', 'api_key', req, {
      key_id: id, key_name: apiKey.name
    });

    await invalidateCache('api:key:*');

    return sendSuccess(res, { id, name: apiKey.name }, 'API key deleted successfully');

  } catch (error) { next(error); }
};

export const rotateApiKey = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const body = req.body;
    const id = parseInt(body.id as string);
    if (isNaN(id)) {
      throw new AppError('Valid key ID is required', 400, ErrorCode.VALIDATION_ERROR);
    }

    const existingKey = await prisma.apiKey.findFirst({
      where: { id, user_id: req.user.id, is_active: true }
    });

    if (!existingKey) {
      throw new AppError('API key not found or inactive', 404, ErrorCode.NOT_FOUND);
    }

    const newPlainKey = generateApiKey('qf');
    const newKeyHash = hashKey(newPlainKey);

    await prisma.apiKey.update({
      where: { id },
      data: { key_hash: newKeyHash, updated_at: new Date() }
    });

    await logAction(req.user.id, 'API_KEY_ROTATED', 'api_key', req, {
      key_id: id, key_name: existingKey.name
    });

    await invalidateCache('api:key:*');

    return sendSuccess(res, {
      id, name: existingKey.name, key: newPlainKey,
      message: 'API key rotated successfully. Save it now — the old key will stop working immediately.'
    }, 'API key rotated successfully');

  } catch (error) { next(error); }
};

export const getApiKeyStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    const userId = req.user.id;
    const cacheKey = `api_key:stats:${userId}`;

    const stats = await withCache(cacheKey, async () => {
      const [totalKeys, activeKeys, expiredKeys] = await Promise.all([
        prisma.apiKey.count({ where: { user_id: userId } }),
        prisma.apiKey.count({ where: { user_id: userId, is_active: true } }),
        prisma.apiKey.count({
          where: { user_id: userId, expires_at: { lte: new Date() } }
        })
      ]);

      return { totalKeys, activeKeys, expiredKeys, lastUpdated: new Date() };
    }, { ttl: 60000 });

    return sendSuccess(res, stats, 'Success');

  } catch (error) { next(error); }
};

export const validateApiKey = async (key: string): Promise<{
  apiKey: any;
  plainKey: string;
  permissions: string[];
} | null> => {
  try {
    const keyHash = hashKey(key);

    const apiKey = await prisma.apiKey.findUnique({
      where: { key_hash: keyHash },
      include: { user: true }
    });

    if (!apiKey || !apiKey.is_active) {
      return null;
    }

    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      await prisma.apiKey.update({ where: { id: apiKey.id }, data: { is_active: false } });
      return null;
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { last_used_at: new Date() }
    });

    let permissions: string[] = [];
    if (apiKey.permissions) {
      try { permissions = JSON.parse(apiKey.permissions); } catch { permissions = []; }
    }

    return { apiKey, plainKey: key, permissions };
  } catch {
    return null;
  }
};
