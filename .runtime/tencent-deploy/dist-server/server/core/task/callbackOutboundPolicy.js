import { validateUrl } from '../../utils/validation.js';
import { logger } from '../utils/logger.js';
/**
 * 出站回调 URL 策略：防 SSRF / 内网探测。
 * 环境变量：
 * - CALLBACK_OUTBOUND_HTTPS_ONLY=true  → 仅允许 https（生产 webhook 建议开启）
 * - CALLBACK_URL_PREFIX_ALLOWLIST=a,b  → 非空时 URL 必须以其中任一前缀开头（逗号分隔）
 */
export function assertSafeOutboundCallbackUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) {
        throw new Error('Callback URL is required');
    }
    let u;
    try {
        u = new URL(trimmed);
    }
    catch {
        throw new Error('Invalid callback URL');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('Callback URL must use http or https');
    }
    if (u.username || u.password) {
        throw new Error('Callback URL must not contain credentials');
    }
    const blocked = validateUrl(trimmed);
    if (blocked) {
        throw new Error(blocked.message);
    }
    if (process.env.CALLBACK_OUTBOUND_HTTPS_ONLY === 'true' && u.protocol !== 'https:') {
        throw new Error('Callback URL must use HTTPS when CALLBACK_OUTBOUND_HTTPS_ONLY=true');
    }
    const prefixRaw = process.env.CALLBACK_URL_PREFIX_ALLOWLIST?.trim();
    if (prefixRaw) {
        const prefixes = prefixRaw.split(',').map((p) => p.trim()).filter(Boolean);
        const ok = prefixes.some((p) => trimmed.startsWith(p));
        if (!ok) {
            logger.warn('[CallbackOutbound] URL rejected by CALLBACK_URL_PREFIX_ALLOWLIST');
            throw new Error('Callback URL is not in the configured prefix allowlist');
        }
    }
}
//# sourceMappingURL=callbackOutboundPolicy.js.map