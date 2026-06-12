import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import crypto from 'crypto';
import prisma from '../db.js';
import { changePasswordSchema, devAuthLoginSchema, sessionIdParamSchema } from '../utils/validation.js';
import { logAction, logDataChange } from '../services/auditService.js';
import { sendSuccess, toSafeUser } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { AppError, ErrorCode, handleError } from '../utils/errors.js';
import { withCache } from '../services/cache.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { buildSuccessEnvelope, getRequestId } from '../contracts/responseEnvelope.js';
import bcrypt from 'bcrypt';
import { getJwtSecret } from '../utils/securityConfig.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { clearLocalAuthCookie, LOCAL_AUTH_COOKIE_NAME, setLocalAuthCookie, signLocalAuthToken, } from '../utils/localAuth.js';
import { DEV_AUTH_COOKIE_NAME, getDevAuthPassword, getDevAuthUsername, getOrCreateDevAuthUser, isDevAuthBypassEnabled, } from '../services/devAuth.js';
const REGISTRATION_STATS_CACHE_KEY = 'admin:registration_stats';
const RESET_CODE_TTL_MINUTES = 10;
const RESET_LINK_TTL_MS = 60 * 60 * 1000;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
function generateCodeHash(identifier, code) {
    return crypto.createHmac('sha256', getJwtSecret()).update(`${identifier}:${code}`).digest('hex');
}
function generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
}
function hashResetToken(token) {
    return crypto.createHmac('sha256', getJwtSecret()).update(`password-reset:${token}`).digest('hex');
}
function readNewPassword(body) {
    return String(body?.newPassword || body?.password || '').trim();
}
function ensurePasswordPolicy(password) {
    if (password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400, ErrorCode.VALIDATION_ERROR);
    }
}
async function updateLocalPassword(userId, password) {
    const passwordHash = await bcrypt.hash(password, 12);
    return prisma.user.update({
        where: { id: userId },
        data: {
            password_hash: passwordHash,
            password_changed_at: new Date(),
            verification_token: null,
            token_expiry: null,
            reset_token: null,
            reset_token_expiry: null,
            login_count: 0,
            login_lockout_at: null,
        },
    });
}
export const login = async (req, res, next) => {
    try {
        const identifier = String(req.body?.identifier || req.body?.email || '').trim();
        const password = String(req.body?.password || '');
        if (!identifier || !password) {
            throw new AppError('identifier and password are required', 400, ErrorCode.VALIDATION_ERROR);
        }
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier.toLowerCase() },
                    { username: identifier },
                ],
            },
        });
        if (!user?.password_hash) {
            throw new AppError('Invalid credentials', 401, ErrorCode.INVALID_CREDENTIALS);
        }
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            throw new AppError('Invalid credentials', 401, ErrorCode.INVALID_CREDENTIALS);
        }
        await prisma.user.update({
            where: { id: user.id },
            data: {
                last_login_at: new Date(),
                login_count: { increment: 1 },
            },
        });
        const token = signLocalAuthToken(user.id);
        setLocalAuthCookie(res, token);
        return res.status(200).json(buildSuccessEnvelope({
            token,
            user: toSafeUser(user, { mask: false }),
            mode: 'local-auth',
        }, 'Login successful', getRequestId(req)));
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * 开发环境降级登录（不依赖 SuperTokens Core）
 */
