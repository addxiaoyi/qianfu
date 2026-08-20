import { isIP } from 'node:net';
export function resolveListenHost(nodeEnv, configuredHost = process.env.API_BIND_HOST) {
    const host = configuredHost?.trim();
    if (host && isIP(host) === 0) {
        throw new Error('API_BIND_HOST must be an IP address');
    }
    if (host)
        return host;
    return nodeEnv === 'production' ? '127.0.0.1' : '0.0.0.0';
}
export function resolveProbePort(configuredPort = process.env.INTELLIGENT_PROBE_PORT) {
    const port = configuredPort == null || configuredPort.trim() === ''
        ? 3452
        : Number(configuredPort);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('INTELLIGENT_PROBE_PORT must be an integer between 1 and 65535');
    }
    return port;
}
//# sourceMappingURL=listenHost.js.map