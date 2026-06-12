import prisma from '../db.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { assertSafeOutboundCallbackUrl } from '../core/task/callbackOutboundPolicy.js';
const PAYMENT_PROJECT_CONFIG_PREFIX = 'payment_project:';
const SUPPORTED_UPSTREAM_PROVIDERS = new Set(['paypro', 'xpay', 'tpay', 'hupijiao']);
const DEFAULT_PAYMENT_PROJECT_KEY = process.env.DEFAULT_PAYMENT_PROJECT_KEY?.trim() || 'qianfu';
const DEFAULT_PAYMENT_UPSTREAM_PROVIDER = process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER?.trim().toLowerCase() || 'xpay';
const DEFAULT_PAYMENT_BACKUP_PROVIDER = process.env.DEFAULT_PAYMENT_BACKUP_PROVIDER?.trim().toLowerCase() || '';
const hasText = (value) => String(value || '').trim().length > 0;
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
        xpay: xpayMode !== 'none',
        xpayMode,
        tpay: hasText(config.tpayGatewayUrl) && hasText(config.tpayAppId) && hasText(config.tpayAppSecret),
        hupijiao: hasText(config.hupijiaoGatewayUrl) && hasText(config.hupijiaoAppId) && hasText(config.hupijiaoAppSecret),
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
    };
    return {
        primaryProvider,
        backupProvider: backupProvider || null,
        primaryReady: Boolean(readinessMap[primaryProvider]),
        backupReady: backupProvider ? Boolean(readinessMap[backupProvider]) : null,
        downstreamReady: hasText(config.downstreamNotifyUrl),
        personalBridgeReady: hasText(config.personalQrListenerSecret) || hasText(config.bridgeNotifySecret),
        xpayMode: readiness.xpayMode,
        providerReadiness: readinessMap,
    };
};
const buildGlobalStatus = () => ({
    supportedProviders: Array.from(SUPPORTED_UPSTREAM_PROVIDERS),
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
            throw new AppError('upstreamProvider must be paypro, xpay, tpay or hupijiao', 400, ErrorCode.VALIDATION_ERROR);
        }
        if (config.backupUpstreamProvider && !SUPPORTED_UPSTREAM_PROVIDERS.has(config.backupUpstreamProvider)) {
            throw new AppError('backupUpstreamProvider must be paypro, xpay, tpay or hupijiao', 400, ErrorCode.VALIDATION_ERROR);
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
//# sourceMappingURL=paymentProjectController.js.map