export const devLogin = async (req, res, next) => {
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
                await Session.createNewSession(req, res, process.env.NEXT_PUBLIC_SUPER_TOKENS_TENANT_ID || '1', user.supertokens_user_id);
            }
            catch (stError) {
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
        return sendSuccess(res, {
            mode: 'dev-bypass',
            user: toSafeUser(user, { mask: false }),
        }, 'Dev login successful');
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * 开发环境降级登出
 */
export const devLogout = async (req, res, next) => {
    try {
        if (!isDevAuthBypassEnabled()) {
            throw new AppError('Dev auth bypass is disabled', 404, ErrorCode.NOT_FOUND);
        }
        // 获取当前 dev 用户
        const user = await getOrCreateDevAuthUser();
        if (user.supertokens_user_id) {
            // 尝试从 Redis 获取并撤销 session handle
            const { redisService } = await import('../services/redisService.js');
            const sessionHandleKey = `dev:session_handle:${user.supertokens_user_id}`;
            const sessionHandle = await redisService.get(sessionHandleKey);
            if (sessionHandle) {
                try {
                    await Session.revokeSession(sessionHandle);
                    await redisService.del(sessionHandleKey);
                }
                catch (revError) {
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
            const { redisService } = await import('../services/redisService.js');
            const DEV_USER_CACHE_KEY = 'user:dev:local';
            await redisService.del(DEV_USER_CACHE_KEY);
        }
        catch (cacheErr) {
            logger.warn('[Auth] Failed to clear dev user cache:', cacheErr);
        }
        return sendSuccess(res, { mode: 'dev-bypass' }, 'Dev logout successful');
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * 检查用户名是否可用（注册前调用）
 */
export const checkUsernameAvailability = async (req, res, next) => {
    try {
        const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
        if (!username) {
            throw new AppError('Username is required', 400, ErrorCode.VALIDATION_ERROR);
        }
        const existing = await prisma.user.findFirst({
            where: { username },
            select: { id: true },
        });
        return sendSuccess(res, { username, available: !existing }, existing ? 'Username already taken' : 'Username available');
    }
    catch (error) {
        next(handleError(error));
    }
};
export const forgotPassword = async (req, res, next) => {
    try {
        const rawEmail = String(req.body?.email || '').trim();
        if (!rawEmail || !isEmail(rawEmail)) {
            throw new AppError('Invalid email format', 400, ErrorCode.VALIDATION_ERROR);
        }
        const email = normalizeEmail(rawEmail);
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            const code = generateCode();
            const resetToken = generateResetToken();
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    verification_token: generateCodeHash(email, code),
                    token_expiry: new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000),
                    reset_token: hashResetToken(resetToken),
                    reset_token_expiry: new Date(Date.now() + RESET_LINK_TTL_MS),
                    last_code_send_at: new Date(),
                },
            });
            await sendPasswordResetEmail(email, resetToken, code);
        }
        return sendSuccess(res, { email }, 'If the account exists, password reset instructions have been sent', 200, undefined, { mask: false });
    }
    catch (error) {
        next(handleError(error));
    }
};
export const resetPassword = async (req, res, next) => {
    try {
        const email = normalizeEmail(String(req.body?.email || ''));
        const code = String(req.body?.code || '').trim();
        const password = readNewPassword(req.body || {});
        ensurePasswordPolicy(password);
        if (!email || !isEmail(email) || !code) {
            throw new AppError('Invalid reset request', 400, ErrorCode.VALIDATION_ERROR);
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.verification_token ||
            !user.token_expiry ||
            user.token_expiry < new Date() ||
            user.verification_token !== generateCodeHash(email, code)) {
            throw new AppError('Invalid or expired reset code', 400, ErrorCode.BAD_REQUEST);
        }
        const updated = await updateLocalPassword(user.id, password);
        await prisma.user.update({
            where: { id: user.id },
            data: { email_verified: true },
        });
        await invalidateUserCache(String(user.id));
        return sendSuccess(res, { user: toSafeUser({ ...updated, email_verified: true }, { mask: false }) }, 'Password reset successfully', 200, undefined, { mask: false });
    }
    catch (error) {
        next(handleError(error));
    }
};
export const resetPasswordWithToken = async (req, res, next) => {
    try {
        const token = String(req.body?.token || '').trim();
        const password = readNewPassword(req.body || {});
        ensurePasswordPolicy(password);
        if (!token) {
            throw new AppError('Reset token is required', 400, ErrorCode.VALIDATION_ERROR);
        }
        const user = await prisma.user.findFirst({
            where: {
                reset_token: hashResetToken(token),
                reset_token_expiry: { gt: new Date() },
            },
        });
        if (!user) {
            throw new AppError('Invalid or expired reset token', 400, ErrorCode.BAD_REQUEST);
        }
        const updated = await updateLocalPassword(user.id, password);
        await invalidateUserCache(String(user.id));
        return sendSuccess(res, { user: toSafeUser(updated, { mask: false }) }, 'Password reset successfully', 200, undefined, { mask: false });
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * 修改密码。优先使用本地 password_hash；旧 SuperTokens 账号保留兼容路径。
 */
export const changePassword = async (req, res, next) => {
    try {
        const ar = req;
        const stSession = ar.stSession;
        const user = ar.user;
        if (!user) {
            throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
        }
        const validation = changePasswordSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: validation.error.issues,
            });
        }
        const oldPassword = String(req.body?.oldPassword || req.body?.currentPassword || '');
        const newPassword = readNewPassword(req.body || {});
        ensurePasswordPolicy(newPassword);
        if (user.password_hash) {
            const ok = await bcrypt.compare(oldPassword, user.password_hash);
            if (!ok) {
                throw new AppError('Invalid old password', 400, ErrorCode.BAD_REQUEST);
            }
            await updateLocalPassword(user.id, newPassword);
            await invalidateUserCache(String(user.id));
            await logAction(user.id, 'CHANGE_PASSWORD_SUCCESS', 'auth', req, {});
            return sendSuccess(res, null, 'Password updated successfully.');
        }
        if (!stSession || !user.email) {
            throw new AppError('Password credentials are not available for this account', 400, ErrorCode.BAD_REQUEST);
        }
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
            const failure = 'failureReason' in updated && typeof updated.failureReason === 'string'
                ? updated.failureReason
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
        await invalidateUserCache(String(user.id));
        await logAction(user.id, 'CHANGE_PASSWORD_SUCCESS', 'auth', req, {});
        return sendSuccess(res, null, 'Password updated successfully. Other sessions have been logged out.');
    }
    catch (error) {
        if (req.user) {
            await logAction(req.user.id, 'CHANGE_PASSWORD_FAILURE', 'auth', req, {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
        next(handleError(error));
    }
};
/**
 * 列出当前 SuperTokens 会话
 */
export const getSessions = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user?.supertokens_user_id) {
            throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
        }
        const handles = await Session.getAllSessionHandlesForUser(user.supertokens_user_id);
        const currentHandle = req.stSession?.getHandle();
        const safeSessions = await Promise.all(handles.map(async (handle) => {
            const info = await Session.getSessionInformation(handle);
            return {
                id: handle,
                userAgent: null,
                ipAddress: null,
                createdAt: info ? new Date(info.timeCreated) : new Date(0),
                isCurrent: handle === currentHandle,
                expiresAt: info ? new Date(info.expiry) : new Date(0),
            };
        }));
        return sendSuccess(res, safeSessions);
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * 撤销指定 SuperTokens 会话（sessionId 为 session handle）
 */
export const revokeSession = async (req, res, next) => {
    try {
        const validation = sessionIdParamSchema.safeParse(req.params);
        if (!validation.success) {
            throw new AppError('Invalid session ID', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: validation.error.issues,
            });
        }
        const { sessionId: sessionHandle } = validation.data;
        const user = req.user;
        const stSession = req.stSession;
        if (!user?.supertokens_user_id) {
            throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
        }
        const handles = await Session.getAllSessionHandlesForUser(user.supertokens_user_id);
        if (!handles.includes(sessionHandle)) {
            throw new AppError('Session not found', 404, ErrorCode.NOT_FOUND);
        }
        if (stSession?.getHandle() === sessionHandle) {
            throw new AppError('Cannot revoke current session via this endpoint. Use logout instead.', 400, ErrorCode.BAD_REQUEST);
        }
        await Session.revokeSession(sessionHandle);
        await logDataChange(user.id, 'REVOKE_SESSION', `session_${sessionHandle}`, req, null, { sessionHandle });
        return sendSuccess(res, null, 'Session revoked successfully');
    }
    catch (error) {
        next(error);
    }
};
/**
 * 登出：撤销当前 SuperTokens 会话并清理历史 JWT Cookie（兼容旧客户端）
 */
