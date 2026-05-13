/**
 * 出站回调 URL 策略：防 SSRF / 内网探测。
 * 环境变量：
 * - CALLBACK_OUTBOUND_HTTPS_ONLY=true  → 仅允许 https（生产 webhook 建议开启）
 * - CALLBACK_URL_PREFIX_ALLOWLIST=a,b  → 非空时 URL 必须以其中任一前缀开头（逗号分隔）
 */
export declare function assertSafeOutboundCallbackUrl(url: string): void;
//# sourceMappingURL=callbackOutboundPolicy.d.ts.map