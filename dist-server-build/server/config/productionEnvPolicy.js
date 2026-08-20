import path from 'node:path';
const PLACEHOLDER_PATTERN = /(?:<|>|your[_-]|replace|change.?me|placeholder|example|mysecret|123456|test[_-]?secret)/i;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const PRIVATE_IPV4_PATTERN = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.|169\.254\.)/;
const SUPPORTED_PROVIDERS = new Set(['xpay', 'paypro', 'tpay', 'hupijiao', 'creem', 'qiupay', 'paypal']);
const clean = (env, field) => env[field]?.trim() || '';
const isStrongSecret = (value, minimumLength = 64) => {
    if (value.length < minimumLength || PLACEHOLDER_PATTERN.test(value))
        return false;
    return new Set(value).size >= 10;
};
const parseUrl = (value) => {
    try {
        return new URL(value);
    }
    catch {
        return null;
    }
};
const isLoopbackUrl = (url) => {
    const host = url.hostname.toLowerCase();
    return LOOPBACK_HOSTS.has(host) || PRIVATE_IPV4_PATTERN.test(host);
};
export function validateProductionRuntimeEnv(env) {
    const errors = [];
    const warnings = [];
    const addError = (field, message) => errors.push({ field, message });
    const addWarning = (field, message) => warnings.push({ field, message });
    const requireValue = (field, message = `${field} is required in production`) => {
        const value = clean(env, field);
        if (!value)
            addError(field, message);
        return value;
    };
    const validateSecret = (field, value, minimumLength = 64) => {
        if (value && !isStrongSecret(value, minimumLength)) {
            addError(field, `${field} must be a non-placeholder high-entropy secret of at least ${minimumLength} characters`);
        }
    };
    const requireSecret = (field, minimumLength = 64) => {
        const value = requireValue(field);
        validateSecret(field, value, minimumLength);
        return value;
    };
    const validateOptionalSecret = (field, minimumLength = 64) => {
        validateSecret(field, clean(env, field), minimumLength);
    };
    const requirePublicHttps = (field) => {
        const value = requireValue(field);
        if (!value)
            return null;
        const url = parseUrl(value);
        if (!url || url.protocol !== 'https:' || url.username || url.password || isLoopbackUrl(url)) {
            addError(field, `${field} must be a public HTTPS URL without embedded credentials`);
            return null;
        }
        return url;
    };
    const requireServiceUrl = (field) => {
        const value = requireValue(field);
        if (!value)
            return null;
        const url = parseUrl(value);
        if (!url || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopbackUrl(url)))) {
            addError(field, `${field} must use HTTPS, or HTTP only for a loopback service`);
            return null;
        }
        return url;
    };
    if (clean(env, 'NODE_ENV') !== 'production') {
        return { ok: true, errors, warnings };
    }
    const databaseUrl = requireValue('DATABASE_URL');
    if (databaseUrl && !/^(?:postgresql|postgres|mysql):\/\//i.test(databaseUrl)) {
        addError('DATABASE_URL', 'Production DATABASE_URL must use PostgreSQL or MySQL; file-based databases are not allowed');
    }
    requireSecret('JWT_SECRET');
    requireSecret('ADMIN_TOKEN');
    requireSecret('WALLET_SECRET');
    requireSecret('MODERATION_ENCRYPTION_KEY');
    validateOptionalSecret('MAIL_CONFIG_ENCRYPTION_KEY');
    validateOptionalSecret('MAIL_CONFIG_LEGACY_ENCRYPTION_KEY', 32);
    const frontendUrl = requirePublicHttps('FRONTEND_URL');
    const apiPublicUrl = requirePublicHttps('API_PUBLIC_URL');
    if (frontendUrl && apiPublicUrl && frontendUrl.origin !== apiPublicUrl.origin) {
        addError('API_PUBLIC_URL', 'API_PUBLIC_URL must use the same origin as FRONTEND_URL for the production single-origin deployment');
    }
    if (clean(env, 'FORCE_HTTPS') !== 'true')
        addError('FORCE_HTTPS', 'FORCE_HTTPS must be true in production');
    if (clean(env, 'TRUST_PROXY') !== 'true')
        addError('TRUST_PROXY', 'TRUST_PROXY must be true behind the production reverse proxy');
    const corsOrigins = clean(env, 'CORS_ORIGIN')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const parsedCorsOrigins = corsOrigins.map((value) => parseUrl(value));
    if (parsedCorsOrigins.some((url) => !url || !['http:', 'https:'].includes(url.protocol))) {
        addError('CORS_ORIGIN', 'CORS_ORIGIN entries must be valid HTTP(S) origins');
    }
    if (corsOrigins.length > 0 && frontendUrl && !parsedCorsOrigins.some((url) => url?.origin === frontendUrl.origin)) {
        addError('CORS_ORIGIN', 'CORS_ORIGIN must include the FRONTEND_URL origin');
    }
    const cookieDomain = clean(env, 'COOKIE_DOMAIN').replace(/^\./, '').toLowerCase();
    if (cookieDomain && frontendUrl) {
        const host = frontendUrl.hostname.toLowerCase();
        if (host !== cookieDomain && !host.endsWith(`.${cookieDomain}`)) {
            addError('COOKIE_DOMAIN', 'COOKIE_DOMAIN must contain the FRONTEND_URL hostname');
        }
    }
    else if (!cookieDomain) {
        addWarning('COOKIE_DOMAIN', 'COOKIE_DOMAIN is unset; host-only cookies will be used');
    }
    if (clean(env, 'REDIS_ENABLED') !== 'true') {
        addError('REDIS_ENABLED', 'REDIS_ENABLED must be true in production to avoid process-local rate-limit and replay state');
    }
    const redisUrlValue = requireValue('REDIS_URL');
    const redisUrl = redisUrlValue ? parseUrl(redisUrlValue) : null;
    if (!redisUrl || !['redis:', 'rediss:'].includes(redisUrl.protocol)) {
        addError('REDIS_URL', 'REDIS_URL must be a valid redis:// or rediss:// URL');
    }
    const uploadDir = requireValue('UPLOAD_DIR');
    if (uploadDir && !path.isAbsolute(uploadDir)) {
        addError('UPLOAD_DIR', 'UPLOAD_DIR must be an absolute persistent path in production');
    }
    if (clean(env, 'IMAGE_HOST_ENABLED') === 'true') {
        requirePublicHttps('IMAGE_HOST_UPLOAD_URL');
        requireSecret('IMAGE_HOST_TOKEN', 20);
    }
    if (clean(env, 'R2_ENABLED') === 'true') {
        const accountId = requireValue('R2_ACCOUNT_ID');
        if (accountId && !/^[a-f0-9]{32}$/i.test(accountId)) {
            addError('R2_ACCOUNT_ID', 'R2_ACCOUNT_ID must be a 32-character Cloudflare account id');
        }
        requireValue('R2_BUCKET');
        requireValue('R2_ACCESS_KEY_ID');
        requireSecret('R2_SECRET_ACCESS_KEY', 32);
        requirePublicHttps('R2_PUBLIC_BASE_URL');
    }
    const redirectHosts = clean(env, 'VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    for (const host of redirectHosts) {
        if (host.includes('*') || host.includes('://') || host.includes('/') || /\s/.test(host)) {
            addError('VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS', `Invalid payment redirect host entry: ${host}`);
        }
    }
    const githubValues = [clean(env, 'GITHUB_CLIENT_ID'), clean(env, 'GITHUB_CLIENT_SECRET'), clean(env, 'GITHUB_CALLBACK_URL')];
    const githubPartiallyConfigured = githubValues.some(Boolean) && !githubValues.every(Boolean);
    if (githubPartiallyConfigured) {
        addError('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_CALLBACK_URL must be configured together');
    }
    if (githubValues.every(Boolean)) {
        if (!isStrongSecret(githubValues[1], 20))
            addError('GITHUB_CLIENT_SECRET', 'GITHUB_CLIENT_SECRET must be a non-placeholder secret');
        const callback = parseUrl(githubValues[2]);
        if (!callback || callback.protocol !== 'https:') {
            addError('GITHUB_CALLBACK_URL', 'GITHUB_CALLBACK_URL must use HTTPS in production');
        }
        else if (apiPublicUrl && callback.origin !== apiPublicUrl.origin) {
            addError('GITHUB_CALLBACK_URL', 'GITHUB_CALLBACK_URL must use the same origin as API_PUBLIC_URL');
        }
    }
    if (clean(env, 'PAYPRO_DEV_MOCK_ENABLED') === 'true' || clean(env, 'PAYPRO_DEV_MOCK_MARK_COMPLETED') === 'true') {
        addError('PAYPRO_DEV_MOCK_ENABLED', 'Payment development mocks must be disabled in production');
    }
    const providerRaw = clean(env, 'DEFAULT_PAYMENT_UPSTREAM_PROVIDER').toLowerCase();
    const backupRaw = clean(env, 'DEFAULT_PAYMENT_BACKUP_PROVIDER').toLowerCase();
    const providers = Array.from(new Set([providerRaw, backupRaw].filter(Boolean)));
    if (!providerRaw && backupRaw) {
        addError('DEFAULT_PAYMENT_UPSTREAM_PROVIDER', 'A backup payment provider requires a default payment provider');
    }
    if (providers.length === 0) {
        addWarning('DEFAULT_PAYMENT_UPSTREAM_PROVIDER', 'No environment-level payment provider is configured; database-managed payment projects remain available');
    }
    else if (redirectHosts.length === 0) {
        addError('VITE_ALLOWED_PAYMENT_REDIRECT_HOSTS', 'At least one explicit payment redirect host is required when a payment provider is configured');
    }
    for (const value of providers) {
        if (!SUPPORTED_PROVIDERS.has(value)) {
            addError('DEFAULT_PAYMENT_UPSTREAM_PROVIDER', `Unsupported payment provider: ${value}`);
            continue;
        }
        const provider = value;
        if (provider === 'xpay') {
            requireSecret('XPAY_TOKEN', 32);
            requireServiceUrl('XPAY_API_URL');
            requirePublicHttps('XPAY_NOTIFY_URL');
            requireSecret('XPAY_GATEWAY_NOTIFY_SECRET', 32);
        }
        else if (provider === 'paypro') {
            requireServiceUrl('PAYPRO_API_URL');
            requireSecret('PAYPRO_OPENAPI_SECRET', 32);
            requirePublicHttps('PAYPRO_NOTIFY_URL');
        }
        else if (provider === 'tpay') {
            requirePublicHttps('TPAY_GATEWAY_URL');
            requireValue('TPAY_APP_ID');
            requireSecret('TPAY_APP_SECRET', 20);
            requirePublicHttps('TPAY_QUERY_URL');
        }
        else if (provider === 'hupijiao') {
            requirePublicHttps('HUPIJIAO_GATEWAY_URL');
            requireValue('HUPIJIAO_APP_ID');
            requireSecret('HUPIJIAO_APP_SECRET', 20);
            requirePublicHttps('HUPIJIAO_NOTIFY_URL');
            requirePublicHttps('HUPIJIAO_RETURN_URL');
        }
        else if (provider === 'creem') {
            requirePublicHttps('CREEM_API_BASE_URL');
            requireSecret('CREEM_API_KEY', 20);
            requireSecret('CREEM_WEBHOOK_SECRET', 20);
            if (!clean(env, 'CREEM_PRODUCT_ID') && !clean(env, 'CREEM_PRODUCT_MAP_JSON')) {
                addError('CREEM_PRODUCT_ID', 'CREEM_PRODUCT_ID or CREEM_PRODUCT_MAP_JSON is required in production');
            }
            requirePublicHttps('CREEM_RETURN_URL');
        }
        else if (provider === 'qiupay') {
            const qiupayBaseUrl = requirePublicHttps('QIUPAY_BASE_URL');
            const isVmqGateway = qiupayBaseUrl ? /(^|\.)v\.0st\.top$/i.test(qiupayBaseUrl.hostname) : false;
            if (!isVmqGateway)
                requireValue('QIUPAY_PID');
            requireSecret('QIUPAY_KEY', 20);
            requirePublicHttps('QIUPAY_NOTIFY_URL');
            requirePublicHttps('QIUPAY_RETURN_URL');
        }
        else if (provider === 'paypal') {
            requireSecret('PAYPAL_CLIENT_ID', 20);
            requireSecret('PAYPAL_CLIENT_SECRET', 20);
            requireSecret('PAYPAL_WEBHOOK_ID', 10);
            const mode = clean(env, 'PAYPAL_MODE').toLowerCase() || 'live';
            if (mode !== 'live' && mode !== 'sandbox') {
                addError('PAYPAL_MODE', 'PAYPAL_MODE must be live or sandbox');
            }
            requirePublicHttps('PAYPAL_RETURN_URL');
            const exchangeRate = Number(clean(env, 'PAYPAL_EXCHANGE_RATE_CNY_PER_USD') || '7');
            if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
                addError('PAYPAL_EXCHANGE_RATE_CNY_PER_USD', 'PAYPAL_EXCHANGE_RATE_CNY_PER_USD must be positive');
            }
        }
    }
    return { ok: errors.length === 0, errors, warnings };
}
//# sourceMappingURL=productionEnvPolicy.js.map