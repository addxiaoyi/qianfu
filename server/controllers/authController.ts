import { Request, Response, NextFunction } from 'express';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import prisma from '../db';
import { changePasswordSchema, devAuthLoginSchema, sessionIdParamSchema } from '../utils/validation';
import { logAction, logDataChange } from '../services/auditService';
import { sendSuccess, toSafeUser } from '../utils/response';
import { logger } from '../utils/logger';
import { AppError, ErrorCode, handleError } from '../utils/errors';
import { withCache } from '../services/cache';
import type { AuthRequest } from '../middleware/auth';
import {
  DEV_AUTH_COOKIE_NAME,
  getDevAuthPassword,
  getDevAuthUsername,
  getOrCreateDevAuthUser,
  isDevAuthBypassEnabled,
} from '../services/devAuth';

const REGISTRATION_STATS_CACHE_KEY = 'admin:registration_stats';

/**
 * 开发环境降级登录（不依赖 SuperTokens Core）
 */
export const devLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isDevAuthBypassEnabled()) {
      throw new AppError('Dev auth bypass is disabled', 404, ErrorCode.NOT_FOUND);
    }

    const validation = devAuthLoginSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
        issues: validation.error.issues,
      });
    }

    const { username, password } = validation.data;
    const expectedUsername = getDevAuthUsername();
    const expectedPassword = getDevAuthPassword();

    if (username !== expectedUsername || password !== expectedPassword) {
      throw new AppError('Invalid credentials', 401, ErrorCode.INVALID_CREDENTIALS);
    }

    const user = await getOrCreateDevAuthUser();

    // 创建 SuperTokens 会话，使 dev 用户能通过 authenticate 中间件访问 API
    if (user.supertokens_user_id) {
      try {
        await Session.createNewSession(req, res, process.env.NEXT_PUBLIC_SUPER_TOKENS_TENANT_ID || '1', user.supertokens_user_id as any);
      } catch (stError) {
        logger.warn('[Auth] Failed to create SuperTokens session after dev login:', stError);
        // 不阻断 dev 登录，保留 cookie 兜底
      }
    }

    res.cookie(DEV_AUTH_COOKIE_NAME, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    return sendSuccess(
      res,
      {
        mode: 'dev-bypass',
        user: toSafeUser(user, { mask: false }),
      },
      'Dev login successful',
    );
  } catch (error) {
    next(handleError(error));
  }
};

/**
 * 开发环境降级登出
 */
export const devLogout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isDevAuthBypassEnabled()) {
      throw new AppError('Dev auth bypass is disabled', 404, ErrorCode.NOT_FOUND);
    }

    // 获取当前 dev 用户
    const user = await getOrCreateDevAuthUser();
    if (user.supertokens_user_id) {
      // 尝试从 Redis 获取并撤销 session handle
      const { redisService } = await import('../services/redisService');
      const sessionHandleKey = `dev:session_handle:${user.supertokens_user_id}`;
      const sessionHandle = await redisService.get<string>(sessionHandleKey);
      if (sessionHandle) {
        try {
          await Session.revokeSession(sessionHandle);
          await redisService.del(sessionHandleKey);
        } catch (revError) {
          logger.warn('[Auth] Failed to revoke dev session:', revError);
        }
      }
    }

    res.clearCookie(DEV_AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    // 清除 Redis 中的用户缓存，避免后续请求使用已失效的 dev 用户数据
    try {
      const { redisService } = await import('../services/redisService');
      const DEV_USER_CACHE_KEY = 'user:dev:local';
      await redisService.del(DEV_USER_CACHE_KEY);
    } catch (cacheErr) {
      logger.warn('[Auth] Failed to clear dev user cache:', cacheErr);
    }

    return sendSuccess(res, { mode: 'dev-bypass' }, 'Dev logout successful');
  } catch (error) {
    next(handleError(error));
  }
};

/**
 * 检查用户名是否可用（注册前调用）
 */
export const checkUsernameAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    if (!username) {
      throw new AppError('Username is required', 400, ErrorCode.VALIDATION_ERROR);
    }

    const existing = await prisma.user.findFirst({
      where: { username },
      select: { id: true },
    });

    return sendSuccess(
      res,
      { username, available: !existing },
      existing ? 'Username already taken' : 'Username available',
    );
  } catch (error) {
    next(handleError(error));
  }
};

