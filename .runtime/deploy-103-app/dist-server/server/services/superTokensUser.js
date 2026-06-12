import { logger } from '../utils/logger.js';
const ST_API_TIMEOUT_MS = 5000;
const ST_API_RETRIES = 2;
/**
 * 从 SuperTokens Core 创建或获取一个用户，返回 userId。
 * 自动携带 api-key（如果配置了），并带超时和重试。
 */
export async function getOrCreateSuperTokensUser(email) {
    const stApiUrl = process.env.SUPERTOKENS_CONNECTION_URI || process.env.API_BASE_URL || 'http://localhost:3567';
    const stApiKey = process.env.SUPERTOKENS_API_KEY || process.env.API_KEY || '';
    const headers = { 'Content-Type': 'application/json' };
    if (stApiKey) {
        headers['api-key'] = stApiKey;
    }
    const body = JSON.stringify({ email, password: null });
    for (let attempt = 1; attempt <= ST_API_RETRIES; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ST_API_TIMEOUT_MS);
            const response = await fetch(`${stApiUrl}/signinup`, {
                method: 'POST',
                headers,
                body,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                if (data.userId) {
                    return data.userId;
                }
            }
            // 非 ok 响应但还有重试机会
            if (attempt < ST_API_RETRIES) {
                logger.debug(`[SuperTokensUser] /signinup returned ${response.status}, retry ${attempt}/${ST_API_RETRIES}`);
                await new Promise((r) => setTimeout(r, 500 * attempt));
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (attempt < ST_API_RETRIES) {
                logger.debug(`[SuperTokensUser] /signinup attempt ${attempt} failed (${message}), retrying`);
                await new Promise((r) => setTimeout(r, 500 * attempt));
            }
            else {
                logger.warn('[SuperTokensUser] All /signinup retries exhausted:', err);
            }
        }
    }
    return null;
}
//# sourceMappingURL=superTokensUser.js.map