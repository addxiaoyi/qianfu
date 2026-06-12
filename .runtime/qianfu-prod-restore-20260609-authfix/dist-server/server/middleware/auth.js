import Session from 'supertokens-node/recipe/session';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { redisService } from '../services/redisService.js';
import { repairPrismaUserIfMissing } from '../services/supertokensPrismaSync.js';
import { logger } from '../utils/logger.js';
import { parseJsonArray } from '../utils/jsonField.js';
import { getJwtSecret } from '../utils/securityConfig.js';
import { isDevAuthBypassEnabled, isDevAuthCookiePresent, getOrCreateDevAuthUser, } from '../services/devAuth.js';
const USER_CACHE_PREFIX = 'user:cache:';
const USER_CACHE_TTL = 30;
const LOCAL_AUTH_COOKIE_NAME = process.env.LOCAL_AUTH_COOKIE_NAME || 'qf_auth_token';
async function attachUserFromLocalAuthToken(req, mode) {
    const header = req.headers.authorization;
    const bearerToken = typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7).trim()
        : '';
    const cookieToken = typeof req.cookies?.[LOCAL_AUTH_COOKIE_NAME] === 'string'
        ? String(req.cookies[LOCAL_AUTH_COOKIE_NAME]).trim()
        : '';
    const token = bearerToken || cookieToken;
    if (!token) {
        return false;
    }
    try {
        const payload = jwt.verify(token, getJwtSecret());
        if (!payload?.userId) {
            throw new AppError('Invalid token', 401, ErrorCode.UNAUTHORIZED);
        }
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            throw new AppError('User not found', 401, ErrorCode.UNAUTHORIZED);
        }
        req.user = user;
        const permissions = parseJsonArray(user.permissions);
        req.isAdmin =
            user.role === 'ADMIN' ||
                user.role === 'OWNER' ||
                permissions.includes('admin');
        return true;
    }
    catch (error) {
        if (mode === 'required') {
            throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
        }
        return false;
    }
}
async function attachUserFromSuperTokensSession(req, res, mode) {
    if (isDevAuthBypassEnabled() && isDevAuthCookiePresent(req)) {
        const devUser = await getOrCreateDevAuthUser();
        req.user = devUser;
        const permissions = parseJsonArray(devUser.permissions);
        req.isAdmin =
            devUser.role === 'ADMIN' ||
                devUser.role === 'OWNER' ||
                permissions.includes('admin');
        return true;
    }
    try {
        const stSession = await Session.getSession(req, res, {
            sessionRequired: mode === 'required',
        });
        if (!stSession) {
            if (mode === 'required') {
                throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
            }
            return false;
        }
        const stUserId = stSession.getUserId();
        req.stSession = stSession;
        let user = await prisma.user.findUnique({
            where: { supertokens_user_id: stUserId },
        });
        if (!user) {
            await repairPrismaUserIfMissing(stUserId);
            user = await prisma.user.findUnique({
                where: { supertokens_user_id: stUserId },
            });
        }
        if (!user) {
            if (mode === 'required') {
                throw new AppError('User profile not found; please contact support', 401, ErrorCode.UNAUTHORIZED);
            }
            return false;
        }
        const cacheKey = `${USER_CACHE_PREFIX}${user.id}`;
        const cached = await redisService.get(cacheKey);
        const effectiveUser = cached ?? user;
        req.user = effectiveUser;
        if (!cached) {
            await redisService.set(cacheKey, user, USER_CACHE_TTL);
        }
        const permissions = parseJsonArray(effectiveUser.permissions);
        req.isAdmin =
            effectiveUser.role === 'ADMIN' ||
                effectiveUser.role === 'OWNER' ||
                permissions.includes('admin');
        return true;
    }
    catch (err) {
        if (err instanceof AppError) {
            if (mode === 'required')
                throw err;
            return false;
        }
        const stType = typeof err === 'object' && err !== null && 'type' in err ? String(err.type) : '';
        if (stType === 'TRY_REFRESH_TOKEN' || stType === 'UNAUTHORISED') {
            if (mode === 'required') {
                throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
            }
            return false;
        }
        if (mode === 'required') {
            throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
        }
        return false;
    }
}
export const authenticate = async (req, res, next) => {
    try {
        if (await attachUserFromLocalAuthToken(req, 'required')) {
            return next();
        }
        await attachUserFromSuperTokensSession(req, res, 'required');
        return next();
    }
    catch (error) {
        next(error);
    }
};
export const authenticateOptional = async (req, res, next) => {
    try {
        if (await attachUserFromLocalAuthToken(req, 'optional')) {
            return next();
        }
        await attachUserFromSuperTokensSession(req, res, 'optional');
        return next();
    }
    catch (error) {
        logger.warn('[Auth] optional authentication failed', { error: error instanceof Error ? error.message : String(error) });
        return next();
    }
};
export const authorize = (roles = []) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
        }
        if (req.isAdmin) {
            return next();
        }
        if (roles.length > 0 && !roles.includes(req.user.role)) {
            return next(new AppError('Permission denied', 403, ErrorCode.FORBIDDEN));
        }
        return next();
    };
};
export const adminOnly = (req, _res, next) => {
    if (!req.isAdmin) {
        return next(new AppError('Admin access required', 403, ErrorCode.FORBIDDEN));
    }
    return next();
};
export const hasPermission = (permissions) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED));
        }
        if (req.isAdmin) {
            return next();
        }
        const userPermissions = parseJsonArray(req.user.permissions);
        const hasAnyPermission = permissions.some((p) => userPermissions.includes(p));
        if (hasAnyPermission) {
            return next();
        }
        next(new AppError('Forbidden: Insufficient permissions', 403, ErrorCode.FORBIDDEN));
    };
};
/**
 * 清除用户缓存
 * 在用户信息更新后调用，确保下次认证时获取最新数据
 */
export async function invalidateUserCache(userId) {
    const normalizedUserId = String(userId);
    const cacheKey = `${USER_CACHE_PREFIX}${normalizedUserId}`;
    await redisService.del(cacheKey);
    logger.debug(`[Auth] Invalidated user cache for: ${normalizedUserId}`);
}
//# sourceMappingURL=auth.js.map