/**
 * 修改密码（凭证由 SuperTokens EmailPassword 管理）
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ar = req as AuthRequest;
    const stSession = ar.stSession;
    const user = ar.user;
    if (!stSession || !user) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
        issues: validation.error.issues,
      });
    }
    const { newPassword, oldPassword } = validation.data;

    const verify = await EmailPassword.verifyCredentials('public', user.email, oldPassword);
    if (verify.status !== 'OK') {
      throw new AppError('Invalid old password', 400, ErrorCode.BAD_REQUEST);
    }

    const recipeUserId = stSession.getRecipeUserId();
    const updated = await EmailPassword.updateEmailOrPassword({
      recipeUserId,
      password: newPassword,
      tenantIdForPasswordPolicy: 'public',
    });
    if (updated.status !== 'OK') {
      const failure =
        'failureReason' in updated && typeof (updated as { failureReason?: string }).failureReason === 'string'
          ? (updated as { failureReason: string }).failureReason
          : 'Unable to update password';
      throw new AppError(failure, 400, ErrorCode.BAD_REQUEST);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password_changed_at: new Date() },
    });

    const handles = await Session.getAllSessionHandlesForUser(stSession.getUserId());
    const current = stSession.getHandle();
    for (const h of handles) {
      if (h !== current) {
        await Session.revokeSession(h);
      }
    }

    // Ensure cached auth/user data is invalidated after a password change.
    const { invalidateUserCache } = await import('../middleware/auth');
    await invalidateUserCache(String(user.id));

    await logAction(user.id, 'CHANGE_PASSWORD_SUCCESS', 'auth', req, {});

    return sendSuccess(res, null, 'Password updated successfully. Other sessions have been logged out.');
  } catch (error) {
    if ((req as AuthRequest).user) {
      await logAction((req as AuthRequest).user!.id, 'CHANGE_PASSWORD_FAILURE', 'auth', req, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    next(handleError(error));
  }
};

/**
 * 列出当前 SuperTokens 会话
 */
export const getSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.supertokens_user_id) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const handles = await Session.getAllSessionHandlesForUser(user.supertokens_user_id);
    const currentHandle = (req as AuthRequest).stSession?.getHandle();

    const safeSessions = await Promise.all(
      handles.map(async (handle) => {
        const info = await Session.getSessionInformation(handle);
        return {
          id: handle,
          userAgent: null as string | null,
          ipAddress: null as string | null,
          createdAt: info ? new Date(info.timeCreated) : new Date(0),
          isCurrent: handle === currentHandle,
          expiresAt: info ? new Date(info.expiry) : new Date(0),
        };
      })
    );

    return sendSuccess(res, safeSessions);
  } catch (error) {
    next(handleError(error));
  }
};

/**
 * 撤销指定 SuperTokens 会话（sessionId 为 session handle）
 */
export const revokeSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = sessionIdParamSchema.safeParse(req.params);
    if (!validation.success) {
      throw new AppError('Invalid session ID', 400, ErrorCode.VALIDATION_ERROR, true, {
        issues: validation.error.issues,
      });
    }
    const { sessionId: sessionHandle } = validation.data;
    const user = (req as AuthRequest).user;
    const stSession = (req as AuthRequest).stSession;
    if (!user?.supertokens_user_id) {
      throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
    }

    const handles = await Session.getAllSessionHandlesForUser(user.supertokens_user_id);
    if (!handles.includes(sessionHandle)) {
      throw new AppError('Session not found', 404, ErrorCode.NOT_FOUND);
    }

    if (stSession?.getHandle() === sessionHandle) {
      throw new AppError(
        'Cannot revoke current session via this endpoint. Use logout instead.',
        400,
        ErrorCode.BAD_REQUEST
      );
    }

    await Session.revokeSession(sessionHandle);
    await logDataChange(user.id, 'REVOKE_SESSION', `session_${sessionHandle}`, req, null, { sessionHandle });

    return sendSuccess(res, null, 'Session revoked successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 登出：撤销当前 SuperTokens 会话并清理历史 JWT Cookie（兼容旧客户端）
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stSession = (req as AuthRequest).stSession;
    const user = (req as AuthRequest).user;

    if (stSession) {
      await stSession.revokeSession();
    }

    if (user) {
      await logAction(user.id, 'USER_LOGOUT', 'auth', req, {});
    }

    const isSecure = process.env.NODE_ENV === 'production';
    const sameSite = process.env.NODE_ENV === 'production' ? 'strict' : 'lax';
    const domain = process.env.COOKIE_DOMAIN || undefined;

    for (const name of ['mu_token', 'mu_refresh_token']) {
      res.clearCookie(name, {
        httpOnly: true,
        secure: isSecure,
        sameSite: sameSite as 'strict' | 'lax' | 'none',
        path: '/',
        domain,
      });
    }

    return sendSuccess(res, null, 'Logout successful');
  } catch (error) {
    logger.warn('[Auth] logout error:', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

/**
 * 注册统计（管理）
 */
export const getRegistrationStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await withCache(
      REGISTRATION_STATS_CACHE_KEY,
      async () => {
        const totalUsers = await prisma.user.count();
        const verifiedUsers = await prisma.user.count({ where: { email_verified: true } });
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentRegistrations = await prisma.user.count({
          where: { created_at: { gte: sevenDaysAgo } },
        });

        const dailyStats = await prisma.$queryRaw`
        SELECT date(created_at) as date, count(*) as count 
        FROM User 
        WHERE created_at >= ${sevenDaysAgo}
        GROUP BY date(created_at)
        ORDER BY date ASC
      `;

        return { totalUsers, verifiedUsers, recentRegistrations, dailyStats };
      },
      { ttl: 600000 }
    );

    return sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};
