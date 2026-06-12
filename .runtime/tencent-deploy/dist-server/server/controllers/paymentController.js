import { sendSuccess, sendListResponse } from '../utils/response.js';
import { AppError, ErrorCode, handleError } from '../utils/errors.js';
import prisma from '../db.js';
import crypto from 'crypto';
import { eventService, EVENTS } from '../services/eventService.js';
import { logDataChange } from '../services/auditService.js';
import { paymentCreateSchema, manualPaymentSchema, payProNotifySchema, xpayNotifySchema, paymentQuerySchema, paymentCancelParamSchema, paymentStatusParamSchema, paymentStatsQuerySchema } from '../utils/validation.js';
import { generateTransactionSignature } from '../lib/wallet.js';
import { redisService } from '../services/redisService.js';
import { yuanToFen, fenToYuanNumber } from '../utils/currency.js';
import { buildDateRange, buildKeywordOrConditions, buildPagination, resolveSortField, resolveSortOrder, } from '../utils/queryBuilder.js';
import { logger } from '../utils/logger.js';
import { EXTERNAL_PAYMENT_METHODS, evaluatePaymentGuardrails, isExternalPaymentMethod, } from '../services/paymentGuardrails.js';
import { resolvePaymentCancelAction } from '../services/paymentCancelPolicy.js';
import { buildHupijiaoNotifyReplayKey, buildPayProNotifyReplayKey, buildTpayNotifyReplayKey, buildXpayNotifyReplayKey, extractRequestClientIp, isNotifyIpAllowed, resolveNotifyIpAllowlist, } from '../services/paymentCallbackSecurity.js';
import { assertSafeOutboundCallbackUrl } from '../core/task/callbackOutboundPolicy.js';
const XPAY_TOKEN = process.env.XPAY_TOKEN;
const XPAY_API_URL = process.env.XPAY_API_URL || 'http://localhost:8080/api/pay';
const XPAY_NOTIFY_URL = process.env.XPAY_NOTIFY_URL || 'http://localhost:3000/api/payment/xpay/notify';
const PAYPRO_ENABLED = String(process.env.PAYPRO_ENABLED || 'false').toLowerCase() === 'true';
const PAYPRO_API_URL = (process.env.PAYPRO_API_URL || '').replace(/\/+$/, '');
const PAYPRO_OPENAPI_SECRET = process.env.PAYPRO_OPENAPI_SECRET || '';
const PAYPRO_NOTIFY_URL = process.env.PAYPRO_NOTIFY_URL;
const PAYPRO_TIMEOUT_MS = Number.parseInt(process.env.PAYPRO_TIMEOUT_MS || '10000', 10);
const PAYPRO_DEV_MOCK_ENABLED = process.env.NODE_ENV !== 'production' &&
    String(process.env.PAYPRO_DEV_MOCK_ENABLED || 'false').toLowerCase() === 'true';
const PAYPRO_DEV_MOCK_MARK_COMPLETED = process.env.NODE_ENV !== 'production' &&
    String(process.env.PAYPRO_DEV_MOCK_MARK_COMPLETED || 'true').toLowerCase() === 'true';
