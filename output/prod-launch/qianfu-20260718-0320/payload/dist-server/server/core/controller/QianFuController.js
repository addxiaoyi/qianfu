import { Router } from 'express';
import { adminOnly, authenticate, authenticateOptional } from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { requireVerifiedEmail } from '../../middleware/emailVerifiedGuard.js';
import { validateBody } from '../../middleware/requestValidation.js';
import { SignatureUtil, qianfuConfig } from '../utils/SignatureUtil.js';
import { callbackQueue } from '../task/CallbackQueue.js';
import { reconciliationJob } from '../task/ReconciliationJob.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { AppError, ErrorCode, handleError } from '../../utils/errors.js';
import prisma from '../../db.js';
import crypto from 'crypto';
import { redisService } from '../../services/redisService.js';
import { completePaymentWithSideEffects } from '../../services/paymentCompletionService.js';
import { createMarketplaceOrder } from '../../services/marketplaceOrderService.js';
import { buildQianFuNotifyReplayKey, extractRequestClientIp, isNotifyIpAllowed, resolveNotifyIpAllowlist, } from '../../services/paymentCallbackSecurity.js';
import { marketplaceCreateOrderSchema, marketplaceCreateProductSchema, marketplaceCreateReviewSchema, marketplaceOpenDisputeSchema, marketplaceResolveDisputeSchema, marketplaceReviewProductSchema, marketplaceReviewSellerSchema, marketplaceUpdateProductSchema, } from './marketplaceSchemas.js';
const router = Router();
const canReadMarketplaceOrder = (req, order, product) => {
    if (!req.user)
        return false;
    return req.isAdmin === true || order.buyerId === req.user.id || product.creatorId === req.user.id;
};
const canViewMarketplaceProduct = (req, product) => ((product.isPublished && product.listingStatus === 'APPROVED')
    || req.isAdmin === true
    || product.creatorId === req.user?.id);
