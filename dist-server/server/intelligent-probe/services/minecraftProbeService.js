import { isPrivateIP } from '../utils/validation';
import { logger } from '../../utils/logger';
import { promisify } from 'node:util';
import { lookup as dnsLookup, resolveSrv as dnsResolveSrv } from 'node:dns';
import * as mcutil from 'minecraft-server-util';
const lookup = promisify(dnsLookup);
const resolveSrv = promisify(dnsResolveSrv);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const MAX_CONCURRENT_PROBES = 10;
const PROBE_TIMEOUT_MS = 15000;
// Internal cache for status results
const statusCache = new Map();
const CACHE_TTL = 30000; // 30 seconds TTL
// Use a more robust interval management to prevent leaks in tests or hot reloads
let cleanupInterval = null;
export const startCacheCleanup = () => {
    if (cleanupInterval)
        return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        let deletedCount = 0;
        // Performance optimization: Check size before iterating if map is huge
        if (statusCache.size > 10000) {
            logger.warn(`[ProbeCache] Cache size is large (${statusCache.size}), performing cleanup`);
        }
        for (const [key, value] of statusCache.entries()) {
            if (now - value.timestamp > CACHE_TTL) {
                statusCache.delete(key);
                deletedCount++;
            }
        }
        if (deletedCount > 0 && process.env.NODE_ENV === 'development') {
            logger.debug(`[ProbeCache] Cleaned up ${deletedCount} expired entries`);
        }
    }, 60000); // Clean up every minute
};
export const stopCacheCleanup = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
};
// Start cleanup automatically
startCacheCleanup();
/**
 * Fetches server status via mcsrvstat.us API
 */