const PAYPRO_DEV_MOCK_WECHAT_QR_URL = (process.env.PAYPRO_DEV_MOCK_WECHAT_QR_URL || '').trim();
const PAYPRO_DEV_MOCK_ALIPAY_QR_URL = (process.env.PAYPRO_DEV_MOCK_ALIPAY_QR_URL || '').trim();
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
const parseNonNegativeIntegerEnv = (envName, fallback) => {
    const raw = process.env[envName];
    if (!raw?.trim()) {
        return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        logger.warn(`[Payment] Invalid ${envName}=${raw}, fallback to ${fallback}`);
        return fallback;
    }
    return parsed;
};
const parseNonNegativeYuanLimitToFenEnv = (envName, fallbackFen) => {
    const raw = process.env[envName];
    if (!raw?.trim()) {
        return fallbackFen;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        logger.warn(`[Payment] Invalid ${envName}=${raw}, fallback to ${fenToYuanNumber(fallbackFen)}`);
        return fallbackFen;
    }
    return yuanToFen(parsed);
};
const PAYMENT_MAX_PENDING_ORDERS = parseNonNegativeIntegerEnv('PAYMENT_MAX_PENDING_ORDERS', 3);
const PAYMENT_DAILY_LIMIT_CNY_FEN = parseNonNegativeYuanLimitToFenEnv('PAYMENT_DAILY_LIMIT_CNY', 0);
const PAYMENT_DAILY_LIMIT_WECHAT_CNY_FEN = parseNonNegativeYuanLimitToFenEnv('PAYMENT_DAILY_LIMIT_WECHAT_CNY', 0);
const PAYMENT_DAILY_LIMIT_ALIPAY_CNY_FEN = parseNonNegativeYuanLimitToFenEnv('PAYMENT_DAILY_LIMIT_ALIPAY_CNY', 0);
const PAYMENT_NOTIFY_REPLAY_TTL_SECONDS = parseNonNegativeIntegerEnv('PAYMENT_NOTIFY_REPLAY_TTL_SECONDS', 600);
const XPAY_NOTIFY_IP_ALLOWLIST = resolveNotifyIpAllowlist(process.env.XPAY_NOTIFY_IP_ALLOWLIST, process.env.PAYMENT_NOTIFY_IP_ALLOWLIST);
const PAYPRO_NOTIFY_IP_ALLOWLIST = resolveNotifyIpAllowlist(process.env.PAYPRO_NOTIFY_IP_ALLOWLIST, process.env.PAYMENT_NOTIFY_IP_ALLOWLIST);
const TPAY_NOTIFY_IP_ALLOWLIST = resolveNotifyIpAllowlist(process.env.TPAY_NOTIFY_IP_ALLOWLIST, process.env.PAYMENT_NOTIFY_IP_ALLOWLIST);
const HUPIJIAO_NOTIFY_IP_ALLOWLIST = resolveNotifyIpAllowlist(process.env.HUPIJIAO_NOTIFY_IP_ALLOWLIST, process.env.PAYMENT_NOTIFY_IP_ALLOWLIST);
// Keep backend pricing aligned with the currently deployed frontend payment page.
const CANONICAL_PLAN_IDS = {
    'basic-monthly': 'basic-monthly',
    'pro-quarterly': 'pro-quarterly',
    'vip-yearly': 'vip-yearly',
    custom: 'custom',
    server_slot: 'server_slot',
    'premium-quarterly': 'pro-quarterly',
    'premium-yearly': 'vip-yearly',
};
// Prices stored in fen (yuan * 100) for precision.
const PLAN_PRICES_FEN = {
    'basic-monthly': 2000, // 20 yuan
    'pro-quarterly': 5500, // 55 yuan
    'vip-yearly': 20000, // 200 yuan
    server_slot: 500, // 5 yuan
};
const normalizePlanId = (planId) => {
    return CANONICAL_PLAN_IDS[planId] || planId;
};
const PAYMENT_PROJECT_CONFIG_PREFIX = 'payment_project:';
const DEFAULT_PAYMENT_PROJECT_KEY = process.env.DEFAULT_PAYMENT_PROJECT_KEY?.trim() || 'qianfu';
const sanitizeProjectKey = (raw) => {
    const value = (raw || '').trim().toLowerCase();
    if (!value) {
        return DEFAULT_PAYMENT_PROJECT_KEY;
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
        throw new AppError('Invalid project key', 400, ErrorCode.VALIDATION_ERROR);
    }
    return value;
};
const buildProjectScopedPaymentId = (projectKey) => {
    return `${projectKey}_${crypto.randomUUID()}`;
};
const parseProjectKeyFromPaymentId = (paymentId) => {
    const separatorIndex = paymentId.indexOf('_');
    if (separatorIndex <= 0) {
        return null;
    }
    return sanitizeProjectKey(paymentId.slice(0, separatorIndex));
};
const isSupportedUpstreamProvider = (value) => value === 'paypro' || value === 'xpay' || value === 'tpay' || value === 'hupijiao';
const parsePaymentProjectConfig = (projectKey, raw) => {
    if (!raw?.trim()) {
        throw new AppError(`Payment project config missing: ${projectKey}`, 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new AppError(`Payment project config is invalid JSON: ${projectKey}`, 500, ErrorCode.INTERNAL_ERROR);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AppError(`Payment project config must be an object: ${projectKey}`, 500, ErrorCode.INTERNAL_ERROR);
    }
    const record = parsed;
    const upstreamProvider = String(record.upstreamProvider || '').trim().toLowerCase();
    if (!isSupportedUpstreamProvider(upstreamProvider)) {
        throw new AppError(`Unsupported upstream provider for project ${projectKey}`, 500, ErrorCode.INTERNAL_ERROR);
    }
    const backupUpstreamProviderRaw = String(record.backupUpstreamProvider || '').trim().toLowerCase();
    const backupUpstreamProvider = backupUpstreamProviderRaw
        ? (isSupportedUpstreamProvider(backupUpstreamProviderRaw)
            ? backupUpstreamProviderRaw
            : (() => {
                throw new AppError(`Unsupported backup upstream provider for project ${projectKey}`, 500, ErrorCode.INTERNAL_ERROR);
            })())
        : undefined;
    const config = {
        key: sanitizeProjectKey(String(record.key || projectKey)),
        displayName: String(record.displayName || projectKey).trim() || projectKey,
        upstreamProvider,
        backupUpstreamProvider,
        downstreamNotifyUrl: String(record.downstreamNotifyUrl || '').trim() || undefined,
        downstreamNotifySecret: String(record.downstreamNotifySecret || '').trim() || undefined,
        payProApiUrl: String(record.payProApiUrl || '').trim() || undefined,
        payProOpenApiSecret: String(record.payProOpenApiSecret || '').trim() || undefined,
        payProNotifyUrl: String(record.payProNotifyUrl || '').trim() || undefined,
        xpayApiUrl: String(record.xpayApiUrl || '').trim() || undefined,
        xpayToken: String(record.xpayToken || '').trim() || undefined,
        xpayNotifyUrl: String(record.xpayNotifyUrl || '').trim() || undefined,
        xpayGatewayBaseUrl: String(record.xpayGatewayBaseUrl || '').trim() || undefined,
        xpayTenantKey: String(record.xpayTenantKey || '').trim() || undefined,
        tpayGatewayUrl: String(record.tpayGatewayUrl || '').trim() || undefined,
        tpayAppId: String(record.tpayAppId || '').trim() || undefined,
        tpayAppSecret: String(record.tpayAppSecret || '').trim() || undefined,
        tpayQueryUrl: String(record.tpayQueryUrl || '').trim() || undefined,
        hupijiaoGatewayUrl: String(record.hupijiaoGatewayUrl || '').trim() || undefined,
        hupijiaoBackupGatewayUrl: String(record.hupijiaoBackupGatewayUrl || '').trim() || undefined,
        hupijiaoAppId: String(record.hupijiaoAppId || '').trim() || undefined,
        hupijiaoAppSecret: String(record.hupijiaoAppSecret || '').trim() || undefined,
        hupijiaoNotifyUrl: String(record.hupijiaoNotifyUrl || '').trim() || undefined,
        hupijiaoReturnUrl: String(record.hupijiaoReturnUrl || '').trim() || undefined,
        hupijiaoPlugins: String(record.hupijiaoPlugins || '').trim() || undefined,
        hupijiaoVersion: String(record.hupijiaoVersion || '').trim() || undefined,
    };
    if (config.downstreamNotifyUrl) {
        assertSafeOutboundCallbackUrl(config.downstreamNotifyUrl);
    }
    return config;
};
const buildLegacyDefaultProjectConfig = () => ({
    key: DEFAULT_PAYMENT_PROJECT_KEY,
    displayName: 'QianFu',
    upstreamProvider: process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER?.trim().toLowerCase() === 'tpay'
        ? 'tpay'
        : process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER?.trim().toLowerCase() === 'hupijiao'
            ? 'hupijiao'
            : PAYPRO_ENABLED || PAYPRO_DEV_MOCK_ENABLED ? 'paypro' : 'xpay',
    payProApiUrl: PAYPRO_API_URL || undefined,
    payProOpenApiSecret: PAYPRO_OPENAPI_SECRET || undefined,
    payProNotifyUrl: PAYPRO_NOTIFY_URL?.trim() || undefined,
    xpayApiUrl: XPAY_API_URL || undefined,
    xpayToken: XPAY_TOKEN || undefined,
    xpayNotifyUrl: XPAY_NOTIFY_URL || undefined,
    tpayGatewayUrl: process.env.TPAY_GATEWAY_URL?.trim() || undefined,
    tpayAppId: process.env.TPAY_APP_ID?.trim() || undefined,
    tpayAppSecret: process.env.TPAY_APP_SECRET?.trim() || undefined,
    tpayQueryUrl: process.env.TPAY_QUERY_URL?.trim() || undefined,
    hupijiaoGatewayUrl: process.env.HUPIJIAO_GATEWAY_URL?.trim() || undefined,
    hupijiaoBackupGatewayUrl: process.env.HUPIJIAO_BACKUP_GATEWAY_URL?.trim() || undefined,
    hupijiaoAppId: process.env.HUPIJIAO_APP_ID?.trim() || undefined,
    hupijiaoAppSecret: process.env.HUPIJIAO_APP_SECRET?.trim() || undefined,
    hupijiaoNotifyUrl: process.env.HUPIJIAO_NOTIFY_URL?.trim() || undefined,
    hupijiaoReturnUrl: process.env.HUPIJIAO_RETURN_URL?.trim() || undefined,
    hupijiaoPlugins: process.env.HUPIJIAO_PLUGINS?.trim() || undefined,
    hupijiaoVersion: process.env.HUPIJIAO_VERSION?.trim() || undefined,
});
const getPaymentProjectConfig = async (projectKeyRaw) => {
    const projectKey = sanitizeProjectKey(projectKeyRaw);
    const stored = await prisma.systemConfig.findUnique({
        where: { key: `${PAYMENT_PROJECT_CONFIG_PREFIX}${projectKey}` },
    });
    if (stored?.value) {
        return parsePaymentProjectConfig(projectKey, stored.value);
    }
    if (projectKey === DEFAULT_PAYMENT_PROJECT_KEY) {
        return buildLegacyDefaultProjectConfig();
    }
    throw new AppError(`Payment project not found: ${projectKey}`, 404, ErrorCode.NOT_FOUND);
};
// NOTE: XPay's callback protocol currently defines an MD5 signature scheme.
// We keep this for compatibility with the upstream gateway and add strict freshness checks below.
const generateSignature = (params, token) => {
    const { money, mark, type, dt } = params;
    const str = `${type}${money}${mark}${dt}${token}`;
    return crypto.createHash('md5').update(str).digest('hex');
};
const normalizeAmountToFen = (raw) => {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return null;
    return yuanToFen(parsed);
};
const normalizePayProAmount = (raw) => {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return null;
    return parsed.toFixed(2);
};
const timingSafeEqualText = (left, right) => {
    const leftDigest = crypto.createHash('sha256').update(left).digest();
    const rightDigest = crypto.createHash('sha256').update(right).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
};
const generateDownstreamNotifySignature = (payload, secret) => {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};
const notifyDownstreamProject = async (payment, projectConfig) => {
    if (!projectConfig?.downstreamNotifyUrl) {
        return;
    }
    const body = JSON.stringify({
        event: 'payment.completed',
        projectKey: projectConfig.key,
        orderId: payment.id,
        userId: payment.user_id,
        amountFen: payment.amount,
        currency: payment.currency,
        planId: payment.plan_id,
        paymentMethod: payment.payment_method,
        status: payment.status,
        createdAt: payment.created_at.toISOString(),
        completedAt: payment.updated_at.toISOString(),
    });
    const headers = {
        'Content-Type': 'application/json',
        'X-QianFu-Project': projectConfig.key,
    };
    if (projectConfig.downstreamNotifySecret) {
        headers['X-QianFu-Signature'] = generateDownstreamNotifySignature(body, projectConfig.downstreamNotifySecret);
    }
    const response = await fetch(projectConfig.downstreamNotifyUrl, {
        method: 'POST',
        headers,
        body,
    });
    if (!response.ok) {
        throw new Error(`Downstream callback failed with HTTP ${response.status}`);
    }
};
const resolveTodayWindow = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};
const ensurePaymentGuardrails = async (userId, amountFen, paymentMethod) => {
    if (!isExternalPaymentMethod(paymentMethod)) {
        return;
    }
    const { start, end } = resolveTodayWindow();
    const [pendingCount, todayUsage, methodUsage] = await Promise.all([
        prisma.payment.count({
            where: {
                user_id: userId,
                status: 'PENDING',
                payment_method: { in: EXTERNAL_PAYMENT_METHODS },
            },
        }),
        prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
                user_id: userId,
                status: 'COMPLETED',
                currency: 'CNY',
                payment_method: { in: EXTERNAL_PAYMENT_METHODS },
                created_at: { gte: start, lt: end },
            },
        }),
        prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
                user_id: userId,
                status: 'COMPLETED',
                currency: 'CNY',
                payment_method: paymentMethod,
                created_at: { gte: start, lt: end },
            },
        }),
    ]);
    const violation = evaluatePaymentGuardrails({
        maxPendingOrders: PAYMENT_MAX_PENDING_ORDERS,
        dailyLimitFen: PAYMENT_DAILY_LIMIT_CNY_FEN,
        dailyWechatLimitFen: PAYMENT_DAILY_LIMIT_WECHAT_CNY_FEN,
        dailyAlipayLimitFen: PAYMENT_DAILY_LIMIT_ALIPAY_CNY_FEN,
    }, {
        paymentMethod,
        amountFen,
    }, {
        pendingExternalOrders: pendingCount,
        dailyExternalUsedFen: todayUsage._sum.amount ?? 0,
        dailyMethodUsedFen: methodUsage._sum.amount ?? 0,
    });
    if (!violation) {
        return;
    }
    if (violation.type === 'MAX_PENDING_ORDERS') {
        throw new AppError(`Too many pending payment orders (max ${PAYMENT_MAX_PENDING_ORDERS})`, 429, ErrorCode.LIMIT_EXCEEDED, true, violation.details);
    }
    if (violation.type === 'DAILY_TOTAL_LIMIT') {
        throw new AppError('Daily payment limit exceeded', 429, ErrorCode.LIMIT_EXCEEDED, true, violation.details);
    }
    throw new AppError(`Daily ${paymentMethod} payment limit exceeded`, 429, ErrorCode.LIMIT_EXCEEDED, true, violation.details);
};
const buildPayProNotifyUrl = (req, projectConfig) => {
    if (projectConfig.payProNotifyUrl?.trim()) {
        return projectConfig.payProNotifyUrl.trim();
    }
    if (PAYPRO_NOTIFY_URL?.trim()) {
        return PAYPRO_NOTIFY_URL.trim();
    }
    const host = req.get('host');
    if (!host) {
        return 'http://localhost:3000/api/v1/payment/paypro/notify';
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0].trim()
        : req.protocol;
    return `${protocol}://${host}/api/v1/payment/paypro/notify`;
};
const buildPayProMockPaymentUrl = (req, paymentId, amount, paymentMethod) => {
    const customUrl = paymentMethod === 'wechat'
        ? PAYPRO_DEV_MOCK_WECHAT_QR_URL
        : PAYPRO_DEV_MOCK_ALIPAY_QR_URL;
    if (customUrl) {
        return customUrl;
    }
    const origin = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:4123';
    const mockUrl = new URL('/mock-pay-qr.html', origin);
    mockUrl.searchParams.set('orderId', paymentId);
    mockUrl.searchParams.set('amount', amount.toFixed(2));
    mockUrl.searchParams.set('method', paymentMethod);
    return mockUrl.toString();
};
const createPayProMockResult = (req, payment, amount, paymentMethod) => ({
    paymentUrl: buildPayProMockPaymentUrl(req, payment.id, amount, paymentMethod),
    payNum: `mock-${payment.id}`,
    provider: 'paypro-mock',
});
const generatePayProSignature = (params, secret) => {
    const segments = Object.keys(params)
        .sort()
        .filter((key) => key !== 'sign')
        .map((key) => {
        const value = params[key];
        if (value === undefined || value === null)
            return '';
        const normalized = String(value).trim();
        if (!normalized)
            return '';
        return `${key}=${normalized}`;
    })
        .filter(Boolean);
    const signBase = [...segments, `key=${secret}`].join('&');
    return crypto.createHash('md5').update(signBase).digest('hex').toUpperCase();
};
const createPayProPayment = async (req, payment, projectConfig, amount, paymentMethod) => {
    if (PAYPRO_DEV_MOCK_ENABLED) {
        logger.warn('[Payment] PayPro DEV mock mode enabled, returning mock QR payment URL', {
            paymentId: payment.id,
            paymentMethod,
        });
        return createPayProMockResult(req, payment, amount, paymentMethod);
    }
    if (!PAYPRO_ENABLED && projectConfig.upstreamProvider !== 'paypro') {
        throw new AppError('PayPro payment channel is disabled', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const payProApiUrl = projectConfig.payProApiUrl || PAYPRO_API_URL;
    const payProSecret = projectConfig.payProOpenApiSecret || PAYPRO_OPENAPI_SECRET;
    if (!payProApiUrl || !payProSecret) {
        throw new AppError('PayPro payment channel is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const timestamp = Date.now();
    const amountText = amount.toFixed(2);
    const payloadForSign = {
        orderNo: payment.id,
        amount: amountText,
        payType: paymentMethod,
        timestamp,
        notifyUrl: buildPayProNotifyUrl(req, projectConfig),
        description: `${projectConfig.displayName} ${payment.plan_id} order`,
        userId: String(req.user?.id || ''),
        nickName: req.user?.username || '',
        email: req.user?.email || '',
    };
    const sign = generatePayProSignature(payloadForSign, payProSecret);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(PAYPRO_TIMEOUT_MS, 3000));
    try {
        const response = await fetch(`${payProApiUrl}/api/openapi/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...payloadForSign,
                amount: Number(amountText),
                sign,
            }),
            signal: controller.signal,
        });
        let parsed;
        try {
            parsed = await response.json();
        }
        catch {
            throw new AppError('PayPro response is invalid', 502, ErrorCode.SERVICE_UNAVAILABLE);
        }
        const success = String(parsed.code) === '200';
        if (!response.ok || !success) {
            const msg = parsed.msg || `HTTP ${response.status}`;
            throw new AppError(`PayPro create order failed: ${msg}`, 502, ErrorCode.PAYMENT_FAILED);
        }
        const paymentUrl = parsed.data?.returnUrl || parsed.data?.qrCodeUrl;
        if (!paymentUrl) {
            throw new AppError('PayPro did not return a payment URL', 502, ErrorCode.PAYMENT_FAILED);
        }
        return {
            paymentUrl,
            payNum: parsed.data?.payNum,
            provider: 'paypro',
        };
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            throw new AppError('PayPro request timeout', 504, ErrorCode.GATEWAY_TIMEOUT);
        }
        if (error instanceof AppError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : 'unknown upstream error';
        throw new AppError(`PayPro request failed: ${message}`, 502, ErrorCode.PAYMENT_FAILED);
    }
    finally {
        clearTimeout(timeout);
    }
};
const generateUppercaseMd5 = (payload) => crypto.createHash('md5').update(payload).digest('hex').toUpperCase();
const generateLowercaseMd5 = (payload) => crypto.createHash('md5').update(payload).digest('hex').toLowerCase();
const generateTpaySignature = (params, secret) => {
    const signBase = `order_no=${params.orderNo}` +
        `&subject=${params.subject}` +
        `&pay_type=${params.payType}` +
        `&money=${params.money}` +
        `&app_id=${params.appId}` +
        `&extra=${params.extra}` +
        `&${secret}`;
    return generateUppercaseMd5(signBase);
};
const mapTpayPayType = (paymentMethod) => paymentMethod === 'alipay' ? '43' : '44';
const createTpayPayment = async (payment, projectConfig, amount, paymentMethod) => {
    const gatewayUrl = (projectConfig.tpayGatewayUrl || process.env.TPAY_GATEWAY_URL || 'https://gateway.xddpay.com').replace(/\/+$/, '');
    const appId = projectConfig.tpayAppId || process.env.TPAY_APP_ID || '';
    const appSecret = projectConfig.tpayAppSecret || process.env.TPAY_APP_SECRET || '';
    if (!appId || !appSecret) {
        throw new AppError('Tpay payment channel is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const subject = `${projectConfig.displayName} ${payment.plan_id} order`;
    const extra = payment.id;
    const money = amount.toFixed(2);
    const payType = mapTpayPayType(paymentMethod);
    const sign = generateTpaySignature({
        orderNo: payment.id,
        subject,
        payType,
        money,
        appId,
        extra,
    }, appSecret);
    const body = new URLSearchParams({
        order_no: payment.id,
        subject,
        pay_type: payType,
        money,
        app_id: appId,
        extra,
        sign,
    });
    const response = await fetch(`${gatewayUrl}?format=json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    let parsed;
    try {
        parsed = await response.json();
    }
    catch {
        throw new AppError('Tpay response is invalid', 502, ErrorCode.SERVICE_UNAVAILABLE);
    }
    if (!response.ok || !parsed.qr) {
        throw new AppError(`Tpay create order failed: ${parsed.msg || `HTTP ${response.status}`}`, 502, ErrorCode.PAYMENT_FAILED);
    }
    return {
        paymentUrl: parsed.qr,
        provider: 'tpay',
        upstreamOrderId: parsed.xddpay_order,
        qrImagePath: parsed.qr_img || undefined,
    };
};
const generateHupijiaoSignature = (params, secret) => {
    const signBase = Object.keys(params)
        .sort()
        .map((key) => [key, params[key]])
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        .map(([key, value]) => `${key}=${String(value).trim()}`)
        .join('&');
    return generateLowercaseMd5(`${signBase}&${secret}`);
};
const buildHupijiaoNotifyUrl = (req, projectConfig) => {
    if (projectConfig.hupijiaoNotifyUrl?.trim()) {
        return projectConfig.hupijiaoNotifyUrl.trim();
    }
    const host = req.get('host');
    if (!host) {
        return 'http://localhost:3001/api/v1/payment/hupijiao/notify';
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0].trim()
        : req.protocol;
    return `${protocol}://${host}/api/v1/payment/hupijiao/notify`;
};
const buildHupijiaoReturnUrl = (req, paymentId, projectConfig) => {
    if (projectConfig.hupijiaoReturnUrl?.trim()) {
        return projectConfig.hupijiaoReturnUrl.trim();
    }
    const base = process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:4123';
    return `${base.replace(/\/+$/, '')}/#/payment-success?orderId=${encodeURIComponent(paymentId)}`;
};
const verifyHupijiaoResponse = (payload, secret) => {
    if (!payload.hash) {
        return true;
    }
    const signSource = {};
    for (const [key, value] of Object.entries(payload)) {
        if (key === 'hash' || value === undefined || value === null)
            continue;
        signSource[key] = String(value);
    }
    const expected = generateHupijiaoSignature(signSource, secret);
    return timingSafeEqualText(String(payload.hash).toLowerCase(), expected.toLowerCase());
};
const createHupijiaoPaymentAgainstGateway = async (req, payment, projectConfig, amount, gatewayUrl) => {
    const appId = projectConfig.hupijiaoAppId || process.env.HUPIJIAO_APP_ID || '';
    const appSecret = projectConfig.hupijiaoAppSecret || process.env.HUPIJIAO_APP_SECRET || '';
    if (!appId || !appSecret) {
        throw new AppError('HuPiJiao payment channel is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(8).toString('hex');
    const signSource = {
        version: projectConfig.hupijiaoVersion || process.env.HUPIJIAO_VERSION || '1.1',
        appid: appId,
        trade_order_id: payment.id,
        total_fee: amount.toFixed(2),
        title: `${projectConfig.displayName} ${payment.plan_id} order`,
        time: timestamp,
        notify_url: buildHupijiaoNotifyUrl(req, projectConfig),
        return_url: buildHupijiaoReturnUrl(req, payment.id, projectConfig),
        callback_url: buildHupijiaoReturnUrl(req, payment.id, projectConfig),
        plugins: projectConfig.hupijiaoPlugins || process.env.HUPIJIAO_PLUGINS || 'alipay',
        nonce_str: nonce,
        attach: payment.id,
    };
    const hash = generateHupijiaoSignature(signSource, appSecret);
    const body = new URLSearchParams({
        ...signSource,
        hash,
    });
    const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    let parsed;
    try {
        parsed = await response.json();
    }
    catch {
        throw new AppError('HuPiJiao response is invalid', 502, ErrorCode.SERVICE_UNAVAILABLE);
    }
    if (!verifyHupijiaoResponse(parsed, appSecret)) {
        throw new AppError('HuPiJiao response signature mismatch', 502, ErrorCode.PAYMENT_FAILED);
    }
    if (!response.ok || String(parsed.errcode) !== '0' || !parsed.url) {
        throw new AppError(`HuPiJiao create order failed: ${parsed.errmsg || `HTTP ${response.status}`}`, 502, ErrorCode.PAYMENT_FAILED);
    }
    return {
        paymentUrl: parsed.url,
        provider: 'hupijiao',
        qrImagePath: parsed.url_qrcode || undefined,
        upstreamOrderId: parsed.trade_order_id,
    };
};
const createHupijiaoPayment = async (req, payment, projectConfig, amount) => {
    const primaryGateway = projectConfig.hupijiaoGatewayUrl || process.env.HUPIJIAO_GATEWAY_URL || 'https://api.xunhupay.com/payment/do.html';
    const backupGateway = projectConfig.hupijiaoBackupGatewayUrl || process.env.HUPIJIAO_BACKUP_GATEWAY_URL || '';
    try {
        return await createHupijiaoPaymentAgainstGateway(req, payment, projectConfig, amount, primaryGateway);
    }
    catch (error) {
        if (!backupGateway || backupGateway === primaryGateway) {
            throw error;
        }
        logger.warn('[Payment] HuPiJiao primary gateway failed, retrying backup gateway', {
            paymentId: payment.id,
            primaryGateway,
            backupGateway,
            error: error instanceof Error ? error.message : String(error),
        });
        return createHupijiaoPaymentAgainstGateway(req, payment, projectConfig, amount, backupGateway);
    }
};
const buildAbsoluteUrl = (baseUrl, pathOrUrl) => {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    const base = baseUrl.replace(/\/+$/, '');
    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${base}${path}`;
};
const createXpayTenantPayment = async (payment, projectConfig, amount, paymentMethod) => {
    const xpayBaseUrl = projectConfig.xpayGatewayBaseUrl?.replace(/\/+$/, '');
    const xpayTenantKey = projectConfig.xpayTenantKey?.trim();
    const xpayToken = projectConfig.xpayToken || XPAY_TOKEN;
    if (!xpayBaseUrl || !xpayTenantKey || !xpayToken) {
        throw new AppError('XPay tenant channel is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const response = await fetch(`${xpayBaseUrl}/open/tenants/${encodeURIComponent(xpayTenantKey)}/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${xpayToken}`,
        },
        body: JSON.stringify({
            orderId: payment.id,
            outOrderId: payment.id,
            payType: paymentMethod,
            amount: amount.toFixed(2),
            subject: `${projectConfig.displayName} ${payment.plan_id} order`,
            body: `QianFu payment ${payment.id}`,
            metadata: {
                projectKey: projectConfig.key,
                paymentId: payment.id,
                planId: payment.plan_id,
            },
        }),
    });
    let parsed;
    try {
        parsed = await response.json();
    }
    catch {
        throw new AppError('XPay tenant response is invalid', 502, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const payload = parsed.data || parsed.result;
    const code = parsed.code === undefined ? undefined : String(parsed.code);
    const ok = response.ok && (parsed.success === true || code === '200' || code === '0' || payload);
    if (!ok || !payload?.orderId) {
        throw new AppError(`XPay tenant create order failed: ${parsed.message || `HTTP ${response.status}`}`, 502, ErrorCode.PAYMENT_FAILED);
    }
    return {
        paymentUrl: buildAbsoluteUrl(xpayBaseUrl, payload.payUrl || `/open/tenants/${xpayTenantKey}/orders/${payment.id}/pay`),
        provider: 'xpay-tenant',
        tenantKey: xpayTenantKey,
        upstreamOrderId: payload.orderId,
        qrImagePath: payload.paymentMethod?.qrImagePath
            ? buildAbsoluteUrl(xpayBaseUrl, payload.paymentMethod.qrImagePath)
            : undefined,
        paymentQrContent: payload.paymentQrContent || undefined,
    };
};
const createLegacyXpayPayment = (payment, projectConfig, amount, paymentMethod) => {
    const xpayToken = projectConfig.xpayToken || XPAY_TOKEN;
    const xpayApiUrl = projectConfig.xpayApiUrl || XPAY_API_URL;
    const xpayNotifyUrl = projectConfig.xpayNotifyUrl || XPAY_NOTIFY_URL;
    if (!xpayToken || !xpayApiUrl || !xpayNotifyUrl) {
        throw new AppError('Payment service unavailable', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const dt = Date.now().toString();
    const mark = payment.id;
    const sign = generateSignature({ money: amount.toFixed(2), mark, type: paymentMethod, dt }, xpayToken);
    return {
        provider: 'xpay',
        paymentUrl: `${xpayApiUrl}?type=${paymentMethod}&money=${amount.toFixed(2)}&mark=${mark}&dt=${dt}&sign=${sign}&notify_url=${encodeURIComponent(xpayNotifyUrl)}`,
    };
};
const createExternalPaymentByProvider = async (req, payment, projectConfig, amount, paymentMethod, provider) => {
    if (provider === 'paypro') {
        return createPayProPayment(req, payment, projectConfig, amount, paymentMethod);
    }
    if (provider === 'tpay') {
        return createTpayPayment(payment, projectConfig, amount, paymentMethod);
    }
    if (provider === 'hupijiao') {
        return createHupijiaoPayment(req, payment, projectConfig, amount);
    }
    return projectConfig.xpayGatewayBaseUrl && projectConfig.xpayTenantKey
        ? createXpayTenantPayment(payment, projectConfig, amount, paymentMethod)
        : createLegacyXpayPayment(payment, projectConfig, amount, paymentMethod);
};
/**
 * Development-only fast-path completion for PayPro mock mode.
 * Avoids cross-connection audit writes inside SQLite transactions.
 */
const completeDevMockPayment = async (paymentId) => {
    await redisService.withLock(`payment:${paymentId}`, async () => {
        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.status === 'COMPLETED') {
            return;
        }
        const updatedPayment = await prisma.$transaction(async (tx) => {
            const paymentRecord = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'COMPLETED',
                    updated_at: new Date(),
                },
            });
            if (paymentRecord.plan_id === 'custom') {
                let wallet = await tx.wallet.findUnique({
                    where: { user_id: paymentRecord.user_id },
                });
                if (!wallet) {
                    wallet = await tx.wallet.create({
                        data: {
                            user_id: paymentRecord.user_id,
                            balance: 0,
                            currency: 'CNY',
                            is_active: true,
                        },
                    });
                }
                const updatedWallet = await tx.wallet.update({
                    where: { user_id: paymentRecord.user_id },
                    data: { balance: { increment: paymentRecord.amount } },
                });
                const transaction = await tx.transaction.create({
                    data: {
                        wallet_id: wallet.id,
                        amount: paymentRecord.amount,
                        type: 'DEPOSIT',
                        status: 'COMPLETED',
                        description: `Recharge: ${paymentRecord.plan_id}`,
                        metadata: JSON.stringify({
                            paymentId: paymentRecord.id,
                            method: paymentRecord.payment_method,
                            callbackSource: 'paypro-dev-mock',
                        }),
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
                logger.info('[Payment] DEV mock wallet recharge completed', {
                    paymentId: paymentRecord.id,
                    walletId: updatedWallet.id,
                    amountFen: paymentRecord.amount,
                });
            }
            return paymentRecord;
        });
        eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);
    });
};
const completeExternalPayment = async (req, paymentId, options = {}) => {
    return redisService.withLock(`payment:${paymentId}`, async () => {
        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) {
            return 'NOT_FOUND';
        }
        if (typeof options.expectedAmountFen === 'number' && options.expectedAmountFen !== payment.amount) {
            return 'AMOUNT_MISMATCH';
        }
        if (payment.status === 'COMPLETED') {
            return 'ALREADY_COMPLETED';
        }
        const updatedPayment = await prisma.$transaction(async (tx) => {
            const beforePayment = await tx.payment.findUnique({ where: { id: paymentId } });
            const paymentRecord = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'COMPLETED',
                    updated_at: new Date(),
                },
            });
            if (paymentRecord.plan_id === 'custom') {
                const wallet = await tx.wallet.findUnique({
                    where: { user_id: paymentRecord.user_id },
                });
                if (wallet) {
                    const beforeWallet = { ...wallet };
                    const updatedWallet = await tx.wallet.update({
                        where: { user_id: paymentRecord.user_id },
                        data: { balance: { increment: paymentRecord.amount } },
                    });
                    const transaction = await tx.transaction.create({
                        data: {
                            wallet_id: wallet.id,
                            amount: paymentRecord.amount,
                            type: 'DEPOSIT',
                            status: 'COMPLETED',
                            description: `Recharge: ${paymentRecord.plan_id}`,
                            metadata: JSON.stringify({
                                paymentId: paymentRecord.id,
                                method: paymentRecord.payment_method,
                                ...(options.metadata || {}),
                            }),
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
                    await logDataChange(paymentRecord.user_id, 'WALLET_DEPOSIT', `wallet_${wallet.id}`, req, beforeWallet, updatedWallet);
                }
            }
            await logDataChange(paymentRecord.user_id, 'PAYMENT_COMPLETED', `payment_${paymentRecord.id}`, req, beforePayment, paymentRecord);
            return paymentRecord;
        });
        eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);
        if (options.projectConfig) {
            await notifyDownstreamProject(updatedPayment, options.projectConfig);
        }
        return 'COMPLETED';
    });
};
export const createPayment = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const idempotencyKeyHeader = req.header('Idempotency-Key') || req.header('idempotency-key');
        const idempotencyKey = idempotencyKeyHeader ? idempotencyKeyHeader.trim() : '';
        const idempotencyCacheKey = idempotencyKey ? `idempotency:payment:create:${userId}:${idempotencyKey}` : '';
        if (idempotencyCacheKey) {
            const cached = await redisService.get(idempotencyCacheKey);
            if (cached && cached.ok) {
                return sendSuccess(res, cached.data, cached.message);
            }
        }
        const execute = async () => {
            const validation = paymentCreateSchema.safeParse(req.body);
            if (!validation.success) {
                throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
                    issues: validation.error.issues,
                });
            }
            const { amount, planId, projectKey, provider, paymentMethod, currency = 'CNY' } = validation.data;
            const normalizedPlanId = normalizePlanId(planId);
            const projectConfig = await getPaymentProjectConfig(projectKey);
            // Convert yuan to fen for storage
            const amountFen = yuanToFen(amount);
            if (normalizedPlanId !== 'custom') {
                const expectedPriceFen = PLAN_PRICES_FEN[normalizedPlanId];
                if (expectedPriceFen === undefined) {
                    throw new AppError(`Invalid plan ID: ${planId}`, 400, ErrorCode.VALIDATION_ERROR);
                }
                if (amountFen !== expectedPriceFen) {
                    throw new AppError(`Invalid amount for ${normalizedPlanId}. Expected ${expectedPriceFen / 100} yuan, got ${amount}`, 400, ErrorCode.VALIDATION_ERROR);
                }
            }
            else if (amount < 0.1) {
                throw new AppError('Minimum recharge amount is 0.1', 400, ErrorCode.VALIDATION_ERROR);
            }
            await ensurePaymentGuardrails(userId, amountFen, paymentMethod);
            const payment = await prisma.payment.create({
                data: {
                    id: buildProjectScopedPaymentId(projectConfig.key),
                    user_id: userId,
                    amount: amountFen, // Store as fen
                    plan_id: normalizedPlanId,
                    payment_method: paymentMethod,
                    currency,
                    status: 'PENDING',
                },
            });
            if (paymentMethod === 'balance') {
                try {
                    const updatedPayment = await prisma.$transaction(async (tx) => {
                        const wallet = await tx.wallet.findUniqueOrThrow({
                            where: { user_id: userId },
                        });
                        if (wallet.balance < amountFen) {
                            throw new AppError('Insufficient balance', 400, ErrorCode.INSUFFICIENT_FUNDS);
                        }
                        const updateResult = await tx.wallet.updateMany({
                            where: {
                                id: wallet.id,
                                balance: { gte: amountFen }
                            },
                            data: {
                                balance: { decrement: amountFen },
                            },
                        });
                        if (updateResult.count === 0) {
                            throw new AppError('Insufficient balance', 400, ErrorCode.INSUFFICIENT_FUNDS);
                        }
                        const transaction = await tx.transaction.create({
                            data: {
                                wallet_id: wallet.id,
                                amount: -amountFen, // Negative fen for deduction
                                type: 'PAYMENT',
                                status: 'COMPLETED',
                                description: `Plan: ${normalizedPlanId}`,
                                metadata: JSON.stringify({ paymentId: payment.id })
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
                            data: { signature }
                        });
                        const finalPayment = await tx.payment.update({
                            where: { id: payment.id },
                            data: {
                                status: 'COMPLETED',
                                updated_at: new Date()
                            }
                        });
                        return finalPayment;
                    });
                    await logDataChange(userId, 'PAYMENT_COMPLETED_BALANCE', `payment_${payment.id}`, req, payment, updatedPayment);
                    eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);
                    const responseData = {
                        success: true,
                        paymentId: payment.id,
                        orderId: payment.id,
                        id: payment.id,
                        status: 'COMPLETED',
                    };
                    if (idempotencyCacheKey) {
                        await redisService.set(idempotencyCacheKey, { ok: true, data: responseData, message: 'Payment successful' }, IDEMPOTENCY_TTL_SECONDS);
                    }
                    return sendSuccess(res, responseData, 'Payment successful');
                }
                catch (error) {
                    await prisma.payment.update({
                        where: { id: payment.id },
                        data: {
                            status: 'FAILED',
                            updated_at: new Date()
                        }
                    });
                    throw error;
                }
            }
            const xpayType = paymentMethod === 'wechat' ? 'wechat' : 'alipay';
            let responseData;
            try {
                const providersToTry = [];
                const pushProvider = (candidate) => {
                    if (candidate && !providersToTry.includes(candidate)) {
                        providersToTry.push(candidate);
                    }
                };
                pushProvider(provider);
                pushProvider(projectConfig.upstreamProvider);
                pushProvider(projectConfig.backupUpstreamProvider);
                let externalResult = null;
                let lastCreateError = null;
                for (const provider of providersToTry) {
                    try {
                        externalResult = await createExternalPaymentByProvider(req, payment, projectConfig, amount, xpayType, provider);
                        break;
                    }
                    catch (error) {
                        lastCreateError = error;
                        logger.warn('[Payment] external provider create order failed', {
                            paymentId: payment.id,
                            provider,
                            projectKey: projectConfig.key,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
                if (!externalResult) {
                    throw lastCreateError instanceof Error
                        ? lastCreateError
                        : new AppError('No payment provider available', 503, ErrorCode.SERVICE_UNAVAILABLE);
                }
                if (externalResult.provider === 'paypro-mock' && PAYPRO_DEV_MOCK_MARK_COMPLETED) {
                    await completeDevMockPayment(payment.id);
                }
                responseData = {
                    success: true,
                    paymentId: payment.id,
                    orderId: payment.id,
                    id: payment.id,
                    provider: externalResult.provider,
                    paymentUrl: externalResult.paymentUrl,
                    payNum: 'payNum' in externalResult ? externalResult.payNum : undefined,
                    tenantKey: 'tenantKey' in externalResult ? externalResult.tenantKey : undefined,
                    upstreamOrderId: 'upstreamOrderId' in externalResult ? externalResult.upstreamOrderId : undefined,
                    qrImagePath: 'qrImagePath' in externalResult ? externalResult.qrImagePath : undefined,
                    paymentQrContent: 'paymentQrContent' in externalResult ? externalResult.paymentQrContent : undefined,
                };
            }
            catch (error) {
                await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: 'FAILED',
                        updated_at: new Date(),
                    },
                });
                throw error;
            }
            if (idempotencyCacheKey) {
                await redisService.set(idempotencyCacheKey, { ok: true, data: responseData, message: 'Success' }, IDEMPOTENCY_TTL_SECONDS);
            }
            return sendSuccess(res, responseData, 'Success');
        };
        if (idempotencyCacheKey) {
            const lockKey = `idempotency:lock:payment:create:${userId}:${idempotencyKey}`;
            return await redisService.withLock(lockKey, execute, 30);
        }
        return await execute();
    }
    catch (error) {
        next(handleError(error));
    }
};
export const xpayNotify = async (req, res) => {
    let replayKey = null;
    try {
        const clientIp = extractRequestClientIp(req);
        if (!isNotifyIpAllowed(clientIp, XPAY_NOTIFY_IP_ALLOWLIST)) {
            logger.warn('[Payment] xpayNotify rejected by IP allowlist', {
                clientIp,
                allowlistSize: XPAY_NOTIFY_IP_ALLOWLIST.size,
            });
            return res.send('fail');
        }
        const validation = xpayNotifySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).send('fail');
        }
        const { type, money, mark, dt, sign } = validation.data;
        const timestamp = Number(dt);
        if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
            return res.send('fail');
        }
        const projectKey = parseProjectKeyFromPaymentId(mark);
        const projectConfig = await getPaymentProjectConfig(projectKey || DEFAULT_PAYMENT_PROJECT_KEY);
        const xpayToken = projectConfig.xpayToken || XPAY_TOKEN;
        if (!xpayToken) {
            logger.error('[Payment] xpayNotify rejected: project XPAY token is not configured', {
                projectKey: projectConfig.key,
            });
            return res.send('fail');
        }
        const expectedSign = generateSignature({ money, mark, type, dt }, xpayToken);
        if (!timingSafeEqualText(String(sign).trim().toLowerCase(), expectedSign.toLowerCase())) {
            return res.send('fail');
        }
        const expectedAmountFen = normalizeAmountToFen(money);
        if (expectedAmountFen === null) {
            return res.send('fail');
        }
        if (PAYMENT_NOTIFY_REPLAY_TTL_SECONDS > 0) {
            replayKey = buildXpayNotifyReplayKey({
                mark,
                dt,
                money,
                sign: String(sign),
            });
            const accepted = await redisService.setIfNotExists(replayKey, { source: 'xpay', mark, dt, money }, PAYMENT_NOTIFY_REPLAY_TTL_SECONDS);
            if (!accepted) {
                logger.warn('[Payment] xpayNotify replay callback ignored', {
                    mark,
                    replayKey,
                });
                return res.send('success');
            }
        }
        const result = await completeExternalPayment(req, mark, {
            expectedAmountFen,
            metadata: {
                callbackSource: 'xpay',
                type,
                dt,
            },
            projectConfig,
        });
        if (result === 'NOT_FOUND' || result === 'AMOUNT_MISMATCH') {
            if (replayKey) {
                await redisService.del(replayKey).catch(() => undefined);
            }
            return res.send('fail');
        }
        return res.send('success');
    }
    catch (error) {
        if (replayKey) {
            await redisService.del(replayKey).catch(() => undefined);
        }
        logger.error('[Payment] xpayNotify error:', error);
        res.status(500).send('error');
    }
};
export const payProNotify = async (req, res) => {
    let replayKey = null;
    try {
        const clientIp = extractRequestClientIp(req);
        if (!isNotifyIpAllowed(clientIp, PAYPRO_NOTIFY_IP_ALLOWLIST)) {
            logger.warn('[Payment] payProNotify rejected by IP allowlist', {
                clientIp,
                allowlistSize: PAYPRO_NOTIFY_IP_ALLOWLIST.size,
            });
            return res.send('fail');
        }
        const validation = payProNotifySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).send('fail');
        }
        const { orderNo, amount, payNum, sign } = validation.data;
        const projectKey = parseProjectKeyFromPaymentId(orderNo);
        const projectConfig = await getPaymentProjectConfig(projectKey || DEFAULT_PAYMENT_PROJECT_KEY);
        const payProSecret = projectConfig.payProOpenApiSecret || PAYPRO_OPENAPI_SECRET;
        if (!payProSecret) {
            logger.error('[Payment] payProNotify rejected: project PayPro secret is not configured', {
                projectKey: projectConfig.key,
            });
            return res.send('fail');
        }
        const normalizedAmount = normalizePayProAmount(amount);
        if (!normalizedAmount) {
            return res.send('fail');
        }
        const expectedSign = generatePayProSignature({
            orderNo,
            amount: normalizedAmount,
            payNum,
        }, payProSecret);
        if (!timingSafeEqualText(String(sign).trim().toUpperCase(), expectedSign.toUpperCase())) {
            return res.send('fail');
        }
        const expectedAmountFen = normalizeAmountToFen(normalizedAmount);
        if (expectedAmountFen === null) {
            return res.send('fail');
        }
        if (PAYMENT_NOTIFY_REPLAY_TTL_SECONDS > 0) {
            replayKey = buildPayProNotifyReplayKey({
                orderNo,
                payNum,
                amount: normalizedAmount,
                sign: String(sign),
            });
            const accepted = await redisService.setIfNotExists(replayKey, { source: 'paypro', orderNo, payNum, amount: normalizedAmount }, PAYMENT_NOTIFY_REPLAY_TTL_SECONDS);
            if (!accepted) {
                logger.warn('[Payment] payProNotify replay callback ignored', {
                    orderNo,
                    replayKey,
                });
                return res.send('success');
            }
        }
        const result = await completeExternalPayment(req, orderNo, {
            expectedAmountFen,
            metadata: {
                callbackSource: 'paypro',
                payNum,
            },
            projectConfig,
        });
        if (result === 'NOT_FOUND' || result === 'AMOUNT_MISMATCH') {
            if (replayKey) {
                await redisService.del(replayKey).catch(() => undefined);
            }
            return res.send('fail');
        }
        return res.send('success');
    }
    catch (error) {
        if (replayKey) {
            await redisService.del(replayKey).catch(() => undefined);
        }
        logger.error('[Payment] payProNotify error:', error);
        return res.status(500).send('error');
    }
};
export const tpayNotify = async (req, res) => {
    let replayKey = null;
    try {
        const clientIp = extractRequestClientIp(req);
        if (!isNotifyIpAllowed(clientIp, TPAY_NOTIFY_IP_ALLOWLIST)) {
            logger.warn('[Payment] tpayNotify rejected by IP allowlist', {
                clientIp,
                allowlistSize: TPAY_NOTIFY_IP_ALLOWLIST.size,
            });
            return res.send('fail');
        }
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const orderNo = String(body.order_no || '').trim();
        const projectKey = parseProjectKeyFromPaymentId(orderNo);
        const projectConfig = await getPaymentProjectConfig(projectKey || DEFAULT_PAYMENT_PROJECT_KEY);
        const tpayAppId = projectConfig.tpayAppId || process.env.TPAY_APP_ID || '';
        const tpaySecret = projectConfig.tpayAppSecret || process.env.TPAY_APP_SECRET || '';
        if (!tpayAppId || !tpaySecret) {
            logger.error('[Payment] tpayNotify rejected: Tpay config missing', {
                projectKey: projectConfig.key,
            });
            return res.send('fail');
        }
        const subject = String(body.subject || '').trim();
        const payType = String(body.pay_type || '').trim();
        const money = normalizePayProAmount(body.money);
        const realmoney = body.realmoney == null ? '' : String(body.realmoney).trim();
        const result = String(body.result || '').trim().toLowerCase();
        const xddpayOrder = String(body.xddpay_order || '').trim();
        const appId = String(body.app_id || '').trim();
        const extra = String(body.extra || '').trim();
        const sign = String(body.sign || '').trim();
        if (!orderNo || !payType || !money || !xddpayOrder || !sign || appId !== tpayAppId || result !== 'success') {
            return res.send('fail');
        }
        const expectedSign = generateTpaySignature({
            orderNo,
            subject,
            payType,
            money,
            appId,
            extra,
        }, tpaySecret);
        if (!timingSafeEqualText(sign.toUpperCase(), expectedSign.toUpperCase())) {
            return res.send('fail');
        }
        const expectedAmountFen = normalizeAmountToFen(money);
        if (expectedAmountFen === null) {
            return res.send('fail');
        }
        if (PAYMENT_NOTIFY_REPLAY_TTL_SECONDS > 0) {
            replayKey = buildTpayNotifyReplayKey({
                orderNo,
                xddpayOrder,
                money,
                result,
                sign,
            });
            const accepted = await redisService.setIfNotExists(replayKey, { source: 'tpay', orderNo, xddpayOrder, money, result }, PAYMENT_NOTIFY_REPLAY_TTL_SECONDS);
            if (!accepted) {
                logger.warn('[Payment] tpayNotify replay callback ignored', {
                    orderNo,
                    replayKey,
                });
                return res.send('success');
            }
        }
        const completeResult = await completeExternalPayment(req, orderNo, {
            expectedAmountFen,
            metadata: {
                callbackSource: 'tpay',
                xddpayOrder,
                payType,
                realmoney,
                extra,
            },
            projectConfig,
        });
        if (completeResult === 'NOT_FOUND' || completeResult === 'AMOUNT_MISMATCH') {
            if (replayKey) {
                await redisService.del(replayKey).catch(() => undefined);
            }
            return res.send('fail');
        }
        return res.send('success');
    }
    catch (error) {
        if (replayKey) {
            await redisService.del(replayKey).catch(() => undefined);
        }
        logger.error('[Payment] tpayNotify error:', error);
        return res.status(500).send('error');
    }
};
export const hupijiaoNotify = async (req, res) => {
    let replayKey = null;
    try {
        const clientIp = extractRequestClientIp(req);
        if (!isNotifyIpAllowed(clientIp, HUPIJIAO_NOTIFY_IP_ALLOWLIST)) {
            logger.warn('[Payment] hupijiaoNotify rejected by IP allowlist', {
                clientIp,
                allowlistSize: HUPIJIAO_NOTIFY_IP_ALLOWLIST.size,
            });
            return res.send('fail');
        }
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const tradeOrderId = String(body.trade_order_id || '').trim();
        const projectKey = parseProjectKeyFromPaymentId(tradeOrderId);
        const projectConfig = await getPaymentProjectConfig(projectKey || DEFAULT_PAYMENT_PROJECT_KEY);
        const appId = projectConfig.hupijiaoAppId || process.env.HUPIJIAO_APP_ID || '';
        const appSecret = projectConfig.hupijiaoAppSecret || process.env.HUPIJIAO_APP_SECRET || '';
        if (!appId || !appSecret) {
            logger.error('[Payment] hupijiaoNotify rejected: HuPiJiao config missing', {
                projectKey: projectConfig.key,
            });
            return res.send('fail');
        }
        const totalFee = normalizePayProAmount(body.total_fee);
        const transactionId = String(body.transaction_id || '').trim();
        const openOrderId = String(body.open_order_id || '').trim();
        const orderTitle = String(body.order_title || '').trim();
        const status = String(body.status || '').trim().toUpperCase();
        const plugins = String(body.plugins || '').trim();
        const attach = String(body.attach || '').trim();
        const callbackAppId = String(body.appid || '').trim();
        const time = String(body.time || '').trim();
        const nonceStr = String(body.nonce_str || '').trim();
        const hash = String(body.hash || '').trim();
        if (!tradeOrderId || !totalFee || !transactionId || !hash || callbackAppId !== appId || status !== 'OD') {
            return res.send('fail');
        }
        const signSource = {
            trade_order_id: tradeOrderId,
            total_fee: totalFee,
            transaction_id: transactionId,
            open_order_id: openOrderId,
            order_title: orderTitle,
            status,
            plugins,
            attach,
            appid: callbackAppId,
            time,
            nonce_str: nonceStr,
        };
        const expectedHash = generateHupijiaoSignature(signSource, appSecret);
        if (!timingSafeEqualText(hash.toLowerCase(), expectedHash.toLowerCase())) {
            return res.send('fail');
        }
        const expectedAmountFen = normalizeAmountToFen(totalFee);
        if (expectedAmountFen === null) {
            return res.send('fail');
        }
        if (PAYMENT_NOTIFY_REPLAY_TTL_SECONDS > 0) {
            replayKey = buildHupijiaoNotifyReplayKey({
                tradeOrderId,
                transactionId,
                totalFee,
                status,
                hash,
            });
            const accepted = await redisService.setIfNotExists(replayKey, { source: 'hupijiao', tradeOrderId, transactionId, totalFee, status }, PAYMENT_NOTIFY_REPLAY_TTL_SECONDS);
            if (!accepted) {
                logger.warn('[Payment] hupijiaoNotify replay callback ignored', {
                    tradeOrderId,
                    replayKey,
                });
                return res.send('success');
            }
        }
        const completeResult = await completeExternalPayment(req, tradeOrderId, {
            expectedAmountFen,
            metadata: {
                callbackSource: 'hupijiao',
                transactionId,
                openOrderId,
                orderTitle,
                plugins,
                attach,
            },
            projectConfig,
        });
        if (completeResult === 'NOT_FOUND' || completeResult === 'AMOUNT_MISMATCH') {
            if (replayKey) {
                await redisService.del(replayKey).catch(() => undefined);
            }
            return res.send('fail');
        }
        return res.send('success');
    }
    catch (error) {
        if (replayKey) {
            await redisService.del(replayKey).catch(() => undefined);
        }
        logger.error('[Payment] hupijiaoNotify error:', error);
        return res.status(500).send('error');
    }
};
export const getPaymentStatus = async (req, res, next) => {
    try {
        const validation = paymentStatusParamSchema.safeParse(req.params);
        if (!validation.success) {
            throw new AppError('Invalid payment ID', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: validation.error.issues,
            });
        }
        const { orderId } = validation.data;
        const userId = req.user.id;
        const payment = await prisma.payment.findFirst({
            where: { id: orderId, user_id: userId }
        });
        if (!payment) {
            throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
        }
        return sendSuccess(res, {
            status: payment.status,
            orderId: payment.id
        });
    }
    catch (error) {
        next(handleError(error));
    }
};
export const cancelPayment = async (req, res, next) => {
    try {
        const validation = paymentCancelParamSchema.safeParse(req.params);
        if (!validation.success) {
            throw new AppError('Invalid payment ID', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: validation.error.issues,
            });
        }
        const userId = req.user.id;
        const { orderId } = validation.data;
        const result = await redisService.withLock(`payment:${orderId}`, async () => {
            const payment = await prisma.payment.findFirst({
                where: { id: orderId, user_id: userId },
            });
            if (!payment) {
                throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
            }
            const cancelAction = resolvePaymentCancelAction(payment.status);
            if (cancelAction === 'ALREADY_COMPLETED') {
                throw new AppError('Completed payment cannot be cancelled', 409, ErrorCode.INVALID_OPERATION);
            }
            if (cancelAction === 'ALREADY_PROCESSED') {
                return {
                    paymentId: payment.id,
                    orderId: payment.id,
                    status: payment.status,
                    cancelled: false,
                };
            }
            const updatedPayment = await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'FAILED',
                    updated_at: new Date(),
                },
            });
            await logDataChange(userId, 'PAYMENT_CANCELLED', `payment_${payment.id}`, req, payment, updatedPayment);
            return {
                paymentId: updatedPayment.id,
                orderId: updatedPayment.id,
                status: updatedPayment.status,
                cancelled: true,
            };
        });
        return sendSuccess(res, result, result.cancelled ? 'Pending payment cancelled' : 'Order already processed');
    }
    catch (error) {
        next(handleError(error));
    }
};
export const getUserPayments = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const validation = paymentQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, {
                issues: validation.error.issues,
            });
        }
        const { page, limit, status, planId, search, fuzzy, sortBy, sortOrder, startDate, endDate } = validation.data;
        const { skip, take } = buildPagination({ page, limit });
        const where = { user_id: userId };
        if (status)
            where.status = status;
        if (planId)
            where.plan_id = planId;
        if (search) {
            where.OR = [
                ...buildKeywordOrConditions(['id', 'plan_id', 'payment_method', 'status'], search, fuzzy),
            ];
        }
        const range = buildDateRange({ startDate, endDate });
        if (range) {
            where.created_at = range;
        }
        const normalizedSortField = resolveSortField(sortBy, ['created_at', 'updated_at', 'amount', 'status'], 'created_at');
        const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');
        const [payments, totalCount] = await Promise.all([
            prisma.payment.findMany({
                where,
                orderBy: { [normalizedSortField]: normalizedSortOrder },
                skip,
                take
            }),
            prisma.payment.count({
                where
            })
        ]);
        // Convert amounts from fen to yuan for API response
        const paymentsWithFormattedAmounts = payments.map(p => ({
            ...p,
            amount: fenToYuanNumber(p.amount)
        }));
        return sendListResponse(res, paymentsWithFormattedAmounts, totalCount, page, limit, { resource: 'Payment' });
    }
    catch (error) {
        next(error);
    }
};
/**
 * Get all payments (Admin only)
 */
export const getAllPayments = async (req, res, next) => {
    try {
        const validation = paymentQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { page, limit, status, planId, userId, search, fuzzy, sortBy, sortOrder, startDate, endDate } = validation.data;
        const { skip, take } = buildPagination({ page, limit });
        const where = {};
        if (status)
            where.status = status;
        if (planId)
            where.plan_id = planId;
        if (userId)
            where.user_id = userId;
        if (search) {
            where.OR = [
                ...buildKeywordOrConditions(['id', 'plan_id', 'payment_method', 'status'], search, fuzzy),
            ];
        }
        const range = buildDateRange({ startDate, endDate });
        if (range) {
            where.created_at = range;
        }
        const normalizedSortField = resolveSortField(sortBy, ['created_at', 'updated_at', 'amount', 'status'], 'created_at');
        const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');
        const [payments, totalCount] = await Promise.all([
            prisma.payment.findMany({
                where,
                orderBy: { [normalizedSortField]: normalizedSortOrder },
                skip,
                take,
                include: {
                    user: {
                        select: { id: true, username: true, email: true }
                    }
                }
            }),
            prisma.payment.count({ where })
        ]);
        // Convert amounts from fen to yuan for API response
        const paymentsWithFormattedAmounts = payments.map(p => ({
            ...p,
            amount: fenToYuanNumber(p.amount)
        }));
        return sendListResponse(res, paymentsWithFormattedAmounts, totalCount, page, limit, { resource: 'Payment' });
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * Manually complete a payment (Admin only)
 */
export const manualCompletePayment = async (req, res, next) => {
    try {
        const validation = manualPaymentSchema.safeParse(req.body);
        if (!validation.success) {
            throw new AppError('Validation Error', 400, ErrorCode.VALIDATION_ERROR, true, {
                issues: validation.error.issues,
            });
        }
        const { orderId } = validation.data;
        await redisService.withLock(`payment:${orderId}`, async () => {
            const payment = await prisma.payment.findUnique({ where: { id: orderId } });
            if (!payment)
                throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
            if (payment.status === 'COMPLETED')
                return; // Already completed, handled by withLock return value if needed
            const updatedPayment = await prisma.$transaction(async (tx) => {
                const beforePayment = await tx.payment.findUnique({ where: { id: orderId } });
                // Re-check status inside transaction for absolute safety
                if (beforePayment?.status === 'COMPLETED')
                    return beforePayment;
                const paymentRecord = await tx.payment.update({
                    where: { id: orderId },
                    data: { status: 'COMPLETED', updated_at: new Date() }
                });
                // Only add to balance if it's a custom recharge plan
                if (paymentRecord.plan_id === 'custom') {
                    const wallet = await tx.wallet.findUnique({
                        where: { user_id: paymentRecord.user_id }
                    });
                    if (wallet) {
                        const beforeWallet = { ...wallet };
                        const updatedWallet = await tx.wallet.update({
                            where: { user_id: paymentRecord.user_id },
                            data: { balance: { increment: paymentRecord.amount } }
                        });
                        const transaction = await tx.transaction.create({
                            data: {
                                wallet_id: wallet.id,
                                amount: paymentRecord.amount,
                                type: 'DEPOSIT',
                                status: 'COMPLETED',
                                description: `Manual Recharge: ${paymentRecord.plan_id}`,
                                metadata: JSON.stringify({ admin_id: req.user.id, method: 'MANUAL' })
                            }
                        });
                        // Generate Signature
                        const signature = generateTransactionSignature({
                            id: transaction.id,
                            walletId: transaction.wallet_id,
                            amount: transaction.amount,
                            type: transaction.type,
                            status: transaction.status,
                            createdAt: transaction.created_at,
                        });
                        // Save Signature
                        await tx.transaction.update({
                            where: { id: transaction.id },
                            data: { signature }
                        });
                        await logDataChange(paymentRecord.user_id, 'WALLET_DEPOSIT_MANUAL', `wallet_${wallet.id}`, req, beforeWallet, updatedWallet);
                    }
                }
                await logDataChange(req.user.id, 'PAYMENT_COMPLETED_MANUAL', `payment_${paymentRecord.id}`, req, beforePayment, paymentRecord);
                return paymentRecord;
            });
            if (updatedPayment) {
                eventService.emitEvent(EVENTS.PAYMENT_SUCCESS, updatedPayment);
            }
        });
        return sendSuccess(res, { message: 'Order completed or already handled' }, 'Order processed');
    }
    catch (error) {
        next(handleError(error));
    }
};
/**
 * Get payment statistics (Admin only)
 */
export const getPaymentStats = async (req, res, next) => {
    try {
        const validation = paymentStatsQuerySchema.safeParse(req.query);
        if (!validation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, validation.error.issues);
        }
        const { days } = validation.data;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const payments = await prisma.payment.findMany({
            where: { created_at: { gte: startDate } },
            orderBy: { created_at: 'asc' }
        });
        const stats = {};
        for (let i = 0; i <= days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayKey = d.toISOString().split('T')[0];
            stats[dayKey] = { total: 0, completed: 0, failed: 0, amount: 0 };
        }
        payments.forEach(p => {
            const dayKey = p.created_at.toISOString().split('T')[0];
            if (stats[dayKey]) {
                stats[dayKey].total++;
                if (p.status === 'COMPLETED') {
                    stats[dayKey].completed++;
                    stats[dayKey].amount += p.amount; // p.amount is in fen, accumulate in fen
                }
                else if (p.status === 'FAILED' || p.status === 'EXPIRED') {
                    stats[dayKey].failed++;
                }
            }
        });
        const sortedStats = Object.entries(stats)
            .map(([date, data]) => ({
            date,
            total: data.total,
            completed: data.completed,
            failed: data.failed,
            amount: fenToYuanNumber(data.amount) // Convert total fen to yuan for display
        }))
            .sort((a, b) => a.date.localeCompare(b.date));
        return sendSuccess(res, sortedStats);
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=paymentController.js.map