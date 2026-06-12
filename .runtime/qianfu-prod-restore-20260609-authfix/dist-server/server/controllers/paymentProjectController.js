import prisma from '../db.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { assertSafeOutboundCallbackUrl } from '../core/task/callbackOutboundPolicy.js';
import { yuanToFen, fenToYuanNumber } from '../utils/currency.js';
import { PLAN_PRICES_FEN, buildProjectScopedPaymentId, completeExternalPayment, createExternalPaymentByProvider, getPaymentProjectConfig, normalizePlanId, parseProjectKeyFromPaymentId, } from './paymentController.js';
const PAYMENT_PROJECT_CONFIG_PREFIX = 'payment_project:';
const SUPPORTED_UPSTREAM_PROVIDER_ORDER = ['creem', 'qiupay', 'xpay', 'tpay', 'hupijiao', 'paypro'];
const SUPPORTED_UPSTREAM_PROVIDERS = new Set(SUPPORTED_UPSTREAM_PROVIDER_ORDER);
const DEFAULT_PAYMENT_PROJECT_KEY = process.env.DEFAULT_PAYMENT_PROJECT_KEY?.trim() || 'qianfu';
const DEFAULT_PAYMENT_UPSTREAM_PROVIDER = process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER?.trim().toLowerCase() || 'xpay';
const DEFAULT_PAYMENT_BACKUP_PROVIDER = process.env.DEFAULT_PAYMENT_BACKUP_PROVIDER?.trim().toLowerCase() || '';
const XPAY_ADMIN_BASE_URL = process.env.XPAY_ADMIN_BASE_URL?.trim() || '';
const XPAY_BOOTSTRAP_USERNAME = process.env.XPAY_SUPERADMIN_BOOTSTRAP_USERNAME?.trim() || '';
const XPAY_BOOTSTRAP_PASSWORD = process.env.XPAY_SUPERADMIN_BOOTSTRAP_PASSWORD?.trim() || '';
const XPAY_QR_UPLOAD_LIMIT_BYTES = Number.parseInt(process.env.XPAY_QR_UPLOAD_LIMIT_BYTES || String(3 * 1024 * 1024), 10);
const hasText = (value) => String(value || '').trim().length > 0;
const extractXpayEnvelopePayload = (payload) => payload.result ?? payload.data;
const resolveXpayAdminBaseUrl = (config) => {
    const candidates = [
        XPAY_ADMIN_BASE_URL,
        String(config.xpayGatewayBaseUrl || '').trim(),
        process.env.XPAY_PUBLIC_URL?.trim() || '',
        process.env.XPAY_GATEWAY_BASE_URL?.trim() || '',
        'http://127.0.0.1:8889',
    ];
    const first = candidates.find((item) => item && item.trim().length > 0);
    return String(first || 'http://127.0.0.1:8889').replace(/\/+$/, '');
};
const resolveXpayPublicBaseUrl = (config, fallbackHost) => {
    const candidates = [
        String(config.xpayGatewayBaseUrl || '').trim(),
        process.env.XPAY_PUBLIC_URL?.trim() || '',
        process.env.XPAY_GATEWAY_BASE_URL?.trim() || '',
        fallbackHost ? `${fallbackHost.replace(/\/+$/, '')}/xpay` : '',
    ];
    const first = candidates.find((item) => item && item.trim().length > 0);
    return String(first || 'http://127.0.0.1:8889').replace(/\/+$/, '');
};
const buildTenantCallbackUrl = (req) => {
    const host = req.get('host');
    if (!host) {
        return 'http://127.0.0.1:3001/api/v1/payment/xpay/tenant-notify';
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0].trim()
        : req.protocol;
    return `${protocol}://${host}/api/v1/payment/xpay/tenant-notify`;
};
const buildTenantPayload = (projectKey, displayName, callbackUrl, payTypes) => ({
    tenantKey: projectKey,
    displayName,
    callbackUrl,
    paymentMethods: payTypes.map((payType) => ({
        payType,
        displayName: payType === 'alipay'
            ? '支付宝'
            : payType === 'wechat'
                ? '微信'
                : payType === 'qqpay'
                    ? 'QQ'
                    : payType === 'unipay'
                        ? '银联'
                        : payType,
        enabled: true,
    })),
});
const loginXpayAdmin = async (baseUrl) => {
    if (!XPAY_BOOTSTRAP_USERNAME || !XPAY_BOOTSTRAP_PASSWORD) {
        throw new AppError('XPay bootstrap admin credentials are missing', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const loginResponse = await fetch(`${baseUrl}/admin/auth/local/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: XPAY_BOOTSTRAP_USERNAME,
            password: XPAY_BOOTSTRAP_PASSWORD,
        }),
    });
    const loginPayload = await loginResponse.json().catch(() => null);
    const loginResult = loginPayload ? extractXpayEnvelopePayload(loginPayload) : undefined;
    const token = loginResult?.token;
    if (!loginResponse.ok || !token) {
        throw new AppError(`XPay admin login failed: ${loginPayload?.message || loginPayload?.msg || `HTTP ${loginResponse.status}`}`, 502, ErrorCode.SERVICE_UNAVAILABLE);
    }
    let profile = null;
    const profileResponse = await fetch(`${baseUrl}/admin/auth/check`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    const profilePayload = await profileResponse.json().catch(() => null);
    if (profileResponse.ok) {
        profile = profilePayload ? (extractXpayEnvelopePayload(profilePayload) || null) : null;
    }
    return { token, profile };
};
const xpayAdminJson = async (baseUrl, token, path, init) => {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
            ...(init?.headers || {}),
            Authorization: `Bearer ${token}`,
        },
    });
    const payload = await response.json().catch(() => null);
    const result = payload ? extractXpayEnvelopePayload(payload) : undefined;
    if (!response.ok) {
        throw new AppError(`XPay admin request failed: ${payload?.message || payload?.msg || `HTTP ${response.status}`}`, response.status >= 400 && response.status < 600 ? response.status : 502, ErrorCode.SERVICE_UNAVAILABLE);
    }
    return (result ?? payload);
};
const findXpayTenant = async (baseUrl, token, tenantKey) => {
    const tenants = await xpayAdminJson(baseUrl, token, '/admin/tenants');
    return (tenants || []).find((item) => item?.tenantKey === tenantKey) || null;
};
const validateProviderConfig = (config, provider, label) => {
    const prefix = label === 'primary' ? '' : 'Backup provider ';
    if (provider === 'paypro') {
        if (!hasText(config.payProApiUrl) || !hasText(config.payProOpenApiSecret)) {
            throw new AppError(`${prefix}PayPro requires payProApiUrl and payProOpenApiSecret`, 400, ErrorCode.VALIDATION_ERROR);
        }
        return;
    }
    if (provider === 'xpay') {
        const tenantGatewayFieldsPresent = hasText(config.xpayGatewayBaseUrl) || hasText(config.xpayTenantKey);
        const tenantGatewayReady = hasText(config.xpayGatewayBaseUrl) &&
            hasText(config.xpayTenantKey) &&
            hasText(config.xpayToken) &&
            hasText(config.xpayTenantCallbackSecret);
        const legacyReady = hasText(config.xpayApiUrl) && hasText(config.xpayToken) && hasText(config.xpayNotifyUrl);
        if (tenantGatewayFieldsPresent && !tenantGatewayReady) {
            throw new AppError(`${prefix}XPay tenant gateway requires xpayGatewayBaseUrl + xpayTenantKey + xpayToken + xpayTenantCallbackSecret`, 400, ErrorCode.VALIDATION_ERROR);
        }
        if (!tenantGatewayReady && !legacyReady) {
            throw new AppError(`${prefix}XPay requires either tenant gateway fields (xpayGatewayBaseUrl + xpayTenantKey + xpayToken + xpayTenantCallbackSecret) or legacy fields (xpayApiUrl + xpayToken + xpayNotifyUrl)`, 400, ErrorCode.VALIDATION_ERROR);
        }
        return;
    }
    if (provider === 'tpay') {
        if (!hasText(config.tpayGatewayUrl) || !hasText(config.tpayAppId) || !hasText(config.tpayAppSecret)) {
            throw new AppError(`${prefix}Tpay requires tpayGatewayUrl, tpayAppId and tpayAppSecret`, 400, ErrorCode.VALIDATION_ERROR);
        }
        return;
    }
    if (provider === 'hupijiao') {
        if (!hasText(config.hupijiaoGatewayUrl) || !hasText(config.hupijiaoAppId) || !hasText(config.hupijiaoAppSecret)) {
            throw new AppError(`${prefix}HuPiJiao requires hupijiaoGatewayUrl, hupijiaoAppId and hupijiaoAppSecret`, 400, ErrorCode.VALIDATION_ERROR);
        }
        return;
    }
    if (provider === 'creem') {
        if (!hasText(config.creemApiKey) || !hasText(config.creemWebhookSecret) || !hasText(config.creemProductId)) {
            throw new AppError(`${prefix}Creem requires creemApiKey, creemWebhookSecret and creemProductId`, 400, ErrorCode.VALIDATION_ERROR);
        }
        return;
    }
    if (provider === 'qiupay') {
        if (!hasText(config.qiupayBaseUrl) || !hasText(config.qiupayPid) || !hasText(config.qiupayKey)) {
            throw new AppError(`${prefix}QiuPay requires qiupayBaseUrl, qiupayPid and qiupayKey`, 400, ErrorCode.VALIDATION_ERROR);
        }
    }
};
const resolveXpayMode = (config) => {
    if (hasText(config.xpayGatewayBaseUrl) && hasText(config.xpayTenantKey) && hasText(config.xpayToken)) {
        return 'tenant-gateway';
    }
    if (hasText(config.xpayApiUrl) && hasText(config.xpayToken) && hasText(config.xpayNotifyUrl)) {
        return 'legacy';
    }
    return 'none';
};
const buildProviderReadiness = (config) => {
    const xpayMode = resolveXpayMode(config);
    return {
        paypro: hasText(config.payProApiUrl) && hasText(config.payProOpenApiSecret),
        xpay: xpayMode === 'tenant-gateway'
            ? hasText(config.xpayTenantCallbackSecret)
            : xpayMode === 'legacy',
        xpayMode,
        tpay: hasText(config.tpayGatewayUrl) && hasText(config.tpayAppId) && hasText(config.tpayAppSecret),
        hupijiao: hasText(config.hupijiaoGatewayUrl) && hasText(config.hupijiaoAppId) && hasText(config.hupijiaoAppSecret),
        creem: hasText(config.creemApiKey) && hasText(config.creemWebhookSecret) && hasText(config.creemProductId),
        qiupay: hasText(config.qiupayBaseUrl) && hasText(config.qiupayPid) && hasText(config.qiupayKey),
    };
};
const buildProjectStatus = (config) => {
    const readiness = buildProviderReadiness(config);
    const primaryProvider = String(config.upstreamProvider || '').trim().toLowerCase();
    const backupProvider = String(config.backupUpstreamProvider || '').trim().toLowerCase();
    const readinessMap = {
        paypro: readiness.paypro,
        xpay: readiness.xpay,
        tpay: readiness.tpay,
        hupijiao: readiness.hupijiao,
        creem: readiness.creem,
        qiupay: readiness.qiupay,
    };
    return {
        primaryProvider,
        backupProvider: backupProvider || null,
        primaryReady: Boolean(readinessMap[primaryProvider]),
        backupReady: backupProvider ? Boolean(readinessMap[backupProvider]) : null,
        downstreamReady: hasText(config.downstreamNotifyUrl),
        personalBridgeReady: hasText(config.personalQrListenerSecret) || hasText(config.bridgeNotifySecret),
        tenantCallbackReady: hasText(config.xpayTenantCallbackSecret),
        xpayMode: readiness.xpayMode,
        providerReadiness: readinessMap,
    };
};
const buildGlobalStatus = () => ({
    supportedProviders: [...SUPPORTED_UPSTREAM_PROVIDER_ORDER],
    defaults: {
        projectKey: DEFAULT_PAYMENT_PROJECT_KEY,
        upstreamProvider: DEFAULT_PAYMENT_UPSTREAM_PROVIDER,
        backupUpstreamProvider: DEFAULT_PAYMENT_BACKUP_PROVIDER || null,
    },
    paypro: {
        configured: hasText(process.env.PAYPRO_API_URL) && hasText(process.env.PAYPRO_OPENAPI_SECRET),
        notifyUrl: process.env.PAYPRO_NOTIFY_URL || null,
    },
    xpay: {
        tenantGatewayConfigured: hasText(process.env.XPAY_GATEWAY_BASE_URL) && hasText(process.env.XPAY_TENANT_KEY) && hasText(process.env.XPAY_TOKEN),
        legacyConfigured: hasText(process.env.XPAY_API_URL) && hasText(process.env.XPAY_TOKEN) && hasText(process.env.XPAY_NOTIFY_URL),
        officialAlipayEnabled: String(process.env.XPAY_PROVIDER_ALIPAY_ENABLED || 'false').toLowerCase() === 'true',
        officialWechatEnabled: String(process.env.XPAY_PROVIDER_WECHAT_ENABLED || 'false').toLowerCase() === 'true',
        officialAlipayVerifyEnabled: String(process.env.XPAY_PROVIDER_ALIPAY_VERIFY_ENABLED || 'false').toLowerCase() === 'true',
        officialWechatVerifyEnabled: String(process.env.XPAY_PROVIDER_WECHAT_VERIFY_ENABLED || 'false').toLowerCase() === 'true',
    },
    tpay: {
        configured: hasText(process.env.TPAY_GATEWAY_URL) && hasText(process.env.TPAY_APP_ID) && hasText(process.env.TPAY_APP_SECRET),
        queryConfigured: hasText(process.env.TPAY_QUERY_URL),
    },
    hupijiao: {
        configured: hasText(process.env.HUPIJIAO_GATEWAY_URL) && hasText(process.env.HUPIJIAO_APP_ID) && hasText(process.env.HUPIJIAO_APP_SECRET),
        backupGatewayConfigured: hasText(process.env.HUPIJIAO_BACKUP_GATEWAY_URL),
        notifyConfigured: hasText(process.env.HUPIJIAO_NOTIFY_URL),
    },
    creem: {
        configured: hasText(process.env.CREEM_API_KEY) && hasText(process.env.CREEM_WEBHOOK_SECRET) && hasText(process.env.CREEM_PRODUCT_ID),
        apiBaseUrl: process.env.CREEM_API_BASE_URL || null,
        returnUrl: process.env.CREEM_RETURN_URL || null,
    },
    qiupay: {
        configured: hasText(process.env.QIUPAY_BASE_URL) && hasText(process.env.QIUPAY_PID) && hasText(process.env.QIUPAY_KEY),
        notifyUrl: process.env.QIUPAY_NOTIFY_URL || null,
        returnUrl: process.env.QIUPAY_RETURN_URL || null,
    },
});
const normalizeProjectKey = (raw) => {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) {
        throw new AppError('Project key is required', 400, ErrorCode.VALIDATION_ERROR);
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
        throw new AppError('Invalid project key', 400, ErrorCode.VALIDATION_ERROR);
    }
    return value;
};
const parseConfig = (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Project config must be an object');
    }
    const config = parsed;
    const downstreamNotifyUrl = String(config.downstreamNotifyUrl || '').trim();
    if (downstreamNotifyUrl) {
        assertSafeOutboundCallbackUrl(downstreamNotifyUrl);
    }
    return config;
};
export const listPaymentProjects = async (_req, res, next) => {
    try {
        const configs = await prisma.systemConfig.findMany({
            where: { key: { startsWith: PAYMENT_PROJECT_CONFIG_PREFIX } },
            orderBy: { key: 'asc' },
        });
        const projects = configs.map((item) => {
            try {
                return {
                    key: item.key.replace(PAYMENT_PROJECT_CONFIG_PREFIX, ''),
                    config: item.value ? parseConfig(item.value) : null,
                    status: item.value ? buildProjectStatus(parseConfig(item.value)) : null,
                    isSecret: item.is_secret,
                    description: item.description,
                    updatedAt: item.updated_at,
                };
            }
            catch (error) {
                return {
                    key: item.key.replace(PAYMENT_PROJECT_CONFIG_PREFIX, ''),
                    config: null,
                    status: null,
                    isSecret: item.is_secret,
                    description: item.description,
                    updatedAt: item.updated_at,
                    error: error instanceof Error ? error.message : 'Invalid config',
                };
            }
        });
        return sendSuccess(res, {
            projects,
            globalStatus: buildGlobalStatus(),
        });
    }
    catch (error) {
        next(error);
    }
};
export const upsertPaymentProject = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const config = {
            key: projectKey,
            displayName: String(body.displayName || projectKey).trim() || projectKey,
            upstreamProvider: String(body.upstreamProvider || 'paypro').trim().toLowerCase(),
            backupUpstreamProvider: String(body.backupUpstreamProvider || '').trim().toLowerCase() || undefined,
            downstreamNotifyUrl: String(body.downstreamNotifyUrl || '').trim() || undefined,
            downstreamNotifySecret: String(body.downstreamNotifySecret || '').trim() || undefined,
            bridgeNotifySecret: String(body.bridgeNotifySecret || '').trim() || undefined,
            personalQrListenerSecret: String(body.personalQrListenerSecret || '').trim() || undefined,
            payProApiUrl: String(body.payProApiUrl || '').trim() || undefined,
            payProOpenApiSecret: String(body.payProOpenApiSecret || '').trim() || undefined,
            payProNotifyUrl: String(body.payProNotifyUrl || '').trim() || undefined,
            xpayApiUrl: String(body.xpayApiUrl || '').trim() || undefined,
            xpayToken: String(body.xpayToken || '').trim() || undefined,
            xpayNotifyUrl: String(body.xpayNotifyUrl || '').trim() || undefined,
            xpayGatewayBaseUrl: String(body.xpayGatewayBaseUrl || '').trim() || undefined,
            xpayGatewayNotifySecret: String(body.xpayGatewayNotifySecret || '').trim() || undefined,
            xpayTenantKey: String(body.xpayTenantKey || '').trim() || undefined,
            xpayTenantCallbackSecret: String(body.xpayTenantCallbackSecret || '').trim() || undefined,
            creemApiBaseUrl: String(body.creemApiBaseUrl || '').trim() || undefined,
            creemApiKey: String(body.creemApiKey || '').trim() || undefined,
            creemWebhookSecret: String(body.creemWebhookSecret || '').trim() || undefined,
            creemProductId: String(body.creemProductId || '').trim() || undefined,
            creemReturnUrl: String(body.creemReturnUrl || '').trim() || undefined,
            qiupayBaseUrl: String(body.qiupayBaseUrl || '').trim() || undefined,
            qiupayPid: String(body.qiupayPid || '').trim() || undefined,
            qiupayKey: String(body.qiupayKey || '').trim() || undefined,
            qiupayNotifyUrl: String(body.qiupayNotifyUrl || '').trim() || undefined,
            qiupayReturnUrl: String(body.qiupayReturnUrl || '').trim() || undefined,
            tpayGatewayUrl: String(body.tpayGatewayUrl || '').trim() || undefined,
            tpayAppId: String(body.tpayAppId || '').trim() || undefined,
            tpayAppSecret: String(body.tpayAppSecret || '').trim() || undefined,
            tpayQueryUrl: String(body.tpayQueryUrl || '').trim() || undefined,
            hupijiaoGatewayUrl: String(body.hupijiaoGatewayUrl || '').trim() || undefined,
            hupijiaoBackupGatewayUrl: String(body.hupijiaoBackupGatewayUrl || '').trim() || undefined,
            hupijiaoAppId: String(body.hupijiaoAppId || '').trim() || undefined,
            hupijiaoAppSecret: String(body.hupijiaoAppSecret || '').trim() || undefined,
            hupijiaoNotifyUrl: String(body.hupijiaoNotifyUrl || '').trim() || undefined,
            hupijiaoReturnUrl: String(body.hupijiaoReturnUrl || '').trim() || undefined,
            hupijiaoPlugins: String(body.hupijiaoPlugins || '').trim() || undefined,
            hupijiaoVersion: String(body.hupijiaoVersion || '').trim() || undefined,
        };
        if (!SUPPORTED_UPSTREAM_PROVIDERS.has(config.upstreamProvider)) {
            throw new AppError('upstreamProvider must be paypro, xpay, tpay, hupijiao, creem or qiupay', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (config.backupUpstreamProvider && !SUPPORTED_UPSTREAM_PROVIDERS.has(config.backupUpstreamProvider)) {
            throw new AppError('backupUpstreamProvider must be paypro, xpay, tpay, hupijiao, creem or qiupay', 400, ErrorCode.VALIDATION_ERROR);
        }
        validateProviderConfig(config, config.upstreamProvider, 'primary');
        if (config.backupUpstreamProvider) {
            validateProviderConfig(config, config.backupUpstreamProvider, 'backup');
        }
        if (config.downstreamNotifyUrl) {
            assertSafeOutboundCallbackUrl(config.downstreamNotifyUrl);
        }
        await prisma.systemConfig.upsert({
            where: { key: `${PAYMENT_PROJECT_CONFIG_PREFIX}${projectKey}` },
            update: {
                value: JSON.stringify(config),
                is_secret: false,
                description: `Payment project config for ${projectKey}`,
            },
            create: {
                key: `${PAYMENT_PROJECT_CONFIG_PREFIX}${projectKey}`,
                value: JSON.stringify(config),
                is_secret: false,
                description: `Payment project config for ${projectKey}`,
            },
        });
        return sendSuccess(res, { project: config }, 'Project saved');
    }
    catch (error) {
        next(error);
    }
};
export const deletePaymentProject = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        await prisma.systemConfig.delete({
            where: { key: `${PAYMENT_PROJECT_CONFIG_PREFIX}${projectKey}` },
        });
        return sendSuccess(res, { deleted: true, projectKey }, 'Project deleted');
    }
    catch (error) {
        next(error);
    }
};
export const getPaymentProjectDiagnostics = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const config = await getPaymentProjectConfig(projectKey);
        const diagnostics = {
            projectKey,
            generatedAt: new Date().toISOString(),
            primaryProvider: config.upstreamProvider,
            backupProvider: config.backupUpstreamProvider || null,
            providerReadiness: buildProviderReadiness(config),
            effectiveEndpoints: {
                createOrder: '/api/v1/payment/create',
                xpayNotify: config.xpayNotifyUrl || '/api/v1/payment/xpay/notify',
                xpayTenantNotify: '/api/v1/payment/xpay/tenant-notify',
                payproNotify: config.payProNotifyUrl || '/api/v1/payment/paypro/notify',
                tpayNotify: '/api/v1/payment/tpay/notify',
                hupijiaoNotify: config.hupijiaoNotifyUrl || '/api/v1/payment/hupijiao/notify',
                qiupayNotify: config.qiupayNotifyUrl || '/api/v1/payment/qiupay/notify',
                creemWebhook: '/api/v1/payment/creem/webhook',
                creemReturn: config.creemReturnUrl || '/api/v1/payment/creem/return',
                personalBridge: '/api/v1/payment/personal-qr/notify',
                xpayBridge: '/api/v1/payment/xpay-bridge/notify',
            },
            tests: [],
        };
        const tests = diagnostics.tests;
        tests.push({
            name: 'downstreamNotifyUrl',
            ok: !config.downstreamNotifyUrl || hasText(config.downstreamNotifyUrl),
            detail: config.downstreamNotifyUrl || 'not configured',
        });
        if (config.upstreamProvider === 'xpay' || config.backupUpstreamProvider === 'xpay') {
            const xpayMode = resolveXpayMode(config);
            tests.push({
                name: 'xpayMode',
                ok: xpayMode !== 'none',
                detail: xpayMode,
            });
            if (xpayMode === 'tenant-gateway' && config.xpayGatewayBaseUrl && config.xpayTenantKey && config.xpayToken) {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                try {
                    const response = await fetch(`${config.xpayGatewayBaseUrl.replace(/\/+$/, '')}/open/tenants/${encodeURIComponent(config.xpayTenantKey)}`, {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${config.xpayToken}`,
                        },
                        signal: controller.signal,
                    });
                    const text = await response.text();
                    tests.push({
                        name: 'xpayTenantProfile',
                        ok: response.ok,
                        detail: response.ok ? 'tenant profile reachable' : `HTTP ${response.status}`,
                        sample: text.slice(0, 240),
                    });
                }
                catch (error) {
                    tests.push({
                        name: 'xpayTenantProfile',
                        ok: false,
                        detail: error instanceof Error ? error.message : String(error),
                    });
                }
                finally {
                    clearTimeout(timeout);
                }
            }
        }
        if (config.upstreamProvider === 'tpay' || config.backupUpstreamProvider === 'tpay') {
            tests.push({
                name: 'tpayQueryUrl',
                ok: hasText(config.tpayQueryUrl),
                detail: config.tpayQueryUrl || 'missing',
            });
        }
        if (config.upstreamProvider === 'hupijiao' || config.backupUpstreamProvider === 'hupijiao') {
            tests.push({
                name: 'hupijiaoBackupGateway',
                ok: hasText(config.hupijiaoBackupGatewayUrl),
                detail: config.hupijiaoBackupGatewayUrl || 'not configured',
            });
        }
        if (config.upstreamProvider === 'creem' || config.backupUpstreamProvider === 'creem') {
            tests.push({
                name: 'creemProductId',
                ok: hasText(config.creemProductId),
                detail: String(config.creemProductId || 'missing'),
            });
            tests.push({
                name: 'creemWebhookSecret',
                ok: hasText(config.creemWebhookSecret),
                detail: hasText(config.creemWebhookSecret) ? 'configured' : 'missing',
            });
        }
        if (config.upstreamProvider === 'qiupay' || config.backupUpstreamProvider === 'qiupay') {
            tests.push({
                name: 'qiupayPid',
                ok: hasText(config.qiupayPid),
                detail: String(config.qiupayPid || 'missing'),
            });
            tests.push({
                name: 'qiupayNotifyUrl',
                ok: hasText(config.qiupayNotifyUrl) || true,
                detail: String(config.qiupayNotifyUrl || '/api/v1/payment/qiupay/notify'),
            });
        }
        return sendSuccess(res, diagnostics);
    }
    catch (error) {
        next(error);
    }
};
export const getPaymentProjectXpayTenant = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const config = await getPaymentProjectConfig(projectKey);
        const adminBaseUrl = resolveXpayAdminBaseUrl(config);
        const tenantKey = config.xpayTenantKey || projectKey;
        const callbackUrl = buildTenantCallbackUrl(req);
        const { token, profile } = await loginXpayAdmin(adminBaseUrl);
        const tenant = await findXpayTenant(adminBaseUrl, token, tenantKey);
        const paymentMethods = tenant?.paymentMethods || [];
        return sendSuccess(res, {
            connected: true,
            adminBaseUrl,
            tenantKey,
            callbackUrl,
            tenant,
            paymentMethods,
            officialProviders: profile?.officialProviders || null,
            resolved: {
                xpayMode: buildProjectStatus(config).xpayMode,
                tokenConfigured: hasText(config.xpayToken),
                gatewayNotifyConfigured: hasText(config.xpayGatewayNotifySecret),
                tenantCallbackConfigured: hasText(config.xpayTenantCallbackSecret),
                alipayQrConfigured: paymentMethods.some((item) => item?.payType === 'alipay' && hasText(item?.qrImagePath)),
                wechatQrConfigured: paymentMethods.some((item) => item?.payType === 'wechat' && hasText(item?.qrImagePath)),
            },
        });
    }
    catch (error) {
        next(error);
    }
};
export const syncPaymentProjectXpayTenant = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const config = await getPaymentProjectConfig(projectKey);
        const adminBaseUrl = resolveXpayAdminBaseUrl(config);
        const publicBaseUrl = resolveXpayPublicBaseUrl(config, req.get('host') ? `${req.protocol}://${req.get('host')}` : undefined);
        const tenantKey = normalizeProjectKey(req.body?.tenantKey || config.xpayTenantKey || projectKey);
        const displayName = String(req.body?.displayName || config.displayName || tenantKey).trim() || tenantKey;
        const callbackUrl = String(req.body?.callbackUrl || buildTenantCallbackUrl(req)).trim();
        const enabledPayTypes = ['alipay', 'wechat'].filter((payType) => req.body?.[`enable_${payType}`] !== false);
        const tenantPayload = buildTenantPayload(tenantKey, displayName, callbackUrl, enabledPayTypes.length ? enabledPayTypes : ['alipay', 'wechat']);
        const { token } = await loginXpayAdmin(adminBaseUrl);
        const existingTenant = await findXpayTenant(adminBaseUrl, token, tenantKey);
        let tenant = null;
        let accessToken = '';
        let callbackSecret = '';
        let action = 'create';
        if (existingTenant) {
            action = 'rotate';
            await xpayAdminJson(adminBaseUrl, token, `/admin/tenants/${existingTenant.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tenantPayload),
            });
            const rotated = await xpayAdminJson(adminBaseUrl, token, `/admin/tenants/${existingTenant.id}/rotate-secrets`, {
                method: 'POST',
            });
            accessToken = rotated.accessToken;
            callbackSecret = rotated.callbackSecret;
            tenant = await findXpayTenant(adminBaseUrl, token, tenantKey);
        }
        else {
            const created = await xpayAdminJson(adminBaseUrl, token, '/admin/tenants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tenantPayload),
            });
            tenant = created.tenant;
            accessToken = created.accessToken;
            callbackSecret = created.callbackSecret;
        }
        if (!tenant || !accessToken || !callbackSecret) {
            throw new AppError('XPay tenant sync failed to return secrets', 502, ErrorCode.SERVICE_UNAVAILABLE);
        }
        const updatedProject = {
            ...config,
            key: projectKey,
            displayName,
            upstreamProvider: 'xpay',
            xpayGatewayBaseUrl: publicBaseUrl,
            xpayTenantKey: tenantKey,
            xpayToken: accessToken,
            xpayTenantCallbackSecret: callbackSecret,
        };
        await prisma.systemConfig.upsert({
            where: { key: `${PAYMENT_PROJECT_CONFIG_PREFIX}${projectKey}` },
            update: {
                value: JSON.stringify(updatedProject),
                is_secret: false,
                description: `Payment project config for ${projectKey}`,
            },
            create: {
                key: `${PAYMENT_PROJECT_CONFIG_PREFIX}${projectKey}`,
                value: JSON.stringify(updatedProject),
                is_secret: false,
                description: `Payment project config for ${projectKey}`,
            },
        });
        return sendSuccess(res, {
            action,
            adminBaseUrl,
            tenant,
            project: updatedProject,
        }, action === 'create' ? 'XPay tenant created' : 'XPay tenant synced');
    }
    catch (error) {
        next(error);
    }
};
export const uploadPaymentProjectXpayTenantQr = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const payType = normalizeProjectKey(req.params.payType);
        if (!['alipay', 'wechat', 'qqpay', 'unipay'].includes(payType)) {
            throw new AppError('Unsupported payType', 400, ErrorCode.VALIDATION_ERROR);
        }
        const file = req.file;
        if (!file || !file.buffer?.length) {
            throw new AppError('QR file is required', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (file.size > XPAY_QR_UPLOAD_LIMIT_BYTES) {
            throw new AppError('QR file is too large', 400, ErrorCode.VALIDATION_ERROR);
        }
        const config = await getPaymentProjectConfig(projectKey);
        const adminBaseUrl = resolveXpayAdminBaseUrl(config);
        const tenantKey = config.xpayTenantKey || projectKey;
        const { token } = await loginXpayAdmin(adminBaseUrl);
        const tenant = await findXpayTenant(adminBaseUrl, token, tenantKey);
        if (!tenant?.id) {
            throw new AppError('XPay tenant does not exist yet. Sync tenant first.', 404, ErrorCode.NOT_FOUND);
        }
        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' }), file.originalname || `${payType}.png`);
        const response = await fetch(`${adminBaseUrl}/admin/tenants/${tenant.id}/payment-methods/${payType}/qr`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: form,
        });
        const payload = await response.json().catch(() => null);
        const result = payload ? extractXpayEnvelopePayload(payload) : undefined;
        if (!response.ok) {
            throw new AppError(`XPay QR upload failed: ${payload?.message || payload?.msg || `HTTP ${response.status}`}`, response.status >= 400 && response.status < 600 ? response.status : 502, ErrorCode.SERVICE_UNAVAILABLE);
        }
        return sendSuccess(res, {
            payType,
            tenantId: tenant.id,
            tenantKey,
            upload: result || payload,
        }, 'XPay tenant QR uploaded');
    }
    catch (error) {
        next(error);
    }
};
export const createPaymentProjectTestOrder = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const planIdRaw = String(body.planId || 'basic-monthly').trim();
        const paymentMethod = String(body.paymentMethod || 'alipay').trim().toLowerCase();
        const providerOverride = String(body.provider || '').trim().toLowerCase() || undefined;
        const amount = Number(body.amount ?? 20);
        if (paymentMethod !== 'alipay' && paymentMethod !== 'wechat') {
            throw new AppError('paymentMethod must be alipay or wechat', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new AppError('amount must be positive', 400, ErrorCode.VALIDATION_ERROR);
        }
        const normalizedPlanId = normalizePlanId(planIdRaw);
        const amountFen = yuanToFen(amount);
        if (normalizedPlanId !== 'custom') {
            const expectedPriceFen = PLAN_PRICES_FEN[normalizedPlanId];
            if (expectedPriceFen === undefined) {
                throw new AppError(`Invalid planId: ${planIdRaw}`, 400, ErrorCode.VALIDATION_ERROR);
            }
            if (amountFen !== expectedPriceFen) {
                throw new AppError(`Amount mismatch for ${normalizedPlanId}`, 400, ErrorCode.VALIDATION_ERROR);
            }
        }
        const projectConfig = await getPaymentProjectConfig(projectKey);
        const payment = await prisma.payment.create({
            data: {
                id: buildProjectScopedPaymentId(projectConfig.key),
                user_id: req.user.id,
                amount: amountFen,
                plan_id: normalizedPlanId,
                payment_method: paymentMethod,
                currency: 'CNY',
                status: 'PENDING',
            },
        });
        try {
            const provider = providerOverride && SUPPORTED_UPSTREAM_PROVIDERS.has(providerOverride)
                ? providerOverride
                : projectConfig.upstreamProvider;
            const providerResult = await createExternalPaymentByProvider(req, payment, projectConfig, amount, paymentMethod, provider);
            return sendSuccess(res, {
                projectKey,
                paymentId: payment.id,
                orderId: payment.id,
                provider: providerResult.provider,
                paymentUrl: providerResult.paymentUrl,
                payNum: 'payNum' in providerResult ? providerResult.payNum : undefined,
                tenantKey: 'tenantKey' in providerResult ? providerResult.tenantKey : undefined,
                upstreamOrderId: 'upstreamOrderId' in providerResult ? providerResult.upstreamOrderId : undefined,
                qrImagePath: 'qrImagePath' in providerResult ? providerResult.qrImagePath : undefined,
                paymentQrContent: 'paymentQrContent' in providerResult ? providerResult.paymentQrContent : undefined,
                amount,
                amountFen,
                status: payment.status,
            }, 'Test order created');
        }
        catch (error) {
            await prisma.payment.update({
                where: { id: payment.id },
                data: { status: 'FAILED', updated_at: new Date() },
            });
            throw error;
        }
    }
    catch (error) {
        next(error);
    }
};
export const getPaymentProjectOrder = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const orderId = String(req.params.orderId || '').trim();
        if (!orderId) {
            throw new AppError('orderId is required', 400, ErrorCode.VALIDATION_ERROR);
        }
        const parsedProjectKey = parseProjectKeyFromPaymentId(orderId);
        if (parsedProjectKey && parsedProjectKey !== projectKey) {
            throw new AppError('orderId does not belong to projectKey', 400, ErrorCode.VALIDATION_ERROR);
        }
        const payment = await prisma.payment.findUnique({ where: { id: orderId } });
        if (!payment) {
            throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
        }
        return sendSuccess(res, {
            paymentId: payment.id,
            orderId: payment.id,
            projectKey,
            amountFen: payment.amount,
            amountYuan: fenToYuanNumber(payment.amount),
            status: payment.status,
            planId: payment.plan_id,
            paymentMethod: payment.payment_method,
            currency: payment.currency,
            createdAt: payment.created_at,
            updatedAt: payment.updated_at,
        });
    }
    catch (error) {
        next(error);
    }
};
export const simulatePaymentProjectOrderSuccess = async (req, res, next) => {
    try {
        const projectKey = normalizeProjectKey(req.params.projectKey);
        const orderId = String(req.params.orderId || '').trim();
        if (!orderId) {
            throw new AppError('orderId is required', 400, ErrorCode.VALIDATION_ERROR);
        }
        const payment = await prisma.payment.findUnique({ where: { id: orderId } });
        if (!payment) {
            throw new AppError('Payment not found', 404, ErrorCode.NOT_FOUND);
        }
        const parsedProjectKey = parseProjectKeyFromPaymentId(orderId);
        if (parsedProjectKey && parsedProjectKey !== projectKey) {
            throw new AppError('orderId does not belong to projectKey', 400, ErrorCode.VALIDATION_ERROR);
        }
        const projectConfig = await getPaymentProjectConfig(projectKey);
        const result = await completeExternalPayment(req, orderId, {
            expectedAmountFen: payment.amount,
            metadata: {
                callbackSource: 'admin-simulated',
                operatorId: req.user?.id,
            },
            projectConfig,
        });
        return sendSuccess(res, {
            paymentId: orderId,
            projectKey,
            result,
        }, 'Simulated payment completion finished');
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=paymentProjectController.js.map