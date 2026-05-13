import { Router } from 'express';
import { authenticateOptional } from '../../middleware/auth';
import { SignatureUtil, qianfuConfig } from '../utils/SignatureUtil';
import { callbackQueue } from '../task/CallbackQueue';
import { reconciliationJob } from '../task/ReconciliationJob';
import { logger } from '../utils/logger';
import { sendSuccess, sendError } from '../../utils/response';
import { handleError } from '../../utils/errors';
import prisma from '../../db';
import crypto from 'crypto';
import { redisService } from '../../services/redisService';
import { generateTransactionSignature } from '../../lib/wallet';
import { buildQianFuNotifyReplayKey, extractRequestClientIp, isNotifyIpAllowed, resolveNotifyIpAllowlist, } from '../../services/paymentCallbackSecurity';
const router = Router();
const makeMarketplaceId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const defaultMarketplaceProducts = [
    { id: 'map-1', title: '暮色城堡冒险地图', category: 'map', description: '高完成度主线任务地图，适合生存服活动服。', price: 18.8, sales: 268, rating: 4.9, reviewCount: 54, author: 'SkyArc', favoritedBy: [1, 2], coverUrl: 'https://picsum.photos/seed/map-1/800/500', downloadUrl: 'https://example.com/download/map-1', creatorId: 1, createdAt: new Date().toISOString() },
    { id: 'plugin-1', title: '经济商店插件包', category: 'plugin', description: '含经济、仓库、商店与权限配置示例。', price: 39.9, sales: 122, rating: 4.8, reviewCount: 31, author: 'NeoDev', favoritedBy: [1], coverUrl: 'https://picsum.photos/seed/plugin-1/800/500', downloadUrl: 'https://example.com/download/plugin-1', creatorId: 1, createdAt: new Date().toISOString() },
    { id: 'modpack-1', title: '轻量科技整合包', category: 'modpack', description: '低配友好，适合联机与录播服务器。', price: 29.9, sales: 94, rating: 4.7, reviewCount: 19, author: 'FrostLab', favoritedBy: [], coverUrl: 'https://picsum.photos/seed/modpack-1/800/500', downloadUrl: 'https://example.com/download/modpack-1', creatorId: 2, createdAt: new Date().toISOString() },
];
const defaultMarketplaceOrders = [];
let marketplaceProducts = [...defaultMarketplaceProducts];
let marketplaceOrders = [...defaultMarketplaceOrders];
const defaultShopConfig = {
    bannerUrl: 'https://picsum.photos/seed/shop-banner/1600/500',
    avatarUrl: 'https://picsum.photos/seed/shop-avatar/400/400',
    announcementTitle: '公告',
    announcementText: '每周上新资源，持续更新售后与兼容性说明。',
    bio: '专注 Minecraft 资源创作与持续更新，提供地图、插件、模组与整合包。',
    shopName: '创作者店铺',
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
                buyer_name: order.buyerName,
                quantity: order.quantity,
                total_price: order.totalPrice,
                status: order.status,
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
        buyerName: order.buyer_name,
        quantity: order.quantity,
        totalPrice: order.total_price,
        status: order.status,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
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
const getDefaultMarketplaceShopConfig = () => ({ ...defaultShopConfig });
const snapshotShopConfig = (config) => ({
    id: makeMarketplaceId('shopver'),
    config: { ...config },
    createdAt: new Date().toISOString(),
});
const themePresets = {
    default: {},
    tech: {
        bannerUrl: 'https://picsum.photos/seed/shop-tech-banner/1600/500',
        avatarUrl: 'https://picsum.photos/seed/shop-tech-avatar/400/400',
        shopName: '科技创作者工坊',
        announcementTitle: '科技公告',
        announcementText: '稳定更新，强调兼容性、性能与自动化发货。',
    },
    minimal: {
        bannerUrl: 'https://picsum.photos/seed/shop-minimal-banner/1600/500',
        avatarUrl: 'https://picsum.photos/seed/shop-minimal-avatar/400/400',
        shopName: '极简作品集',
        announcementTitle: '简洁公告',
        announcementText: '少即是多，只展示最重要的内容。',
    },
    creator: {
        bannerUrl: 'https://picsum.photos/seed/shop-creator-banner/1600/500',
        avatarUrl: 'https://picsum.photos/seed/shop-creator-avatar/400/400',
        shopName: '创作者商店',
        announcementTitle: '创作者公告',
        announcementText: '持续输出高质量内容，欢迎关注与收藏。',
    },
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
        if (notifyData.sign) {
            const localSign = crypto
                .createHash('md5')
                .update(`${notifyData.type || ''}${notifyData.money || ''}${notifyData.outTradeNo}${notifyData.dt || ''}${process.env.XPAY_TOKEN || ''}`)
                .digest('hex');
            if (!timingSafeEqualText(localSign.toLowerCase(), String(notifyData.sign).trim().toLowerCase())) {
                logger.warn(`[QianFu] Invalid callback signature for order ${notifyData.outTradeNo}`);
                return sendError(res, 'Invalid signature', 400);
            }
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
        await redisService.withLock(`qianfu:notify:${notifyData.outTradeNo}`, async () => {
            await prisma.$transaction(async (tx) => {
                const payment = await tx.payment.findFirst({
                    where: { id: notifyData.outTradeNo },
                });
                if (!payment) {
                    logger.warn(`[QianFu] Payment not found for callback outTradeNo=${notifyData.outTradeNo}`);
                    return;
                }
                if (payment.status === 'COMPLETED') {
                    logger.info(`[QianFu] Payment ${notifyData.outTradeNo} already completed`);
                    return;
                }
                const updatedPayment = await tx.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: 'COMPLETED',
                        updated_at: new Date(),
                    },
                });
                const marketplaceOrder = await tx.marketplaceOrder.findUnique({ where: { id: updatedPayment.id } }).catch(() => null);
                if (marketplaceOrder) {
                    const product = await tx.marketplaceProduct.findUnique({ where: { id: marketplaceOrder.product_id } });
                    await tx.marketplaceOrder.update({
                        where: { id: marketplaceOrder.id },
                        data: {
                            payment_status: 'PAID',
                            fulfillment_status: product?.download_url ? 'DELIVERED' : 'READY',
                            delivery_url: product?.download_url ?? null,
                            updated_at: new Date(),
                        },
                    });
                }
                // 仅 custom 充值订单增加钱包余额，避免套餐/业务订单重复加钱
                if (updatedPayment.plan_id !== 'custom') {
                    logger.info(`[QianFu] Payment ${notifyData.outTradeNo} completed (non-custom plan: ${updatedPayment.plan_id})`);
                    return;
                }
                const wallet = await tx.wallet.findUnique({
                    where: { user_id: updatedPayment.user_id },
                });
                if (!wallet) {
                    logger.warn(`[QianFu] Wallet missing for user ${updatedPayment.user_id}, skip balance update`);
                    return;
                }
                await tx.wallet.update({
                    where: { user_id: updatedPayment.user_id },
                    data: { balance: { increment: updatedPayment.amount } },
                });
                const transaction = await tx.transaction.create({
                    data: {
                        wallet_id: wallet.id,
                        amount: updatedPayment.amount,
                        type: 'DEPOSIT',
                        status: 'COMPLETED',
                        description: `XPay recharge: ${notifyData.tradeNo || notifyData.outTradeNo}`,
                        metadata: JSON.stringify({ tradeNo: notifyData.tradeNo, payType: notifyData.payType, outTradeNo: notifyData.outTradeNo }),
                    },
                });
                const signature = generateTransactionSignature({
                    id: transaction.id,
                    walletId: transaction.wallet_id,
                    amount: transaction.amount,
                    type: transaction.type,
                    status: transaction.status,
                    createdAt: transaction.created_at,
                });
                await tx.transaction.update({
                    where: { id: transaction.id },
                    data: { signature },
                });
                logger.info(`[QianFu] Payment ${notifyData.outTradeNo} completed and wallet recharged`);
            });
        });
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
    const list = [...marketplaceProducts];
    if (sortBy === 'sales')
        list.sort((a, b) => b.sales - a.sales);
    else if (sortBy === 'rating')
        list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    else if (sortBy === 'latest')
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = list.length;
    const start = (page - 1) * pageSize;
    const products = list.slice(start, start + pageSize).map((product) => mapFavoriteIds(product, req.user?.id));
    return sendSuccess(res, {
        products,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
    });
});
router.get('/marketplace/products/:id', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const product = marketplaceProducts.find((item) => item.id === req.params.id);
    if (!product) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const related = marketplaceProducts.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 3);
    const reviews = await prisma.marketplaceReview.findMany({
        where: { product_id: product.id },
        orderBy: { created_at: 'desc' },
        take: 20,
    });
    const currentUserId = req.user?.id;
    const favorites = currentUserId
        ? await prisma.marketplaceFavorite.findMany({ where: { product_id: product.id, user_id: currentUserId } })
        : [];
    return sendSuccess(res, {
        product: mapFavoriteIds(product, currentUserId),
        related: related.map((item) => mapFavoriteIds(item, currentUserId)),
        reviews: reviews.map((review) => ({
            id: review.id,
            rating: review.rating,
            content: review.content,
            createdAt: review.created_at.toISOString(),
        })),
        favorite: favorites.length > 0,
    });
});
router.post('/marketplace/products', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const { title, category, description, price, author, coverUrl, downloadUrl, creatorId } = req.body || {};
    if (!title || !category || !description || price === undefined || !author) {
        return sendError(res, 'Missing required fields', 400, 'VALIDATION_ERROR');
    }
    const product = {
        id: makeMarketplaceId('prd'),
        title,
        category,
        description,
        price: Number(price),
        sales: 0,
        rating: 0,
        reviewCount: 0,
        author,
        coverUrl,
        downloadUrl,
        creatorId: req.user?.id ?? (creatorId ? Number(creatorId) : null),
        createdAt: new Date().toISOString(),
    };
    marketplaceProducts.unshift(product);
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
            author_name: product.author,
            cover_url: product.coverUrl,
            download_url: product.downloadUrl,
            creator_id: product.creatorId,
            created_at: new Date(product.createdAt),
            updated_at: new Date(),
        },
    });
    return sendSuccess(res, { product }, 'Product created');
});
router.post('/marketplace/orders', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const { productId, buyerName, quantity = 1 } = req.body || {};
    const product = marketplaceProducts.find((item) => item.id === productId);
    if (!product) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const order = {
        id: makeMarketplaceId('ord'),
        productId,
        productTitle: product.title,
        buyerName: buyerName || '匿名用户',
        quantity: Number(quantity),
        totalPrice: Number((product.price * Number(quantity)).toFixed(2)),
        status: 'PAID',
        createdAt: new Date().toISOString(),
    };
    product.sales += order.quantity;
    marketplaceOrders.unshift(order);
    const updatedRating = Number(((product.rating * product.reviewCount + 5) / (product.reviewCount + 1)).toFixed(2));
    await prisma.marketplaceProduct.update({
        where: { id: product.id },
        data: {
            sales: product.sales,
            rating: updatedRating,
            review_count: product.reviewCount,
            updated_at: new Date(),
        },
    });
    await prisma.marketplaceOrder.create({
        data: {
            id: order.id,
            product_id: order.productId,
            buyer_name: order.buyerName,
            quantity: order.quantity,
            total_price: order.totalPrice,
            status: order.status,
            payment_status: 'PENDING',
            fulfillment_status: 'PENDING',
            buyer_id: req.user?.id,
            created_at: new Date(order.createdAt),
            updated_at: new Date(),
        },
    });
    const payment = await prisma.payment.create({
        data: {
            id: order.id,
            user_id: req.user?.id ?? 1,
            amount: Math.round(order.totalPrice * 100),
            currency: 'CNY',
            status: 'PENDING',
            plan_id: 'marketplace',
            payment_method: 'QIANFU',
            created_at: new Date(order.createdAt),
            updated_at: new Date(),
        },
    });
    await prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: { payment_id: payment.id },
    });
    return sendSuccess(res, { order, payment, downloadUrl: product.downloadUrl ?? null }, 'Order created');
});
router.patch('/marketplace/products/:id', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const productIndex = marketplaceProducts.findIndex((item) => item.id === req.params.id);
    if (productIndex === -1) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const current = marketplaceProducts[productIndex];
    if (current.creatorId !== req.user.id) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    const { title, category, description, price, author, coverUrl, downloadUrl } = req.body || {};
    const updated = {
        ...current,
        title: title ?? current.title,
        category: category ?? current.category,
        description: description ?? current.description,
        price: price !== undefined ? Number(price) : current.price,
        author: author ?? current.author,
        coverUrl: coverUrl ?? current.coverUrl,
        downloadUrl: downloadUrl ?? current.downloadUrl,
    };
    marketplaceProducts[productIndex] = updated;
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
            updated_at: new Date(),
        },
    });
    return sendSuccess(res, { product: updated }, 'Product updated');
});
router.post('/marketplace/products/:id/unpublish', authenticateOptional, async (req, res) => {
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
    marketplaceProducts.splice(productIndex, 1);
    await prisma.marketplaceProduct.delete({ where: { id: product.id } });
    return sendSuccess(res, { removed: true }, 'Product unpublished');
});
router.post('/marketplace/products/:id/favorite', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    const product = marketplaceProducts.find((item) => item.id === req.params.id);
    if (!product) {
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
router.post('/marketplace/products/:id/reviews', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const product = marketplaceProducts.find((item) => item.id === req.params.id);
    if (!product) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
    }
    const rating = Math.max(1, Math.min(5, Number(req.body?.rating || 5)));
    const review = {
        id: makeMarketplaceId('rev'),
        product_id: product.id,
        rating,
        content: req.body?.content ? String(req.body.content) : null,
        created_at: new Date(),
        updated_at: new Date(),
    };
    await prisma.marketplaceReview.create({ data: { ...review, user_id: req.user?.id } });
    const reviews = await prisma.marketplaceReview.findMany({ where: { product_id: product.id } });
    const average = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : 0;
    product.reviewCount = reviews.length;
    product.rating = Number(average.toFixed(2));
    await prisma.marketplaceProduct.update({
        where: { id: product.id },
        data: { review_count: product.reviewCount, rating: product.rating, updated_at: new Date() },
    });
    return sendSuccess(res, { review });
});
router.get('/marketplace/orders', async (_req, res) => {
    await loadMarketplace();
    return sendSuccess(res, { orders: marketplaceOrders, total: marketplaceOrders.length });
});
router.get('/marketplace/shop/config', authenticateOptional, async (req, res) => {
    const ownerId = marketplaceShopConfig.ownerId ?? null;
    marketplaceShopMetrics.visits += 1;
    marketplaceShopMetrics.updatedAt = new Date().toISOString();
    return sendSuccess(res, {
        config: marketplaceShopConfig,
        editable: !ownerId || req.user?.id === ownerId,
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
router.put('/marketplace/shop/config', authenticateOptional, async (req, res) => {
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    if (marketplaceShopConfig.ownerId && req.user.id !== marketplaceShopConfig.ownerId) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
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
router.post('/marketplace/shop/config/reset', authenticateOptional, async (req, res) => {
    if (!req.user) {
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }
    if (marketplaceShopConfig.ownerId && req.user.id !== marketplaceShopConfig.ownerId) {
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
    }
    marketplaceShopConfig = getDefaultMarketplaceShopConfig();
    marketplaceShopVersions.push(snapshotShopConfig(marketplaceShopConfig));
    marketplaceShopMetrics.updatedAt = new Date().toISOString();
    await saveJsonStorage(SHOP_CONFIG_STORAGE_KEY, marketplaceShopConfig);
    await saveJsonStorage(SHOP_VERSIONS_STORAGE_KEY, marketplaceShopVersions);
    await saveJsonStorage(SHOP_METRICS_STORAGE_KEY, marketplaceShopMetrics);
    return sendSuccess(res, { config: marketplaceShopConfig }, 'Shop config reset');
});
router.post('/marketplace/shop/theme/:theme', authenticateOptional, async (req, res) => {
    if (!req.user)
        return sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
    if (marketplaceShopConfig.ownerId && req.user.id !== marketplaceShopConfig.ownerId)
        return sendError(res, 'Forbidden', 403, 'FORBIDDEN');
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
router.get('/marketplace/orders/:id', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const order = marketplaceOrders.find((item) => item.id === req.params.id);
    if (!order) {
        return sendError(res, 'Order not found', 404, 'NOT_FOUND');
    }
    const product = marketplaceProducts.find((item) => item.id === order.productId);
    if (!product) {
        return sendError(res, 'Product not found', 404, 'NOT_FOUND');
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
            deliveryUrl: order.deliveryUrl || product.downloadUrl || null,
            logs: logs.map((log) => ({ at: log.created_at.toISOString(), status: log.status, note: log.note || '' })),
        },
        product: mapFavoriteIds(product, currentUserId),
        favorite: !!favorite,
    });
});
router.post('/marketplace/orders/:id/fulfill', authenticateOptional, async (req, res) => {
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
router.get('/marketplace/me/listings', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const currentUserId = req.user?.id;
    const listings = currentUserId ? marketplaceProducts.filter((item) => item.creatorId === currentUserId) : [];
    return sendSuccess(res, {
        products: listings,
        total: listings.length,
    });
});
router.get('/marketplace/favorites', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const currentUserId = req.user?.id;
    if (!currentUserId) {
        return sendSuccess(res, { products: [], total: 0 });
    }
    const favoriteIds = new Set((await prisma.marketplaceFavorite.findMany({ where: { user_id: currentUserId } })).map((fav) => fav.product_id));
    const products = marketplaceProducts.filter((item) => favoriteIds.has(item.id)).map((item) => mapFavoriteIds(item, currentUserId));
    return sendSuccess(res, { products, total: products.length });
});
router.get('/marketplace/me/orders', authenticateOptional, async (req, res) => {
    await loadMarketplace();
    const currentUserId = req.user?.id;
    const orders = currentUserId ? marketplaceOrders.filter((order) => {
        const product = marketplaceProducts.find((item) => item.id === order.productId);
        return product?.creatorId === currentUserId || order.buyerName === req.user?.username;
    }) : [];
    return sendSuccess(res, {
        orders,
        total: orders.length,
    });
});
router.get('/marketplace/rankings', async (_req, res) => {
    await loadMarketplace();
    const salesRanking = [...marketplaceProducts].sort((a, b) => b.sales - a.sales).slice(0, 10);
    const ratingRanking = [...marketplaceProducts].sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 10);
    const recommendationRanking = [...marketplaceProducts].sort((a, b) => (b.sales * 0.7 + b.rating * 20) - (a.sales * 0.7 + a.rating * 20)).slice(0, 10);
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