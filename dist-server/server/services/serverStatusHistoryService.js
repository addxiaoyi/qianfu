import localPrisma from '../localDb';
import { logger } from '../utils/logger';
const lastWriteAt = new Map();
const MIN_INTERVAL_MS = 90_000;
function extractProbeMetrics(status) {
    const online = Boolean(status.online);
    const players = status.players;
    const versionObj = status.version;
    let versionRaw = null;
    if (typeof versionObj === 'string')
        versionRaw = versionObj;
    else if (versionObj && typeof versionObj === 'object') {
        versionRaw = versionObj.name_raw || versionObj.name || null;
    }
    const latencyMs = typeof status.latencyMs === 'number'
        ? status.latencyMs
        : typeof status.ping === 'number'
            ? status.ping
            : null;
    return {
        online,
        playersOnline: players?.online ?? null,
        playersMax: players?.max ?? null,
        latencyMs,
        versionRaw,
    };
}
/**
 * Append one history row if throttle allows (per server).
 */
export async function tryRecordServerStatusHistory(serverId, statusPayload) {
    const now = Date.now();
    const prev = lastWriteAt.get(serverId) ?? 0;
    if (now - prev < MIN_INTERVAL_MS)
        return;
    const m = extractProbeMetrics(statusPayload);
    try {
        await localPrisma.serverStatusHistory.create({
            data: {
                server_id: serverId,
                online: m.online,
                players_online: m.playersOnline,
                players_max: m.playersMax,
                latency_ms: m.latencyMs,
                version_raw: m.versionRaw,
            },
        });
        lastWriteAt.set(serverId, now);
    }
    catch (e) {
        logger.warn('[ServerStatusHistory] insert failed', { serverId, error: e.message });
    }
}
export async function listServerStatusHistory(serverId, since) {
    return localPrisma.serverStatusHistory.findMany({
        where: { server_id: serverId, sampled_at: { gte: since } },
        orderBy: { sampled_at: 'asc' },
        select: {
            sampled_at: true,
            online: true,
            players_online: true,
            players_max: true,
            latency_ms: true,
            version_raw: true,
        },
    });
}
/** Bucket into time windows for charts (ms timestamps + aggregated max players_online in bucket). */
export function aggregateHistoryPoints(rows, bucketMs) {
    if (rows.length === 0)
        return [];
    const map = new Map();
    for (const r of rows) {
        const t = Math.floor(r.sampled_at.getTime() / bucketMs) * bucketMs;
        const online = r.players_online ?? 0;
        const cur = map.get(t) || { sum: 0, count: 0, max: 0 };
        cur.sum += online;
        cur.count += 1;
        cur.max = Math.max(cur.max, online);
        map.set(t, cur);
    }
    return [...map.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, v]) => ({
        t,
        online: v.count ? Math.round(v.sum / v.count) : 0,
        maxInBucket: v.max,
    }));
}
//# sourceMappingURL=serverStatusHistoryService.js.map