export const logout = async (req, res, next) => {
    try {
        const stSession = req.stSession;
        const user = req.user;
        if (stSession) {
            await stSession.revokeSession();
        }
        if (user) {
            await logAction(user.id, 'USER_LOGOUT', 'auth', req, {});
        }
        for (const name of ['mu_token', 'mu_refresh_token', LOCAL_AUTH_COOKIE_NAME]) {
            if (name === LOCAL_AUTH_COOKIE_NAME) {
                clearLocalAuthCookie(res);
            }
            else {
                res.clearCookie(name, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                    path: '/',
                    domain: process.env.COOKIE_DOMAIN || undefined,
                });
            }
        }
        return sendSuccess(res, null, 'Logout successful');
    }
    catch (error) {
        logger.warn('[Auth] logout error:', {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
};
/**
 * 注册统计（管理）
 */
export const getRegistrationStats = async (req, res, next) => {
    try {
        const stats = await withCache(REGISTRATION_STATS_CACHE_KEY, async () => {
            const totalUsers = await prisma.user.count();
            const verifiedUsers = await prisma.user.count({ where: { email_verified: true } });
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentRegistrations = await prisma.user.count({
                where: { created_at: { gte: sevenDaysAgo } },
            });
            const dailyStats = await prisma.$queryRaw `
        SELECT date(created_at) as date, count(*) as count 
        FROM User 
        WHERE created_at >= ${sevenDaysAgo}
        GROUP BY date(created_at)
        ORDER BY date ASC
      `;
            return { totalUsers, verifiedUsers, recentRegistrations, dailyStats };
        }, { ttl: 600000 });
        return sendSuccess(res, stats);
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=authController.js.map