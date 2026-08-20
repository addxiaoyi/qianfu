import crypto from 'crypto';
const DEFAULT_TIMEOUT_SECONDS = 300;
export class SignatureUtil {
    appId;
    secretKey;
    timeoutSeconds;
    constructor(appId, secretKey, timeoutSeconds = DEFAULT_TIMEOUT_SECONDS) {
        this.appId = appId;
        this.secretKey = secretKey;
        this.timeoutSeconds = timeoutSeconds;
    }
    static generateSignature(params, secretKey) {
        const { method, path, timestamp, bodyMd5 } = params;
        const content = `${method}\n${path}\n${timestamp}\n${bodyMd5}`;
        return crypto
            .createHmac('sha256', secretKey)
            .update(content)
            .digest('hex');
    }
    static md5(content) {
        return crypto.createHash('md5').update(content || '').digest('hex');
    }
    verify(params, signature) {
        const { timestamp } = params;
        const now = Math.floor(Date.now() / 1000);
        const requestTime = parseInt(timestamp, 10);
        if (isNaN(requestTime)) {
            return { valid: false, error: 'Invalid timestamp format' };
        }
        if (Math.abs(now - requestTime) > this.timeoutSeconds) {
            return { valid: false, error: 'Timestamp expired' };
        }
        const expectedSignature = SignatureUtil.generateSignature(params, this.secretKey);
        const isValid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
        return isValid ? { valid: true } : { valid: false, error: 'Signature mismatch' };
    }
    static extractSignatureHeaders(headers) {
        return {
            appId: headers['x-qianfu-appid'] || headers['X-QianFu-AppId'],
            timestamp: headers['x-qianfu-timestamp'] || headers['X-QianFu-Timestamp'],
            signature: headers['x-qianfu-signature'] || headers['X-QianFu-Signature'],
        };
    }
    static isTimestampExpired(timestamp, timeoutSeconds = DEFAULT_TIMEOUT_SECONDS) {
        const now = Math.floor(Date.now() / 1000);
        const requestTime = parseInt(timestamp, 10);
        if (isNaN(requestTime))
            return true;
        return Math.abs(now - requestTime) > timeoutSeconds;
    }
}
export const qianfuConfig = {
    appId: process.env.QIANFU_APP_ID || '',
    secretKey: process.env.QIANFU_SECRET_KEY || '',
    apiUrl: process.env.QIANFU_API_URL || 'http://localhost:8888/qianfu-api',
    /** XPay 异步通知应打到 QianFuController（/api/qianfu/xpay/notify），与 /api/payment/xpay/notify 不是同一路由 */
    callbackUrl: process.env.QIANFU_CALLBACK_URL || 'http://localhost:3000/api/qianfu/xpay/notify',
    enabled: process.env.QIANFU_ENABLED === 'true',
    whitelist: process.env.QIANFU_WHITELIST?.split(',') || ['127.0.0.1', 'localhost'],
};
//# sourceMappingURL=SignatureUtil.js.map