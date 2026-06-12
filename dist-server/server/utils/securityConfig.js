import { AppError, ErrorCode } from './errors.js';
const MIN_JWT_SECRET_LENGTH = 32;
let jwtSecretCache = null;
let trustedHostCache = null;
const normalizeHost = (value) => {
    return value.trim().toLowerCase().replace(/\.$/, '');
};
const parseHostList = (raw) => {
    return new Set(raw
        .split(',')
        .map((entry) => normalizeHost(entry))
        .filter(Boolean));
};
const deriveDefaultTrustedHosts = () => {
    const hosts = new Set();
    const candidates = [
        process.env.API_PUBLIC_URL,
        process.env.FRONTEND_URL,
        process.env.CORS_ORIGIN,
    ];
    for (const candidate of candidates) {
        if (!candidate?.trim())
            continue;
        try {
            hosts.add(normalizeHost(new URL(candidate).host));
        }
        catch {
            continue;
        }
    }
    return hosts;
};
export const getJwtSecret = () => {
    if (jwtSecretCache) {
        return jwtSecretCache;
    }
    const raw = process.env.JWT_SECRET?.trim();
    if (!raw || raw.length < MIN_JWT_SECRET_LENGTH) {
        throw new AppError(`JWT secret is missing or too short (minimum ${MIN_JWT_SECRET_LENGTH} characters required)`, 500, ErrorCode.SERVICE_UNAVAILABLE);
    }
    jwtSecretCache = raw;
    return raw;
};
export const getTrustedRedirectHosts = () => {
    if (trustedHostCache) {
        return trustedHostCache;
    }
    const configured = process.env.TRUSTED_REDIRECT_HOSTS?.trim();
    if (configured) {
        trustedHostCache = parseHostList(configured);
        return trustedHostCache;
    }
    trustedHostCache = deriveDefaultTrustedHosts();
    return trustedHostCache;
};
export const isTrustedHost = (host) => {
    return getTrustedRedirectHosts().has(normalizeHost(host));
};
//# sourceMappingURL=securityConfig.js.map