const getMcsrvstatStatus = async (hostname, port, bedrock) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const type = bedrock ? 'bedrock' : 'server';
        const response = await fetch(`https://api.mcsrvstat.us/v2/${type}/${hostname}:${port}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`Mcsrvstat API returned ${response.status}`);
        }
        const data = await response.json();
        if (!data?.ip || !data?.port) {
            throw new Error('Invalid response from mcsrvstat API');
        }
        return {
            online: true,
            host: hostname,
            port: port,
            version: {
                name_raw: data.version || 'Java',
                protocol: 0,
            },
            players: {
                online: data.players?.online || 0,
                max: data.players?.max || 0,
                list: [],
            },
            motd: {
                raw: data.motd?.raw || '',
                clean: data.motd?.clean || '',
                html: data.motd?.html || '',
            },
            favicon: data.icon || null,
            srv_record: null,
            debug: {
                ping: data.ping || 0,
                query: false,
                srv: false,
                cache_hit: true,
                cache_time: 0,
                cache_expire: 0,
                api_version: 2,
            },
        };
    }
    catch (error) {
        if (error.name === 'AbortError') {
            logger.warn(`[Probe] Timeout: ${hostname}`);
            throw new Error('API request timeout');
        }
        logger.warn(`[Probe] Failed: ${hostname}`, error.message);
        throw error;
    }
};
const resolveSafeAddress = async (hostname) => {
    try {
        const result = (await lookup(hostname));
        const address = typeof result === 'string' ? result : result.address;
        if (isPrivateIP(address)) {
            logger.warn(`[Probe] Blocked private IP access to ${hostname} (${address})`);
            throw new Error(`Private address access forbidden: ${hostname}`);
        }
        return address;
    }
    catch (error) {
        if (error.message?.includes('forbidden')) {
            throw error;
        }
        logger.warn(`[Probe] DNS lookup failed for ${hostname}:`, error.message);
        throw new Error(`DNS resolution failed: Host not found ${hostname}`);
    }
};
/**
 * Resolves target info including SRV and IPv4/IPv6 safety
 */
const resolveTargetInfo = async (hostname, port, bedrock) => {
    let targetAddress;
    let targetPort = port;
    let srvRecord = null;
    try {
        let srvResults = [];
        if (!bedrock && port === 25565) {
            // Java Edition uses _minecraft._tcp
            srvResults = await resolveSrv(`_minecraft._tcp.${hostname}`);
        }
        else if (bedrock && port === 19132) {
            // Bedrock Edition uses _minecraft._udp
            srvResults = await resolveSrv(`_minecraft._udp.${hostname}`);
        }
        if (srvResults && srvResults.length > 0) {
            const srv = srvResults[0];
            // Resolve the SRV target hostname to IP
            // Check for private IP to prevent SSRF via SRV records
            targetAddress = await resolveSafeAddress(srv.name);
            targetPort = srv.port;
            srvRecord = { host: srv.name, port: srv.port };
            logger.debug(`[Probe] SRV resolved: ${hostname} -> ${srv.name}:${srv.port}`);
        }
        else {
            targetAddress = await resolveSafeAddress(hostname);
        }
    }
    catch (e) {
        // If SRV lookup fails or returns empty, fallback to A/AAAA record
        if (e.code !== 'ENOTFOUND' && e.code !== 'ENODATA') {
            logger.debug(`[Probe] SRV lookup error for ${hostname}:`, e.message);
        }
        targetAddress = await resolveSafeAddress(hostname);
    }
    return { targetAddress, targetPort, srvRecord };
};
/**
 * Perform direct status probe with retries
 */
const performDirectProbe = async (targetAddress, targetPort, bedrock) => {
    let lastError = null;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            if (bedrock) {
                return await mcutil.statusBedrock(targetAddress, targetPort, { timeout: 5000 });
            }
            return await mcutil.status(targetAddress, targetPort, {
                timeout: 5000,
                enableSRV: false
            });
        }
        catch (err) {
            lastError = err;
            if (i < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }
        }
    }
    throw lastError;
};
/**
 * Get Minecraft server status
 * @param host Server address
 * @param bedrock Whether it's a Bedrock server
 * @returns Server status info
 */
export const getMinecraftServerStatus = async (host, bedrock) => {
    const cacheKey = `${host}:${bedrock}`;
    const now = Date.now();
    const cached = statusCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL) {
        logger.debug(`[Probe] Cache hit for ${host}`);
        return cached.status;
    }
    const [hostname, portStr] = host.split(':');
    const defaultPort = bedrock ? 19132 : 25565;
    const port = portStr ? Number.parseInt(portStr, 10) : defaultPort;
    const { targetAddress, targetPort, srvRecord } = await resolveTargetInfo(hostname, port, bedrock);
    try {
        const mcsrvstatHost = targetAddress === hostname ? hostname : targetAddress;
        const status = await getMcsrvstatStatus(mcsrvstatHost, targetPort, bedrock);
        statusCache.set(cacheKey, { status, timestamp: Date.now() });
        return status;
    }
    catch (mcsrvstatError) {
        logger.debug(`[Probe] mcsrvstat failed for ${host}, falling back to direct probe:`, mcsrvstatError.message);
        try {
            const result = await performDirectProbe(targetAddress, targetPort, bedrock);
            if (!result)
                throw new Error('Minecraft server probe returned no data.');
            // Type-safe property access: sample and favicon are Java-only in this context
            let playersList = [];
            let favicon = null;
            if (!bedrock) {
                const javaRes = result;
                if (javaRes.players.sample) {
                    playersList = javaRes.players.sample.map(p => ({ name_raw: p.name, uuid: p.id }));
                }
                favicon = javaRes.favicon || null;
            }
            const status = {
                online: true,
                host: hostname,
                port: port,
                version: {
                    name_raw: result.version?.name || (bedrock ? 'Bedrock' : 'Java'),
                    protocol: result.version?.protocol || 0,
                },
                players: {
                    online: result.players.online,
                    max: result.players.max,
                    list: playersList,
                },
                motd: {
                    raw: result.motd?.raw || '',
                    clean: result.motd?.clean || '',
                    html: result.motd?.html || '',
                },
                favicon: favicon,
                srv_record: srvRecord,
            };
            statusCache.set(cacheKey, { status, timestamp: Date.now() });
            return status;
        }
        catch (err) {
            const offlineStatus = { online: false, host: hostname, port: port, error: err?.message || 'Server unreachable' };
            // Cache negative results for a shorter time (e.g., 10 seconds)
            statusCache.set(cacheKey, { status: offlineStatus, timestamp: Date.now() - (CACHE_TTL - 10000) });
            throw new Error(`Failed to probe server ${host}: ${err?.message || 'Server unreachable'}`);
        }
    }
};
/**
 * Parallel probe multiple Minecraft servers
 * @param servers Server list
 * @param maxConcurrent Max concurrency (default 10)
 * @returns Array of probe results
 */
export const getMultipleServerStatus = async (servers, maxConcurrent = MAX_CONCURRENT_PROBES) => {
    logger.info(`[ParallelProbe] Starting parallel probe for ${servers.length} servers with max ${maxConcurrent} concurrent requests`);
    const startTime = Date.now();
    const results = new Array(servers.length);
    let currentIndex = 0;
    const probeWorker = async () => {
        while (true) {
            const index = currentIndex++;
            if (index >= servers.length)
                break;
            const server = servers[index];
            const serverStartTime = Date.now();
            try {
                const status = await Promise.race([
                    getMinecraftServerStatus(server.host, server.bedrock),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Probe timeout')), PROBE_TIMEOUT_MS))
                ]);
                const duration = Date.now() - serverStartTime;
                logger.debug(`[ParallelProbe] OK: ${server.host} - Online (${duration}ms)`);
                results[index] = {
                    id: server.id,
                    host: server.host,
                    bedrock: server.bedrock,
                    status,
                    duration
                };
            }
            catch (error) {
                const duration = Date.now() - serverStartTime;
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.warn(`[ParallelProbe] ERR: ${server.host} - Failed (${duration}ms): ${errorMsg}`);
                results[index] = {
                    id: server.id,
                    host: server.host,
                    bedrock: server.bedrock,
                    status: { online: false },
                    error: errorMsg,
                    duration
                };
            }
        }
    };
    // Launch workers
    const workers = new Array(Math.min(maxConcurrent, servers.length))
        .fill(null)
        .map(() => probeWorker());
    await Promise.all(workers);
    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r?.status?.online).length;
    logger.info(`[ParallelProbe] Completed: ${successCount}/${servers.length} online, ${totalDuration}ms total`);
    return results;
};
//# sourceMappingURL=minecraftProbeService.js.map