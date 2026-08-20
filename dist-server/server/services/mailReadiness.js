const MAIL_UNAVAILABLE_REASON = 'registration email transport unavailable';
export function evaluateMailReadiness(runtime, nodeEnv = process.env.NODE_ENV) {
    const required = nodeEnv === 'production';
    const ready = !required || (runtime.configured && runtime.enabled);
    return ready
        ? { required, ready }
        : { required, ready, reason: MAIL_UNAVAILABLE_REASON };
}
//# sourceMappingURL=mailReadiness.js.map