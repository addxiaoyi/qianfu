import Session from 'supertokens-node/recipe/session';
import RecipeUserId from 'supertokens-node/lib/build/recipeUserId';
import crypto from 'crypto';
import prisma from '../db.js';
import { sendSuccess, toSafeUser } from '../utils/response.js';
import bcrypt from 'bcrypt';
import { AppError, ErrorCode } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getOrCreateSuperTokensUser } from '../services/superTokensUser.js';
import { sendEmailLoginCode } from '../services/emailService.js';
import { getJwtSecret } from '../utils/securityConfig.js';
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function normalizePhone(phone) {
    return phone.trim().replace(/[\s-]/g, '');
}
function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
function generateCodeHash(identifier, code) {
    const secret = getJwtSecret();
    return crypto.createHmac('sha256', secret).update(`${identifier}:${code}`).digest('hex');
}
/**

 * 注册用户

 * 流程：验证验证码 → 创建用户 → 创建 SuperTokens 用户 → 创建会话 → 返回 token

 * 支持 email 和 phone 双通道注册

 *

 * 关键修复：注册成功后立即清除 Prisma 中的 verification_token，

 * 防止验证码被复用攻击。

 */
export const registerUser = async (req, res, next) => {
    try {
        const { email, phone, code, username, password } = req.body;
        const emailStr = typeof email === 'string' ? email.trim() : '';
        const phoneStr = typeof phone === 'string' ? phone.trim() : '';
        if (!username || !password) {
            throw new AppError('username and password are required (email or phone is required)', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (!emailStr && !phoneStr) {
            throw new AppError('Email or phone is required', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (!emailStr) {
            throw new AppError('Phone-only registration is not supported by the current user schema', 400, ErrorCode.VALIDATION_ERROR);
        }
        const usernameNorm = username.trim();
        const passwordStr = password;
        if (usernameNorm.length < 3 || usernameNorm.length > 30) {
            throw new AppError('Username must be 3-30 characters', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(usernameNorm)) {
            throw new AppError('Username can only contain letters, numbers, underscores and hyphens', 400, ErrorCode.VALIDATION_ERROR);
        }
        const passwordFinal = passwordStr;
        if (passwordFinal.length < 8) {
            throw new AppError('Password must be at least 8 characters', 400, ErrorCode.VALIDATION_ERROR);
        }
        // 确定注册渠道类型
        const type = emailStr ? 'email' : 'phone';
        const identifier = emailStr ? normalizeEmail(emailStr) : normalizePhone(phoneStr);
        // 渠道特定验证
        if (type === 'email' && emailStr.length < 5) {
            throw new AppError('Email format is invalid', 400, ErrorCode.VALIDATION_ERROR);
        }
        // 检查用户名是否已存在
        const existingUser = await prisma.user.findFirst({
            where: { username: usernameNorm },
        });
        if (existingUser) {
            throw new AppError('Username is already taken', 409, ErrorCode.CONFLICT);
        }
        // 检查 email 是否已被注册（如果提供了 email）
        if (type === 'email') {
            const emailExists = await prisma.user.findUnique({ where: { email: identifier } });
            if (emailExists) {
                throw new AppError('Email is already registered', 409, ErrorCode.CONFLICT);
            }
        }
        // 检查 phone 是否已被注册（如果提供了 phone）
        if (type === 'phone') {
            const phoneExists = await prisma.user.findUnique({ where: { phone: identifier } });
            if (phoneExists) {
                throw new AppError('Phone is already registered', 409, ErrorCode.CONFLICT);
            }
        }
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    type === 'email' ? { email: identifier } : {},
                    type === 'phone' ? { phone: identifier } : {},
                ].filter(Boolean),
            },
        });
        if (!user) {
            // 新用户注册：先创建未验证账号，并立即发出邮箱验证码。
            const passwordHash = await bcrypt.hash(passwordFinal, 12);
            const verificationCode = generateCode();
            const verificationToken = generateCodeHash(identifier, verificationCode);
            const tokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
            const newUser = await prisma.user.create({
                data: {
                    email: identifier,
                    username: usernameNorm,
                    display_name: usernameNorm,
                    password_hash: passwordHash,
                    email_verified: false,
                    verification_token: verificationToken,
                    token_expiry: tokenExpiry,
                    last_code_send_at: new Date(),
                },
            });
            try {
                await sendEmailLoginCode(identifier, verificationCode);
            }
            catch (error) {
                await prisma.user.deleteMany({ where: { id: newUser.id } });
                logger.error('[Register] Verification code delivery failed; rolled back pending user', {
                    userId: newUser.id,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw new AppError('Verification code delivery is temporarily unavailable. Please retry shortly.', 503, ErrorCode.SERVICE_UNAVAILABLE, true);
            }
            return sendSuccess(res, {
                user: toSafeUser(newUser, { mask: false }),
                pendingVerification: true,
            }, 'Verification code sent', 200, undefined, { mask: false });
        }
        // 已存在用户：验证验证码，如果正确则登录
        const codeStr = typeof code === 'string' ? code.trim() : '';
        if (!codeStr) {
            throw new AppError('Verification code is required for existing accounts', 400, ErrorCode.VALIDATION_ERROR);
        }
        const verificationToken = generateCodeHash(identifier, codeStr);
        if (!user.verification_token ||
            !user.token_expiry ||
            user.token_expiry < new Date() ||
            user.verification_token !== verificationToken) {
            throw new AppError('Invalid or expired verification code', 400, ErrorCode.BAD_REQUEST);
        }
        // 注册成功：清除验证码，防止复用
        await prisma.user.update({
            where: { id: user.id },
            data: {
                username: usernameNorm,
                display_name: usernameNorm,
                ...(type === 'email' ? { email: identifier } : { phone: identifier }),
                password_hash: await bcrypt.hash(passwordFinal, 12),
                email_verified: true,
                verification_token: null,
                token_expiry: null,
            },
        });
        // 登录：创建 SuperTokens 会话
        let stUserId = user.supertokens_user_id;
        if (!stUserId) {
            stUserId = user.email ? await getOrCreateSuperTokensUser(user.email) : null;
            if (stUserId) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { supertokens_user_id: stUserId },
                });
            }
        }
        let accessToken = null;
        let refreshToken = null;
        if (stUserId) {
            try {
                const session = await Session.createNewSession(req, res, process.env.NEXT_PUBLIC_SUPER_TOKENS_TENANT_ID || '1', new RecipeUserId(stUserId), {}, {});
                accessToken = session.getAccessToken();
                const tokens = session.getAllSessionTokensDangerously();
                refreshToken = tokens.refreshToken || null;
            }
            catch (stError) {
                logger.warn('[Register] Failed to create SuperTokens session:', stError);
            }
        }
        return sendSuccess(res, {
            user: {
                id: user.id,
                email: user.email || undefined,
                phone: user.phone || undefined,
                username: user.username,
                display_name: user.display_name,
                role: user.role,
                created_at: user.created_at,
            },
            accessToken,
            refreshToken,
        }, 'Code verified and logged in');
    }
    catch (error) {
        logger.error('[Register] Registration failed:', error);
        next(error);
    }
};
//# sourceMappingURL=registerController.js.map