const makeMarketplaceId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const isUniqueConstraintError = (error) => (typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002');
const requireActiveMarketplaceSeller = async (userId) => {
    const seller = await prisma.user.findUnique({
        where: { id: userId },
        select: { marketplace_seller_status: true },
    });
    if (!seller) {
        throw new AppError('Seller not found', 404, ErrorCode.NOT_FOUND);
    }
    if (seller.marketplace_seller_status !== 'ACTIVE') {
        throw new AppError('Marketplace seller access is suspended', 403, ErrorCode.FORBIDDEN);
    }
};
const defaultMarketplaceProducts = [];
const defaultMarketplaceOrders = [];
let marketplaceProducts = [...defaultMarketplaceProducts];
let marketplaceOrders = [...defaultMarketplaceOrders];
const defaultShopConfig = {
    bannerUrl: '',
    avatarUrl: '',
    announcementTitle: '',
    announcementText: '',
    bio: '',
    shopName: '',
    ownerId: null,
    theme: 'default',
};
let marketplaceShopConfig = { ...defaultShopConfig };
let marketplaceShopMetrics = {
    visits: 0,
    announcementClicks: 0,
    featuredClicks: 0,
    updatedAt: new Date().toISOString(),
};
let marketplaceShopVersions = [];
const SHOP_CONFIG_STORAGE_KEY = 'marketplace_shop_config';
const SHOP_METRICS_STORAGE_KEY = 'marketplace_shop_metrics';
const SHOP_VERSIONS_STORAGE_KEY = 'marketplace_shop_versions';
const persistMarketplace = async () => {
    const products = marketplaceProducts.map((product) => ({
        id: product.id,
        title: product.title,
        category: product.category,
        description: product.description,
        price: product.price,
        sales: product.sales,
        rating: product.rating,
        review_count: product.reviewCount,
        is_published: product.isPublished,
        listing_status: product.listingStatus,
        moderation_notes: product.moderationNotes,
        author_name: product.author,
        cover_url: product.coverUrl,
        download_url: product.downloadUrl,
        created_at: new Date(product.createdAt),
        updated_at: new Date(),
    }));
    await prisma.marketplaceProduct.deleteMany();
    if (products.length > 0) {
        await prisma.marketplaceProduct.createMany({ data: products });
    }
    await prisma.marketplaceOrder.deleteMany();
    if (marketplaceOrders.length > 0) {
        await prisma.marketplaceOrder.createMany({
            data: marketplaceOrders.map((order) => ({
                id: order.id,
                product_id: order.productId,
                buyer_id: order.buyerId,
                buyer_name: order.buyerName,
                quantity: order.quantity,
                total_price: order.totalPrice,
                status: order.status,
                payment_status: order.paymentStatus,
                fulfillment_status: order.fulfillmentStatus,
                dispute_status: order.disputeStatus,
                dispute_reason: order.disputeReason,
                dispute_description: order.disputeDescription,
                dispute_resolution: order.disputeResolution,
                dispute_opened_at: order.disputeOpenedAt ? new Date(order.disputeOpenedAt) : null,
                dispute_resolved_at: order.disputeResolvedAt ? new Date(order.disputeResolvedAt) : null,
                created_at: new Date(order.createdAt),
                updated_at: new Date(),
            })),
        });
    }
};
const loadJsonStorage = async (key, fallback) => {
    const cached = await redisService.get(key).catch(() => null);
    if (!cached)
        return fallback;
    try {
        return JSON.parse(cached);
    }
    catch {
        return fallback;
    }
};
const saveJsonStorage = async (key, value) => {
    await redisService.set(key, JSON.stringify(value)).catch(() => undefined);
};
const loadMarketplace = async () => {
    const [products, orders, storedConfig, storedMetrics, storedVersions] = await Promise.all([
        prisma.marketplaceProduct.findMany({ orderBy: { created_at: 'desc' } }),
        prisma.marketplaceOrder.findMany({ orderBy: { created_at: 'desc' } }),
        loadJsonStorage(SHOP_CONFIG_STORAGE_KEY, null),
        loadJsonStorage(SHOP_METRICS_STORAGE_KEY, null),
        loadJsonStorage(SHOP_VERSIONS_STORAGE_KEY, null),
    ]);
    if (storedConfig)
        marketplaceShopConfig = { ...defaultShopConfig, ...storedConfig };
    if (storedMetrics)
        marketplaceShopMetrics = storedMetrics;
    if (storedVersions)
        marketplaceShopVersions = storedVersions;
    marketplaceProducts = products.map((product) => ({
        id: product.id,
        title: product.title,
        category: product.category,
        description: product.description,
        price: product.price,
        sales: product.sales,
        rating: product.rating,
        reviewCount: product.review_count,
        isPublished: product.is_published,
        listingStatus: product.listing_status,
        moderationNotes: product.moderation_notes,
        author: product.author_name,
        coverUrl: product.cover_url ?? undefined,
        downloadUrl: product.download_url ?? undefined,
        creatorId: product.creator_id,
        favoritedBy: [],
        createdAt: product.created_at.toISOString(),
    }));
    marketplaceOrders = orders.map((order) => ({
        id: order.id,
        productId: order.product_id,
        productTitle: order.product_id ?? 'Unknown Product',
        buyerId: order.buyer_id,
        buyerName: order.buyer_name,
        quantity: order.quantity,
        totalPrice: order.total_price,
        status: order.status,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        disputeStatus: order.dispute_status,
        disputeReason: order.dispute_reason,
        disputeDescription: order.dispute_description,
        disputeResolution: order.dispute_resolution,
        disputeOpenedAt: order.dispute_opened_at?.toISOString() ?? null,
        disputeResolvedAt: order.dispute_resolved_at?.toISOString() ?? null,
        deliveryUrl: order.delivery_url ?? undefined,
        paymentId: order.payment_id ?? undefined,
        logs: [],
        createdAt: order.created_at.toISOString(),
    }));
    if (marketplaceProducts.length === 0) {
        marketplaceProducts = [...defaultMarketplaceProducts];
        marketplaceOrders = [...defaultMarketplaceOrders];
        await persistMarketplace();
    }
};
void loadMarketplace().catch((error) => logger.warn('[QianFu] Failed to load marketplace store', error));
const mapFavoriteIds = (product, currentUserId) => ({
    ...product,
    favorited: currentUserId ? (product.favoritedBy || []).includes(currentUserId) : false,
});
const toPublicMarketplaceProduct = (product) => {
    const publicProduct = { ...product };
    delete publicProduct.downloadUrl;
    return publicProduct;
};
const getDefaultMarketplaceShopConfig = () => ({ ...defaultShopConfig });
const snapshotShopConfig = (config) => ({
    id: makeMarketplaceId('shopver'),
    config: { ...config },
    createdAt: new Date().toISOString(),
});
const themePresets = {
    default: {},
    tech: {},
    minimal: {},
    creator: {},
};
const parseNonNegativeIntegerEnv = (envName, fallback) => {
    const raw = process.env[envName];
    if (!raw?.trim()) {
        return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        logger.warn(`[QianFu] Invalid ${envName}=${raw}, fallback to ${fallback}`);
        return fallback;
    }
    return parsed;
};
const PAYMENT_NOTIFY_REPLAY_TTL_SECONDS = parseNonNegativeIntegerEnv('PAYMENT_NOTIFY_REPLAY_TTL_SECONDS', 600);
const QIANFU_NOTIFY_REPLAY_TTL_SECONDS = parseNonNegativeIntegerEnv('QIANFU_NOTIFY_REPLAY_TTL_SECONDS', PAYMENT_NOTIFY_REPLAY_TTL_SECONDS);
const QIANFU_NOTIFY_IP_ALLOWLIST = resolveNotifyIpAllowlist(process.env.QIANFU_NOTIFY_IP_ALLOWLIST, process.env.PAYMENT_NOTIFY_IP_ALLOWLIST || qianfuConfig.whitelist?.join(','));
const timingSafeEqualText = (left, right) => {
    const leftDigest = crypto.createHash('sha256').update(left).digest();
    const rightDigest = crypto.createHash('sha256').update(right).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
};
const parseCallbackAmountFen = (raw) => {
    const value = String(raw ?? '').trim();
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match)
        return null;
    const yuan = Number.parseInt(match[1], 10);
    const fraction = Number.parseInt((match[2] || '').padEnd(2, '0') || '0', 10);
    if (!Number.isSafeInteger(yuan) || !Number.isSafeInteger(fraction))
        return null;
    const fen = yuan * 100 + fraction;
    return Number.isSafeInteger(fen) ? fen : null;
};
router.post('/payment/create', async (req, res, next) => {
    try {
        if (!qianfuConfig.enabled) {
            return sendError(res, 'QianFu integration is disabled', 400);
        }
        const { outTradeNo, amount, payType, subject } = req.body;
        if (!outTradeNo || !amount || !payType || !subject) {
            return sendError(res, 'Missing required parameters', 400);
        }
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const bodyMd5 = SignatureUtil.md5(JSON.stringify(req.body));
        const signature = SignatureUtil.generateSignature({
            method: 'POST',
            path: '/qianfu-api/payment/create',
            timestamp,
            bodyMd5,
        }, qianfuConfig.secretKey);
        const xpayResponse = await fetch(`${qianfuConfig.apiUrl}/payment/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-QianFu-AppId': qianfuConfig.appId,
                'X-QianFu-Timestamp': timestamp,
                'X-QianFu-Signature': signature,
            },
            body: JSON.stringify({
                outTradeNo,
                amount,
                payType,
                subject,
                notifyUrl: `${qianfuConfig.callbackUrl}`,
                returnUrl: req.body.returnUrl,
            }),
        });
        if (!xpayResponse.ok) {
            const errorText = await xpayResponse.text();
            logger.error(`[QianFu] Payment creation failed: ${errorText}`);
            return sendError(res, 'Failed to create payment', 500);
        }
        const result = await xpayResponse.json();
        return sendSuccess(res, result);
    }
    catch (error) {
        logger.error('[QianFu] Error creating payment:', error);
        next(handleError(error));
    }
});
router.get('/payment/query/:orderId', async (req, res, next) => {
    try {
        if (!qianfuConfig.enabled) {
            return sendError(res, 'QianFu integration is disabled', 400);
        }
        const { orderId } = req.params;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const path = `/qianfu-api/payment/query/${orderId}`;
        const signature = SignatureUtil.generateSignature({
            method: 'GET',
            path,
            timestamp,
            bodyMd5: '',
        }, qianfuConfig.secretKey);
        const xpayResponse = await fetch(`${qianfuConfig.apiUrl}/payment/query/${orderId}`, {
            method: 'GET',
            headers: {
                'X-QianFu-AppId': qianfuConfig.appId,
                'X-QianFu-Timestamp': timestamp,
                'X-QianFu-Signature': signature,
            },
        });
        if (!xpayResponse.ok) {
            return sendError(res, 'Failed to query payment', 500);
        }
        const result = await xpayResponse.json();
        return sendSuccess(res, result);
    }
    catch (error) {
        logger.error('[QianFu] Error querying payment:', error);
        next(handleError(error));
    }
});
router.post('/payment/close/:orderId', async (req, res, next) => {
    try {
        if (!qianfuConfig.enabled) {
            return sendError(res, 'QianFu integration is disabled', 400);
        }
        const { orderId } = req.params;
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const path = `/qianfu-api/payment/close/${orderId}`;
        const signature = SignatureUtil.generateSignature({
            method: 'POST',
            path,
            timestamp,
            bodyMd5: '',
        }, qianfuConfig.secretKey);
        const xpayResponse = await fetch(`${qianfuConfig.apiUrl}/payment/close/${orderId}`, {
            method: 'POST',
            headers: {
                'X-QianFu-AppId': qianfuConfig.appId,
                'X-QianFu-Timestamp': timestamp,
                'X-QianFu-Signature': signature,
            },
        });
        if (!xpayResponse.ok) {
            return sendError(res, 'Failed to close payment', 500);
        }
        const result = await xpayResponse.json();
        return sendSuccess(res, result);
    }
    catch (error) {
        logger.error('[QianFu] Error closing payment:', error);
        next(handleError(error));
    }
});
router.post('/xpay/notify', async (req, res, next) => {
    let replayKey = null;
    try {
        if (!qianfuConfig.enabled) {
            return sendError(res, 'QianFu integration is disabled', 404, 'NOT_FOUND');
        }
        const notifyData = req.body;
        logger.info(`[QianFu] Received callback: ${JSON.stringify(notifyData)}`);
        const clientIp = extractRequestClientIp(req);
        if (!isNotifyIpAllowed(clientIp, QIANFU_NOTIFY_IP_ALLOWLIST)) {
            logger.warn('[QianFu] Callback rejected by IP allowlist', {
                clientIp,
                allowlistSize: QIANFU_NOTIFY_IP_ALLOWLIST.size,
            });
            return sendError(res, 'Forbidden callback source IP', 403, 'FORBIDDEN');
        }
        if (!notifyData.outTradeNo) {
            return sendError(res, 'Missing outTradeNo', 400);
        }
        if (!notifyData.sign || !String(notifyData.sign).trim()) {
            return sendError(res, 'Missing callback signature', 400);
        }
        const callbackAmountFen = parseCallbackAmountFen(notifyData.money || notifyData.amount);
        if (callbackAmountFen === null) {
            return sendError(res, 'Invalid callback amount', 400);
        }
        const xpayToken = process.env.XPAY_TOKEN?.trim();
        if (!xpayToken) {
            logger.error('[QianFu] Callback rejected because XPAY_TOKEN is not configured');
            return sendError(res, 'Payment callback is not configured', 503);
        }
        const localSign = crypto
            .createHash('md5')
            .update(`${notifyData.type || ''}${notifyData.money || ''}${notifyData.outTradeNo}${notifyData.dt || ''}${xpayToken}`)
            .digest('hex');
        if (!timingSafeEqualText(localSign.toLowerCase(), String(notifyData.sign).trim().toLowerCase())) {
            logger.warn(`[QianFu] Invalid callback signature for order ${notifyData.outTradeNo}`);
            return sendError(res, 'Invalid signature', 400);
        }
        if (notifyData.status !== 'SUCCESS') {
            return sendSuccess(res, { received: true, ignored: true }, 'Ignored non-success callback');
        }
        if (QIANFU_NOTIFY_REPLAY_TTL_SECONDS > 0) {
            replayKey = buildQianFuNotifyReplayKey({
                outTradeNo: notifyData.outTradeNo,
                tradeNo: notifyData.tradeNo,
                payType: notifyData.payType,
                amount: notifyData.amount,
                money: notifyData.money,
                dt: notifyData.dt,
                status: notifyData.status,
                payTime: notifyData.payTime,
                sign: notifyData.sign,
            });
            const accepted = await redisService.setIfNotExists(replayKey, {
                source: 'qianfu',
                outTradeNo: notifyData.outTradeNo,
                tradeNo: notifyData.tradeNo,
            }, QIANFU_NOTIFY_REPLAY_TTL_SECONDS);
            if (!accepted) {
                logger.warn('[QianFu] Duplicate callback ignored', {
                    outTradeNo: notifyData.outTradeNo,
                    replayKey,
                });
                return sendSuccess(res, { received: true, replay: true }, 'Duplicate callback ignored');
            }
        }
        const completion = await redisService.withLock(`qianfu:notify:${notifyData.outTradeNo}`, () => completePaymentWithSideEffects(prisma, {
            paymentId: notifyData.outTradeNo,
            expectedAmountFen: callbackAmountFen,
            metadata: {
                callbackSource: 'qianfu-xpay',
                tradeNo: notifyData.tradeNo,
                payType: notifyData.payType,
            },
        }));
        if (completion.status === 'NOT_FOUND') {
            return sendError(res, 'Payment not found', 404, 'NOT_FOUND');
        }
        if (completion.status === 'AMOUNT_MISMATCH') {
            return sendError(res, 'Callback amount does not match payment', 400);
        }
        return sendSuccess(res, { received: true });
    }
    catch (error) {
        if (replayKey) {
            await redisService.del(replayKey).catch(() => undefined);
        }
        logger.error('[QianFu] Error processing callback:', error);
        next(handleError(error));
    }
});
router.get('/account/balance', async (req, res, next) => {
    try {
        if (!qianfuConfig.enabled) {
            return sendError(res, 'QianFu integration is disabled', 400);
        }
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const path = '/qianfu-api/account/balance';
        const signature = SignatureUtil.generateSignature({
            method: 'GET',
            path,
            timestamp,
            bodyMd5: '',
        }, qianfuConfig.secretKey);
        const xpayResponse = await fetch(`${qianfuConfig.apiUrl}/account/balance`, {
            headers: {
                'X-QianFu-AppId': qianfuConfig.appId,
                'X-QianFu-Timestamp': timestamp,
                'X-QianFu-Signature': signature,
            },
        });
        if (!xpayResponse.ok) {
            return sendError(res, 'Failed to get balance', 500);
        }
        const result = await xpayResponse.json();
        return sendSuccess(res, result);
    }
    catch (error) {
        logger.error('[QianFu] Error getting balance:', error);
        next(handleError(error));
    }
});
router.get('/reconciliation/daily', async (req, res, next) => {
    try {
        const { date } = req.query;
        const targetDate = date || new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const summary = await reconciliationJob.getDailySummary(targetDate);
        if (!summary) {
            return sendError(res, 'No data for this date', 404);
        }
        return sendSuccess(res, summary);
    }
    catch (error) {
        logger.error('[QianFu] Error getting daily reconciliation:', error);
        next(handleError(error));
    }
});
router.get('/reconciliation/summary', async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        const startDateObj = new Date(start);
        const endDateObj = new Date(end);
        const payments = await prisma.payment.findMany({
            where: {
                created_at: {
                    gte: startDateObj,
                    lte: endDateObj,
                },
            },
        });
        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const completedAmount = payments.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + p.amount, 0);
        return sendSuccess(res, {
            startDate: start,
            endDate: end,
            totalOrders: payments.length,
            completedOrders: payments.filter(p => p.status === 'COMPLETED').length,
            totalAmount: totalAmount.toFixed(2),
            completedAmount: completedAmount.toFixed(2),
        });
    }
    catch (error) {
        logger.error('[QianFu] Error getting reconciliation summary:', error);
        next(handleError(error));
    }
});
router.get('/reconciliation/exceptions', async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        const exceptions = await reconciliationJob.getExceptions(start, end);
        return sendSuccess(res, { exceptions, count: exceptions.length });
    }
    catch (error) {
        logger.error('[QianFu] Error getting exceptions:', error);
        next(handleError(error));
    }
});
router.get('/marketplace/products', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const sortBy = String(req.query.sortBy || 'featured');
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(24, Math.max(1, Number(req.query.pageSize || 12)));
    const list = marketplaceProducts.filter((product) => product.isPublished && product.listingStatus === 'APPROVED');
    if (sortBy === 'sales')
        list.sort((a, b) => b.sales - a.sales);
    else if (sortBy === 'rating')
        list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    else if (sortBy === 'latest')
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = list.length;
    const start = (page - 1) * pageSize;
    const products = list
        .slice(start, start + pageSize)
        .map((product) => mapFavoriteIds(toPublicMarketplaceProduct(product), req.user?.id));
    return sendSuccess(res, {
        products,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
    });
});
router.get('/marketplace/creators/:creatorId/products', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const creatorId = Number(req.params.creatorId);
    if (!Number.isSafeInteger(creatorId) || creatorId <= 0) {
        return sendError(res, 'Invalid creator ID', 400, 'VALIDATION_ERROR');
    }
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(24, Math.max(1, Number(req.query.pageSize || 12)));
    const list = marketplaceProducts.filter((product) => (product.creatorId === creatorId && product.isPublished && product.listingStatus === 'APPROVED'));
    const total = list.length;
    const start = (page - 1) * pageSize;
    return sendSuccess(res, {
        products: list
            .slice(start, start + pageSize)
            .map((product) => mapFavoriteIds(toPublicMarketplaceProduct(product), req.user?.id)),
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
    });
});
router.get('/marketplace/products/:id', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const product = marketplaceProducts.find((item) => item.id === req.params.id);
    if (!product || !canViewMarketplaceProduct(req, product)) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const related = marketplaceProducts
        .filter((item) => item.isPublished && item.listingStatus === 'APPROVED' && item.id !== product.id && item.category === product.category)
        .slice(0, 3);
    const reviews = await prisma.marketplaceReview.findMany({
        where: { product_id: product.id },
        orderBy: { created_at: 'desc' },
        take: 20,
    });
    const currentUserId = req.user?.id;
    const favorites = currentUserId
        ? await prisma.marketplaceFavorite.findMany({ where: { product_id: product.id, user_id: currentUserId } })
        : [];
    const canManageProduct = req.isAdmin === true || product.creatorId === currentUserId;
    return sendSuccess(res, {
        product: mapFavoriteIds(canManageProduct ? product : toPublicMarketplaceProduct(product), currentUserId),
        related: related.map((item) => mapFavoriteIds(toPublicMarketplaceProduct(item), currentUserId)),
        reviews: reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            content: review.content,
            createdAt: review.created_at.toISOString(),
        })),
        favorite: favorites.length > 0,
    });
});
router.post('/marketplace/products', authenticate, requireVerifiedEmail, csrfProtection, validateBody(marketplaceCreateProductSchema), async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    await requireActiveMarketplaceSeller(req.user.id);
    const { title, category, description, price, author, coverUrl, downloadUrl } = req.body;
    const product = {
        id: makeMarketplaceId('prd'),
        title,
        category,
        description,
        price,
        sales: 0,
        rating: 0,
        reviewCount: 0,
        isPublished: false,
        listingStatus: 'PENDING_REVIEW',
        author,
        coverUrl,
        downloadUrl,
        creatorId: req.user?.id ?? null,
        createdAt: new Date().toISOString(),
    };
    await prisma.marketplaceProduct.create({
        data: {
            id: product.id,
            title: product.title,
            category: product.category,
            description: product.description,
            price: product.price,
            sales: product.sales,
            rating: product.rating,
            review_count: product.reviewCount,
            is_published: product.isPublished,
            listing_status: product.listingStatus,
            author_name: product.author,
            cover_url: product.coverUrl,
            download_url: product.downloadUrl,
            creator_id: product.creatorId,
            created_at: new Date(product.createdAt),
            updated_at: new Date(),
        },
    });
    marketplaceProducts.unshift(product);
    return sendSuccess(res, { product }, 'Product created');
});
router.post('/marketplace/orders', authenticate, requireVerifiedEmail, csrfProtection, validateBody(marketplaceCreateOrderSchema), async (req, res, next) => {
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const idempotencyKey = req.header('Idempotency-Key')?.trim() || '';
    if (!idempotencyKey) {
        return sendError(res, 'Idempotency-Key is required', 400, 'VALIDATION_ERROR');
    }
    try {
        const { productId, quantity } = req.body;
        const { order: orderRecord, payment, product, replayed } = await createMarketplaceOrder(prisma, {
            buyerId: req.user.id,
            buyerName: req.user.username || `user_${req.user.id}`,
            productId,
            quantity,
            idempotencyKey,
        });
        const order = {
            id: orderRecord.id,
            productId: orderRecord.product_id,
            productTitle: product.title,
            buyerId: orderRecord.buyer_id,
            buyerName: orderRecord.buyer_name,
            quantity: orderRecord.quantity,
            totalPrice: orderRecord.total_price,
            status: orderRecord.status,
            paymentStatus: orderRecord.payment_status,
            fulfillmentStatus: orderRecord.fulfillment_status,
            disputeStatus: orderRecord.dispute_status,
            disputeReason: orderRecord.dispute_reason,
            disputeDescription: orderRecord.dispute_description,
            disputeResolution: orderRecord.dispute_resolution,
            disputeOpenedAt: orderRecord.dispute_opened_at?.toISOString() ?? null,
            disputeResolvedAt: orderRecord.dispute_resolved_at?.toISOString() ?? null,
            deliveryUrl: orderRecord.delivery_url,
            paymentId: orderRecord.payment_id,
            createdAt: orderRecord.created_at.toISOString(),
        };
        return sendSuccess(res, { order, payment, replayed }, replayed ? 'Order already created' : 'Order created');
    }
    catch (error) {
        logger.error('[QianFu] Error creating marketplace order:', error);
        next(handleError(error));
    }
});
router.patch('/marketplace/products/:id', authenticate, requireVerifiedEmail, csrfProtection, validateBody(marketplaceUpdateProductSchema), async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    await requireActiveMarketplaceSeller(req.user.id);
    const productIndex = marketplaceProducts.findIndex((item) => item.id === req.params.id);
    if (productIndex === -1) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const current = marketplaceProducts[productIndex];
    if (current.creatorId !== req.user.id) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    const { title, category, description, price, author, coverUrl, downloadUrl } = req.body;
    const updated = {
        ...current,
        title: title ?? current.title,
        category: category ?? current.category,
        description: description ?? current.description,
        price: price ?? current.price,
        author: author ?? current.author,
        coverUrl: coverUrl ?? current.coverUrl,
        downloadUrl: downloadUrl ?? current.downloadUrl,
        isPublished: false,
        listingStatus: 'PENDING_REVIEW',
        moderationNotes: null,
    };
    await prisma.marketplaceProduct.update({
        where: { id: updated.id },
        data: {
            title: updated.title,
            category: updated.category,
            description: updated.description,
            price: updated.price,
            author_name: updated.author,
            cover_url: updated.coverUrl,
            download_url: updated.downloadUrl,
            is_published: false,
            listing_status: 'PENDING_REVIEW',
            moderation_notes: null,
            updated_at: new Date(),
        },
    });
    marketplaceProducts[productIndex] = updated;
    return sendSuccess(res, { product: updated }, 'Product updated');
});
router.post('/marketplace/products/:id/unpublish', authenticate, requireVerifiedEmail, csrfProtection, async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const productIndex = marketplaceProducts.findIndex((item) => item.id === req.params.id);
    if (productIndex === -1) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const product = marketplaceProducts[productIndex];
    if (product.creatorId !== req.user.id) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    await prisma.marketplaceProduct.update({
        where: { id: product.id },
        data: { is_published: false, updated_at: new Date() },
    });
    marketplaceProducts[productIndex] = { ...product, isPublished: false };
    return sendSuccess(res, { unpublished: true }, 'Product unpublished');
});
router.post('/marketplace/products/:id/publish', authenticate, requireVerifiedEmail, csrfProtection, async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    await requireActiveMarketplaceSeller(req.user.id);
    const productIndex = marketplaceProducts.findIndex((item) => item.id === req.params.id);
    if (productIndex === -1) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const product = marketplaceProducts[productIndex];
    if (product.creatorId !== req.user.id) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    if (product.listingStatus !== 'APPROVED') {
        return sendError(res, 'Product must pass review before publication', 409, 'CONFLICT');
    }
    await prisma.marketplaceProduct.update({
        where: { id: product.id },
        data: { is_published: true, updated_at: new Date() },
    });
    marketplaceProducts[productIndex] = { ...product, isPublished: true };
    return sendSuccess(res, { published: true }, 'Product published');
});
router.post('/marketplace/products/:id/review', authenticate, requireVerifiedEmail, adminOnly, csrfProtection, validateBody(marketplaceReviewProductSchema), async (req, res) => {
    await loadMarketplace();
    const productIndex = marketplaceProducts.findIndex((item) => item.id === req.params.id);
    if (productIndex === -1) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const { status, notes } = req.body;
    const isApproved = status === 'APPROVED';
    const product = marketplaceProducts[productIndex];
    await prisma.$transaction(async (tx) => {
        await tx.marketplaceProduct.update({
            where: { id: product.id },
            data: {
                listing_status: status,
                moderation_notes: notes || null,
                is_published: isApproved,
                updated_at: new Date(),
            },
        });
        await tx.auditLog.create({
            data: {
                user_id: req.user?.id ?? null,
                action: `MARKETPLACE_PRODUCT_${status}`,
                target: product.id,
                details: notes || null,
                method: req.method,
                endpoint: req.originalUrl,
                ip_address: req.ip,
                user_agent: req.get('user-agent') || null,
            },
        });
    });
    marketplaceProducts[productIndex] = {
        ...product,
        listingStatus: status,
        moderationNotes: notes || null,
        isPublished: isApproved,
    };
    return sendSuccess(res, { product: marketplaceProducts[productIndex] }, 'Product review recorded');
});
router.post('/marketplace/sellers/:id/review', authenticate, requireVerifiedEmail, adminOnly, csrfProtection, validateBody(marketplaceReviewSellerSchema), async (req, res) => {
    const sellerId = Number(req.params.id);
    if (!Number.isSafeInteger(sellerId) || sellerId <= 0) {
        return sendError(res, 'Invalid seller ID', 400, 'VALIDATION_ERROR');
    }
    const seller = await prisma.user.findUnique({ where: { id: sellerId }, select: { id: true } });
    if (!seller) {
        return sendError(res, 'Seller not found', 404, 'NOT_FOUND');
    }
    const { status, notes } = req.body;
    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: sellerId },
            data: {
                marketplace_seller_status: status,
                marketplace_seller_notes: notes || null,
            },
        });
        if (status === 'SUSPENDED') {
            await tx.marketplaceProduct.updateMany({
                where: { creator_id: sellerId },
                data: {
                    is_published: false,
                    listing_status: 'SUSPENDED',
                    moderation_notes: notes || 'Seller access suspended',
                    updated_at: new Date(),
                },
            });
        }
        await tx.auditLog.create({
            data: {
                user_id: req.user?.id ?? null,
                action: `MARKETPLACE_SELLER_${status}`,
                target: String(sellerId),
                details: notes || null,
                method: req.method,
                endpoint: req.originalUrl,
                ip_address: req.ip,
                user_agent: req.get('user-agent') || null,
            },
        });
    });
    if (status === 'SUSPENDED') {
        marketplaceProducts = marketplaceProducts.map((product) => (product.creatorId === sellerId
            ? { ...product, isPublished: false, listingStatus: 'SUSPENDED', moderationNotes: notes || 'Seller access suspended' }
            : product));
    }
    return sendSuccess(res, { sellerId, status }, 'Seller review recorded');
});
router.post('/marketplace/products/:id/favorite', authenticate, requireVerifiedEmail, csrfProtection, async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const product = marketplaceProducts.find((item) => item.id === req.params.id);
    if (!product || !product.isPublished || product.listingStatus !== 'APPROVED') {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const existing = await prisma.marketplaceFavorite.findUnique({
        where: { product_id_user_id: { product_id: product.id, user_id: req.user.id } },
    }).catch(() => null);
    if (existing) {
        await prisma.marketplaceFavorite.delete({ where: { id: existing.id } });
        return sendSuccess(res, { favorite: false }, 'Favorite removed');
    }
    await prisma.marketplaceFavorite.create({ data: { id: makeMarketplaceId('fav'), product_id: product.id, user_id: req.user.id } });
    return sendSuccess(res, { favorite: true }, 'Favorite added');
});
router.post('/marketplace/products/:id/reviews', authenticate, requireVerifiedEmail, csrfProtection, validateBody(marketplaceCreateReviewSchema), async (req, res, next) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const currentUser = req.user;
    const product = marketplaceProducts.find((item) => item.id === req.params.id);
    if (!product) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const paidOrder = await prisma.marketplaceOrder.findFirst({
        where: {
            product_id: product.id,
            buyer_id: currentUser.id,
            payment_status: 'PAID',
        },
        select: { id: true },
    });
    if (!paidOrder) {
        return sendError(res, 'A paid order is required before reviewing this product', 409, 'CONFLICT');
    }
    const { rating, content } = req.body;
    try {
        const result = await prisma.$transaction(async (tx) => {
            const review = await tx.marketplaceReview.create({
                data: {
                    id: makeMarketplaceId('rev'),
                    product_id: product.id,
                    user_id: currentUser.id,
                    rating,
                    content: content || null,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            });
            const summary = await tx.marketplaceReview.aggregate({
                where: { product_id: product.id },
                _count: { _all: true },
                _avg: { rating: true },
            });
            const reviewCount = summary._count._all;
            const productRating = Number((summary._avg.rating || 0).toFixed(2));
            await tx.marketplaceProduct.update({
                where: { id: product.id },
                data: { review_count: reviewCount, rating: productRating, updated_at: new Date() },
            });
            return {
                review: {
                    id: review.id,
                    product_id: review.product_id,
                    rating: review.rating,
                    content: review.content,
                    created_at: review.created_at,
                    updated_at: review.updated_at,
                },
                reviewCount,
                productRating,
            };
        }, { isolationLevel: 'Serializable' });
        const productIndex = marketplaceProducts.findIndex((item) => item.id === product.id);
        if (productIndex >= 0) {
            marketplaceProducts[productIndex] = {
                ...product,
                reviewCount: result.reviewCount,
                rating: result.productRating,
            };
        }
        return sendSuccess(res, { review: result.review });
    }
    catch (error) {
        if (isUniqueConstraintError(error)) {
            return sendError(res, 'You have already reviewed this product', 409, 'CONFLICT');
        }
        return next(handleError(error));
    }
});
router.get('/marketplace/shop/config', authenticateOptional, async (req, res) => {
    marketplaceShopMetrics.visits += 1;
    marketplaceShopMetrics.updatedAt = new Date().toISOString();
    return sendSuccess(res, {
        config: marketplaceShopConfig,
        editable: req.isAdmin === true,
        metrics: marketplaceShopMetrics,
        versions: marketplaceShopVersions.slice(-8).reverse(),
    });
});
router.get('/marketplace/shop/metrics', authenticateOptional, async (_req, res) => {
    return sendSuccess(res, { metrics: marketplaceShopMetrics, versions: marketplaceShopVersions.slice(-8).reverse() });
});
router.get('/marketplace/shop/themes', authenticateOptional, async (_req, res) => {
    return sendSuccess(res, { themes: Object.keys(themePresets) });
});
router.put('/marketplace/shop/config', authenticate, requireVerifiedEmail, adminOnly, csrfProtection, async (req, res) => {
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const nextConfig = {
        bannerUrl: String(req.body?.bannerUrl || '').trim() || marketplaceShopConfig.bannerUrl,
        avatarUrl: String(req.body?.avatarUrl || '').trim() || marketplaceShopConfig.avatarUrl,
        announcementTitle: String(req.body?.announcementTitle || '').trim() || marketplaceShopConfig.announcementTitle,
        announcementText: String(req.body?.announcementText || '').trim() || marketplaceShopConfig.announcementText,
        bio: String(req.body?.bio || '').trim() || marketplaceShopConfig.bio,
        shopName: String(req.body?.shopName || '').trim() || marketplaceShopConfig.shopName,
        ownerId: marketplaceShopConfig.ownerId,
        theme: (req.body?.theme || marketplaceShopConfig.theme),
    };
    marketplaceShopConfig = nextConfig;
    marketplaceShopVersions.push(snapshotShopConfig(nextConfig));
    marketplaceShopMetrics.updatedAt = new Date().toISOString();
    await saveJsonStorage(SHOP_CONFIG_STORAGE_KEY, marketplaceShopConfig);
    await saveJsonStorage(SHOP_VERSIONS_STORAGE_KEY, marketplaceShopVersions);
    await saveJsonStorage(SHOP_METRICS_STORAGE_KEY, marketplaceShopMetrics);
    return sendSuccess(res, { config: marketplaceShopConfig }, 'Shop config updated');
});
router.post('/marketplace/shop/config/reset', authenticate, requireVerifiedEmail, adminOnly, csrfProtection, async (req, res) => {
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    marketplaceShopConfig = getDefaultMarketplaceShopConfig();
    marketplaceShopVersions.push(snapshotShopConfig(marketplaceShopConfig));
    marketplaceShopMetrics.updatedAt = new Date().toISOString();
    await saveJsonStorage(SHOP_CONFIG_STORAGE_KEY, marketplaceShopConfig);
    await saveJsonStorage(SHOP_VERSIONS_STORAGE_KEY, marketplaceShopVersions);
    await saveJsonStorage(SHOP_METRICS_STORAGE_KEY, marketplaceShopMetrics);
    return sendSuccess(res, { config: marketplaceShopConfig }, 'Shop config reset');
});
router.post('/marketplace/shop/theme/:theme', authenticate, requireVerifiedEmail, adminOnly, csrfProtection, async (req, res) => {
    if (!req.user)
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    const theme = req.params.theme;
    if (!themePresets[theme])
        return sendError(res, 'Theme not found', 404, 'NOT_FOUND');
    marketplaceShopConfig = { ...marketplaceShopConfig, ...themePresets[theme], theme };
    marketplaceShopVersions.push(snapshotShopConfig(marketplaceShopConfig));
    await saveJsonStorage(SHOP_CONFIG_STORAGE_KEY, marketplaceShopConfig);
    await saveJsonStorage(SHOP_VERSIONS_STORAGE_KEY, marketplaceShopVersions);
    await saveJsonStorage(SHOP_METRICS_STORAGE_KEY, marketplaceShopMetrics);
    return sendSuccess(res, { config: marketplaceShopConfig }, 'Theme applied');
});
router.get('/marketplace/shop/history', authenticateOptional, async (_req, res) => {
    return sendSuccess(res, { versions: marketplaceShopVersions.slice().reverse() });
});
router.post('/marketplace/shop/metrics/click', authenticateOptional, async (req, res) => {
    const kind = String(req.body?.kind || 'featured');
    if (kind === 'announcement')
        marketplaceShopMetrics.announcementClicks += 1;
    else
        marketplaceShopMetrics.featuredClicks += 1;
    marketplaceShopMetrics.updatedAt = new Date().toISOString();
    await saveJsonStorage(SHOP_METRICS_STORAGE_KEY, marketplaceShopMetrics);
    return sendSuccess(res, { metrics: marketplaceShopMetrics });
});
router.get('/marketplace/orders/:id', authenticate, async (req, res) => {
    await loadMarketplace();
    const order = marketplaceOrders.find((item) => item.id === req.params.id);
    if (!order) {
        return sendError(res, 'Order not found', 404, 'NOT_FOUND');
    }
    const product = marketplaceProducts.find((item) => item.id === order.productId);
    if (!product) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    if (!canReadMarketplaceOrder(req, order, product)) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    const currentUserId = req.user?.id;
    const favorite = currentUserId
        ? await prisma.marketplaceFavorite.findFirst({ where: { product_id: product.id, user_id: currentUserId } })
        : null;
    const logs = await prisma.marketplaceFulfillmentLog.findMany({ where: { order_id: order.id }, orderBy: { created_at: 'asc' } });
    return sendSuccess(res, {
        order: {
            ...order,
            paymentStatus: order.paymentStatus || 'PENDING',
            fulfillmentStatus: order.fulfillmentStatus || (product.downloadUrl ? 'READY' : 'PENDING'),
            deliveryUrl: order.fulfillmentStatus === 'DELIVERED' ? order.deliveryUrl || product.downloadUrl || null : null,
            logs: logs.map((log) => ({ at: log.created_at.toISOString(), status: log.status, note: log.note || '' })),
        },
        product: mapFavoriteIds(toPublicMarketplaceProduct(product), currentUserId),
        favorite: !!favorite,
        permissions: {
            canOpenDispute: order.buyerId === currentUserId
                && order.paymentStatus === 'PAID'
                && order.disputeStatus === 'NONE',
            canResolveDispute: req.isAdmin === true && order.disputeStatus === 'OPEN',
        },
    });
});
router.post('/marketplace/orders/:id/fulfill', authenticate, requireVerifiedEmail, csrfProtection, async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const order = marketplaceOrders.find((item) => item.id === req.params.id);
    if (!order) {
        return sendError(res, 'Order not found', 404, 'NOT_FOUND');
    }
    const product = marketplaceProducts.find((item) => item.id === order.productId);
    if (!product || product.creatorId !== req.user.id) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    if (order.paymentStatus !== 'PAID') {
        return sendError(res, 'Order payment is not complete', 409, 'CONFLICT');
    }
    if (order.disputeStatus === 'OPEN') {
        return sendError(res, 'Order has an open dispute', 409, 'CONFLICT');
    }
    const deliveryUrl = product.downloadUrl || null;
    const updatedOrder = {
        ...order,
        paymentStatus: 'PAID',
        fulfillmentStatus: deliveryUrl ? 'DELIVERED' : 'READY',
        deliveryUrl,
        logs: [
            ...(order.logs || []),
            { at: new Date().toISOString(), status: 'PAID', note: 'Payment confirmed' },
            { at: new Date().toISOString(), status: deliveryUrl ? 'DELIVERED' : 'READY', note: deliveryUrl ? 'Auto delivered via product download url' : 'Waiting for manual delivery' },
        ],
    };
    const index = marketplaceOrders.findIndex((item) => item.id === order.id);
    marketplaceOrders[index] = updatedOrder;
    await prisma.marketplaceFulfillmentLog.create({
        data: {
            id: makeMarketplaceId('flg'),
            order_id: order.id,
            status: updatedOrder.fulfillmentStatus || 'READY',
            note: updatedOrder.deliveryUrl ? 'Auto delivered' : 'Manual review required',
            created_at: new Date(),
        },
    });
    await prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: {
            payment_status: 'PAID',
            fulfillment_status: deliveryUrl ? 'DELIVERED' : 'READY',
            delivery_url: deliveryUrl,
            updated_at: new Date(),
        },
    });
    return sendSuccess(res, { order: updatedOrder, deliveryUrl }, 'Order fulfilled');
});
router.post('/marketplace/orders/:id/dispute', authenticate, requireVerifiedEmail, csrfProtection, validateBody(marketplaceOpenDisputeSchema), async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const orderIndex = marketplaceOrders.findIndex((item) => item.id === req.params.id);
    if (orderIndex === -1) {
        return sendError(res, 'Order not found', 404, 'NOT_FOUND');
    }
    const order = marketplaceOrders[orderIndex];
    if (order.buyerId !== req.user.id) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    if (order.paymentStatus !== 'PAID') {
        return sendError(res, 'Only paid orders can be disputed', 409, 'CONFLICT');
    }
    if (order.disputeStatus !== 'NONE') {
        return sendError(res, 'Order already has a dispute record', 409, 'CONFLICT');
    }
    const { reason, description } = req.body;
    const openedAt = new Date();
    await prisma.$transaction(async (tx) => {
        await tx.marketplaceOrder.update({
            where: { id: order.id },
            data: {
                dispute_status: 'OPEN',
                dispute_reason: reason,
                dispute_description: description,
                dispute_opened_at: openedAt,
                updated_at: openedAt,
            },
        });
        await tx.marketplaceFulfillmentLog.create({
            data: {
                id: makeMarketplaceId('flg'),
                order_id: order.id,
                status: 'DISPUTE_OPENED',
                note: reason,
                userId: req.user?.id ?? null,
                created_at: openedAt,
            },
        });
        await tx.auditLog.create({
            data: {
                user_id: req.user?.id ?? null,
                action: 'MARKETPLACE_DISPUTE_OPENED',
                target: order.id,
                details: JSON.stringify({ reason }),
                method: req.method,
                endpoint: req.originalUrl,
                ip_address: req.ip,
                user_agent: req.get('user-agent') || null,
            },
        });
    });
    marketplaceOrders[orderIndex] = {
        ...order,
        disputeStatus: 'OPEN',
        disputeReason: reason,
        disputeDescription: description,
        disputeOpenedAt: openedAt.toISOString(),
    };
    return sendSuccess(res, { order: marketplaceOrders[orderIndex] }, 'Dispute opened');
});
router.post('/marketplace/orders/:id/dispute/resolve', authenticate, requireVerifiedEmail, adminOnly, csrfProtection, validateBody(marketplaceResolveDisputeSchema), async (req, res) => {
    await loadMarketplace();
    const orderIndex = marketplaceOrders.findIndex((item) => item.id === req.params.id);
    if (orderIndex === -1) {
        return sendError(res, 'Order not found', 404, 'NOT_FOUND');
    }
    const order = marketplaceOrders[orderIndex];
    if (order.disputeStatus !== 'OPEN') {
        return sendError(res, 'Order has no open dispute', 409, 'CONFLICT');
    }
    const { status, resolution } = req.body;
    const resolvedAt = new Date();
    await prisma.$transaction(async (tx) => {
        await tx.marketplaceOrder.update({
            where: { id: order.id },
            data: {
                dispute_status: status,
                dispute_resolution: resolution,
                dispute_resolved_at: resolvedAt,
                updated_at: resolvedAt,
            },
        });
        await tx.marketplaceFulfillmentLog.create({
            data: {
                id: makeMarketplaceId('flg'),
                order_id: order.id,
                status: `DISPUTE_${status}`,
                note: resolution,
                userId: req.user?.id ?? null,
                created_at: resolvedAt,
            },
        });
        await tx.auditLog.create({
            data: {
                user_id: req.user?.id ?? null,
                action: `MARKETPLACE_DISPUTE_${status}`,
                target: order.id,
                details: resolution,
                method: req.method,
                endpoint: req.originalUrl,
                ip_address: req.ip,
                user_agent: req.get('user-agent') || null,
            },
        });
        if (order.buyerId) {
            await tx.notification.create({
                data: {
                    user_id: order.buyerId,
                    title: 'Marketplace dispute updated',
                    content: `Your dispute for order ${order.id} was ${status.toLowerCase()}.`,
                    type: status === 'RESOLVED' ? 'SUCCESS' : 'WARNING',
                },
            });
        }
    });
    marketplaceOrders[orderIndex] = {
        ...order,
        disputeStatus: status,
        disputeResolution: resolution,
        disputeResolvedAt: resolvedAt.toISOString(),
    };
    return sendSuccess(res, { order: marketplaceOrders[orderIndex] }, 'Dispute resolved');
});
router.get('/marketplace/me/listings', authenticate, async (req, res) => {
    await loadMarketplace();
    const currentUserId = req.user?.id;
    const listings = currentUserId ? marketplaceProducts.filter((item) => item.creatorId === currentUserId) : [];
    return sendSuccess(res, {
        products: listings,
        total: listings.length,
    });
});
router.get('/marketplace/favorites', authenticate, async (req, res) => {
    await loadMarketplace();
    const currentUserId = req.user?.id;
    if (!currentUserId) {
        return sendSuccess(res, { products: [], total: 0 });
    }
    const favoriteIds = new Set((await prisma.marketplaceFavorite.findMany({ where: { user_id: currentUserId } })).map((fav) => fav.product_id));
    const products = marketplaceProducts
        .filter((item) => item.isPublished && favoriteIds.has(item.id))
        .map((item) => mapFavoriteIds(toPublicMarketplaceProduct(item), currentUserId));
    return sendSuccess(res, { products, total: products.length });
});
router.get('/marketplace/me/orders', authenticate, async (req, res) => {
    await loadMarketplace();
    const currentUserId = req.user?.id;
    const orders = currentUserId ? marketplaceOrders.filter((order) => {
        const product = marketplaceProducts.find((item) => item.id === order.productId);
        return product?.creatorId === currentUserId || order.buyerId === currentUserId;
    }) : [];
    return sendSuccess(res, {
        orders,
        total: orders.length,
    });
});
router.get('/marketplace/rankings', async (_req, res) => {
    await loadMarketplace();
    const publishedProducts = marketplaceProducts.filter((product) => product.isPublished);
    const salesRanking = [...publishedProducts].sort((a, b) => b.sales - a.sales).slice(0, 10).map(toPublicMarketplaceProduct);
    const ratingRanking = [...publishedProducts].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 10).map(toPublicMarketplaceProduct);
    const recommendationRanking = [...publishedProducts].sort((a, b) => (b.sales * 0.7 + b.rating * 20) - (a.sales * 0.7 + a.rating * 20)).slice(0, 10).map(toPublicMarketplaceProduct);
    return sendSuccess(res, {
        sales: salesRanking,
        rating: ratingRanking,
        recommendation: recommendationRanking,
    });
});
router.get('/health', async (req, res) => {
    const queueStats = await callbackQueue.getQueueStats();
    res.json({
        status: 'ok',
        integration: qianfuConfig.enabled ? 'enabled' : 'disabled',
        apiUrl: qianfuConfig.apiUrl,
        callbackQueue: queueStats,
        marketplace: {
            productCount: marketplaceProducts.length,
            orderCount: marketplaceOrders.length,
        },
        timestamp: new Date().toISOString(),
    });
});
export default router;
//# sourceMappingURL=QianFuController.js.map