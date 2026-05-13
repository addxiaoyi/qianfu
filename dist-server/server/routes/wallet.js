import { Router } from 'express';
import { ensureWallet, deposit, verifyTransactionIntegrity, getWalletBalanceBreakdown } from '../lib/wallet';
import { authenticate } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { walletLimiter } from '../middleware/rateLimiter';
import { verifySignature } from '../middleware/signature';
import prisma from '../db';
import { logger } from '../utils/logger';
import { sendSuccess, sendPaginated } from '../utils/response';
import { fenToYuanNumber } from '../utils/currency';
import { walletRechargeSchema, walletTransactionQuerySchema, walletRedeemSchema, adminCreateRedeemCodeSchema, adminGenerateRedeemCodeSchema, adminRedeemCodeListQuerySchema, } from '../utils/validation';
import { AppError, ErrorCode } from '../utils/errors';
import { logAction } from '../services/auditService';
const router = Router();
router.use(authenticate);
router.use(walletLimiter);
router.use(verifySignature);
const REDEEM_CODE_PREFIX = 'redeem:code:';
const REDEEM_USER_PREFIX = 'redeem:user:';
const normalizeRedeemCode = (raw) => raw.trim().toUpperCase();
const parseRedeemAmount = (input) => {
    const normalized = input.trim();
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new AppError('兑换码金额配置无效', 400, ErrorCode.BAD_REQUEST);
    }
    // Return yuan value (will be converted to fen by deposit function)
    return parsed;
};
const generateRandomRedeemCode = (length = 10) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
};
// Get Wallet Balance
router.get('/', async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const userId = user.userId || user.id;
        const breakdown = await getWalletBalanceBreakdown(userId);
        return sendSuccess(res, {
            balance: breakdown.totalBalance,
            withdrawable_balance: breakdown.withdrawableBalance,
            non_withdrawable_balance: breakdown.nonWithdrawableBalance,
            currency: breakdown.currency,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get Transactions
router.get('/transactions', async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const userId = user.userId || user.id;
        const wallet = await ensureWallet(userId);
        const validation = walletTransactionQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { page, limit } = validation.data;
        const skip = (page - 1) * limit;
        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where: { wallet_id: wallet.id },
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.transaction.count({
                where: { wallet_id: wallet.id }
            })
        ]);
        // Data sanitization and integrity verification for response
        const sanitizedTransactions = transactions.map(t => {
            // Verify HMAC signature to detect tampering
            const isIntegrityValid = verifyTransactionIntegrity({
                id: t.id,
                walletId: t.wallet_id,
                amount: t.amount,
                type: t.type,
                status: t.status,
                createdAt: t.created_at,
                signature: t.signature
            });
            if (!isIntegrityValid && t.signature) {
                logger.warn(`[SECURITY] Transaction integrity check failed for ID: ${t.id}, User: ${userId}`);
            }
            const parsedMetadata = t.metadata ? JSON.parse(t.metadata) : null;
            const isNonWithdrawable = t.type === 'CHECKIN_REWARD' ||
                Boolean(parsedMetadata && typeof parsedMetadata === 'object' && parsedMetadata.nonWithdrawable === true);
            return {
                id: t.id,
                amount: fenToYuanNumber(t.amount), // Convert fen to yuan for API response
                type: t.type,
                status: t.status,
                description: t.description,
                created_at: t.created_at,
                // Metadata might contain sensitive info like payment IDs or method details
                metadata: parsedMetadata,
                non_withdrawable: isNonWithdrawable,
                integrity_valid: isIntegrityValid
            };
        });
        return sendPaginated(res, sanitizedTransactions, total, page, limit);
    }
    catch (error) {
        next(error);
    }
});
// Recharge (Deposit)
// SECURITY: Production must use payment callback flow (e.g. xpay notify), not direct recharge.
router.post('/recharge', walletLimiter, csrfProtection, verifySignature, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const allowDirectRecharge = process.env.ALLOW_DIRECT_WALLET_RECHARGE === 'true';
        const isAdmin = String(user.role || '').toUpperCase() === 'ADMIN';
        const isDev = process.env.NODE_ENV !== 'production';
        if (!isDev && !(allowDirectRecharge && isAdmin)) {
            throw new AppError('Direct wallet recharge is disabled in production', 403, ErrorCode.FORBIDDEN);
        }
        const validation = walletRechargeSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { amount } = validation.data;
        if (amount <= 0) {
            throw new AppError('Amount must be positive', 400, ErrorCode.BAD_REQUEST);
        }
        if (amount > 1000) {
            throw new AppError('Maximum recharge amount per transaction is 1000 during demo', 400, ErrorCode.BAD_REQUEST);
        }
        // keep tiny delay in non-production to simulate payment processing
        if (isDev) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        const updatedWallet = await deposit(user.id, amount, isDev ? 'Wallet Recharge (Dev)' : 'Wallet Recharge (Admin Override)');
        logger.warn('[WALLET] Direct recharge used', {
            userId: user.id,
            amount,
            env: process.env.NODE_ENV,
            adminOverride: !isDev,
        });
        return sendSuccess(res, {
            balance: fenToYuanNumber(updatedWallet.balance), // Convert fen to yuan
            message: 'Recharge successful',
        });
    }
    catch (error) {
        next(error);
    }
});
// Redeem code to wallet balance
router.post('/redeem', csrfProtection, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        }
        const validation = walletRedeemSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const userId = user.userId || user.id;
        const code = normalizeRedeemCode(validation.data.code);
        const userRedeemKey = `${REDEEM_USER_PREFIX}${userId}:${code}`;
        const alreadyRedeemedByUser = await prisma.systemConfig.findUnique({ where: { key: userRedeemKey } });
        if (alreadyRedeemedByUser) {
            throw new AppError('该兑换码你已使用过', 400, ErrorCode.BAD_REQUEST);
        }
        const codeKey = `${REDEEM_CODE_PREFIX}${code}`;
        const cfg = await prisma.systemConfig.findUnique({ where: { key: codeKey } });
        if (!cfg) {
            throw new AppError('兑换码无效', 404, ErrorCode.NOT_FOUND);
        }
        let payload;
        try {
            payload = JSON.parse(cfg.value);
        }
        catch {
            throw new AppError('兑换码配置损坏', 500, ErrorCode.INTERNAL_ERROR);
        }
        const maxUses = Number.isFinite(payload.maxUses) ? Number(payload.maxUses) : 1;
        const usedCount = Number.isFinite(payload.usedCount) ? Number(payload.usedCount) : 0;
        if (maxUses > 0 && usedCount >= maxUses) {
            throw new AppError('兑换码已被使用完', 400, ErrorCode.BAD_REQUEST);
        }
        const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
        if (expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
            throw new AppError('兑换码已过期', 400, ErrorCode.BAD_REQUEST);
        }
        const amount = parseRedeemAmount(String(payload.amount ?? '0'));
        const nonWithdrawable = Boolean(payload.nonWithdrawable ?? true);
        if (payload.disabled === true) {
            throw new AppError('兑换码已停用', 400, ErrorCode.BAD_REQUEST);
        }
        if (payload.expiresAt) {
            const expiresAt = new Date(payload.expiresAt);
            if (Number.isNaN(expiresAt.getTime())) {
                throw new AppError('兑换码配置中的过期时间无效', 500, ErrorCode.INTERNAL_ERROR);
            }
            if (expiresAt.getTime() <= Date.now()) {
                throw new AppError('兑换码已过期', 400, ErrorCode.BAD_REQUEST);
            }
        }
        const result = await prisma.$transaction(async (tx) => {
            const latestCfg = await tx.systemConfig.findUnique({ where: { key: codeKey } });
            if (!latestCfg) {
                throw new AppError('兑换码无效', 404, ErrorCode.NOT_FOUND);
            }
            const latestPayload = JSON.parse(latestCfg.value);
            const latestMaxUses = Number.isFinite(latestPayload.maxUses) ? Number(latestPayload.maxUses) : 1;
            const latestUsedCount = Number.isFinite(latestPayload.usedCount) ? Number(latestPayload.usedCount) : 0;
            if (latestMaxUses > 0 && latestUsedCount >= latestMaxUses) {
                throw new AppError('兑换码已被使用完', 400, ErrorCode.BAD_REQUEST);
            }
            const existed = await tx.systemConfig.findUnique({ where: { key: userRedeemKey } });
            if (existed) {
                throw new AppError('该兑换码你已使用过', 400, ErrorCode.BAD_REQUEST);
            }
            await tx.systemConfig.create({
                data: {
                    key: userRedeemKey,
                    value: JSON.stringify({ code, userId, redeemedAt: new Date().toISOString(), amount }),
                    description: 'redeem usage by user',
                },
            });
            await tx.systemConfig.update({
                where: { key: codeKey },
                data: {
                    value: JSON.stringify({
                        ...latestPayload,
                        usedCount: latestUsedCount + 1,
                        updatedAt: new Date().toISOString(),
                    }),
                },
            });
            const wallet = await deposit(userId, amount, `兑换码奖励：${code}`, {
                type: 'REDEEM_CODE',
                metadata: {
                    source: 'redeem_code',
                    code,
                    nonWithdrawable,
                },
            });
            return wallet;
        });
        logger.info('[WALLET] redeem success', { userId, code, amount });
        return sendSuccess(res, {
            amount,
            non_withdrawable: nonWithdrawable,
            balance: fenToYuanNumber(result.balance), // Convert fen to yuan
            message: '兑换成功',
        });
    }
    catch (error) {
        next(error);
    }
});
// Admin: create redeem code
router.post('/admin/redeem-codes', csrfProtection, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const role = String(user.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'OWNER') {
            throw new AppError('Permission denied', 403, ErrorCode.FORBIDDEN);
        }
        const validation = adminCreateRedeemCodeSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const payload = validation.data;
        const code = normalizeRedeemCode(payload.code);
        const key = `${REDEEM_CODE_PREFIX}${code}`;
        const existed = await prisma.systemConfig.findUnique({ where: { key } });
        if (existed) {
            throw new AppError('兑换码已存在', 400, ErrorCode.BAD_REQUEST);
        }
        const value = {
            amount: Math.round(payload.amount * 100) / 100,
            maxUses: payload.maxUses,
            usedCount: 0,
            nonWithdrawable: payload.nonWithdrawable,
            expiresAt: payload.expiresAt ?? null,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
            note: payload.note ?? null,
        };
        await prisma.systemConfig.create({
            data: {
                key,
                value: JSON.stringify(value),
                description: `redeem code:${code}`,
            },
        });
        await logAction(user.id, 'REDEEM_CODE_CREATE', `redeem_code:${code}`, req, {
            amount: value.amount,
            maxUses: value.maxUses,
            nonWithdrawable: value.nonWithdrawable,
            expiresAt: value.expiresAt,
        });
        return sendSuccess(res, {
            code,
            ...value,
        }, '兑换码创建成功');
    }
    catch (error) {
        next(error);
    }
});
// Admin: list redeem codes
router.get('/admin/redeem-codes', async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const role = String(user.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'OWNER') {
            throw new AppError('Permission denied', 403, ErrorCode.FORBIDDEN);
        }
        const validation = adminRedeemCodeListQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { q, page, limit } = validation.data;
        const rows = await prisma.systemConfig.findMany({
            where: {
                key: { startsWith: REDEEM_CODE_PREFIX },
            },
            orderBy: { updated_at: 'desc' },
            take: 2000,
        });
        const list = rows.map((row) => {
            let parsed = {};
            try {
                parsed = JSON.parse(row.value);
            }
            catch {
                parsed = {};
            }
            const disabled = Boolean(parsed.disabled === true);
            return {
                code: row.key.replace(REDEEM_CODE_PREFIX, ''),
                amount: parsed.amount ?? 0,
                maxUses: parsed.maxUses ?? 1,
                usedCount: parsed.usedCount ?? 0,
                remainingUses: Math.max(0, (parsed.maxUses ?? 1) - (parsed.usedCount ?? 0)),
                nonWithdrawable: Boolean(parsed.nonWithdrawable ?? true),
                expiresAt: parsed.expiresAt ?? null,
                note: parsed.note ?? null,
                disabled,
                updatedAt: row.updated_at,
            };
        });
        const filtered = q
            ? list.filter((item) => item.code.toLowerCase().includes(q.toLowerCase()))
            : list;
        const total = filtered.length;
        const start = (page - 1) * limit;
        const paged = filtered.slice(start, start + limit);
        return sendSuccess(res, {
            items: paged,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Admin: generate random redeem code
router.post('/admin/redeem-codes/generate', csrfProtection, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const role = String(user.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'OWNER') {
            throw new AppError('Permission denied', 403, ErrorCode.FORBIDDEN);
        }
        const validation = adminGenerateRedeemCodeSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Invalid input', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const payload = validation.data;
        let code = '';
        for (let i = 0; i < 8; i++) {
            const candidate = generateRandomRedeemCode(payload.length);
            const key = `${REDEEM_CODE_PREFIX}${candidate}`;
            const existed = await prisma.systemConfig.findUnique({ where: { key } });
            if (!existed) {
                code = candidate;
                break;
            }
        }
        if (!code) {
            throw new AppError('生成兑换码失败，请重试', 500, ErrorCode.INTERNAL_ERROR);
        }
        const key = `${REDEEM_CODE_PREFIX}${code}`;
        const value = {
            amount: Math.round(payload.amount * 100) / 100,
            maxUses: payload.maxUses,
            usedCount: 0,
            nonWithdrawable: payload.nonWithdrawable,
            expiresAt: payload.expiresAt ?? null,
            createdBy: user.id,
            createdAt: new Date().toISOString(),
            note: payload.note ?? null,
        };
        await prisma.systemConfig.create({
            data: {
                key,
                value: JSON.stringify(value),
                description: `redeem code:${code}`,
            },
        });
        return sendSuccess(res, { code, ...value }, '兑换码生成成功');
    }
    catch (error) {
        next(error);
    }
});
// Admin: disable redeem code
router.patch('/admin/redeem-codes/:code/disable', csrfProtection, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const role = String(user.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'OWNER') {
            throw new AppError('Permission denied', 403, ErrorCode.FORBIDDEN);
        }
        const code = normalizeRedeemCode(String(req.params.code || ''));
        if (!code)
            throw new AppError('兑换码不能为空', 400, ErrorCode.BAD_REQUEST);
        const key = `${REDEEM_CODE_PREFIX}${code}`;
        const cfg = await prisma.systemConfig.findUnique({ where: { key } });
        if (!cfg)
            throw new AppError('兑换码不存在', 404, ErrorCode.NOT_FOUND);
        const parsed = JSON.parse(cfg.value);
        await prisma.systemConfig.update({
            where: { key },
            data: {
                value: JSON.stringify({ ...parsed, disabled: true, updatedAt: new Date().toISOString() }),
            },
        });
        await logAction(user.id, 'REDEEM_CODE_DISABLE', `redeem_code:${code}`, req, {
            code,
            previousDisabled: Boolean(parsed.disabled),
            nextDisabled: true,
        });
        return sendSuccess(res, { code, disabled: true }, '兑换码已停用');
    }
    catch (error) {
        next(error);
    }
});
// Admin: delete redeem code
router.delete('/admin/redeem-codes/:code', csrfProtection, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
        const role = String(user.role || '').toUpperCase();
        if (role !== 'ADMIN' && role !== 'OWNER') {
            throw new AppError('Permission denied', 403, ErrorCode.FORBIDDEN);
        }
        const code = normalizeRedeemCode(String(req.params.code || ''));
        if (!code)
            throw new AppError('兑换码不能为空', 400, ErrorCode.BAD_REQUEST);
        const key = `${REDEEM_CODE_PREFIX}${code}`;
        const existed = await prisma.systemConfig.findUnique({ where: { key } });
        if (!existed)
            throw new AppError('兑换码不存在', 404, ErrorCode.NOT_FOUND);
        await prisma.systemConfig.delete({ where: { key } });
        let snapshot = null;
        try {
            snapshot = JSON.parse(existed.value);
        }
        catch {
            snapshot = null;
        }
        await logAction(user.id, 'REDEEM_CODE_DELETE', `redeem_code:${code}`, req, {
            code,
            snapshot,
        });
        return sendSuccess(res, { code }, '兑换码已删除');
    }
    catch (error) {
        next(error);
    }
});
// Pay (Deduct)
// SECURITY: Disabled as a public endpoint to prevent arbitrary balance deduction.
// Payments should be handled through specific service routes that verify costs.
router.post('/pay', async (req, res) => {
    return res.status(405).json({ error: 'Direct payment endpoint is disabled. Use specific service routes.' });
});
export default router;
//# sourceMappingURL=wallet.js.map