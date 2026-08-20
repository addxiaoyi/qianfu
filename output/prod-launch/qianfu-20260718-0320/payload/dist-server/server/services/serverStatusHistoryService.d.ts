/**
 * Append one history row if throttle allows (per server).
 */
export declare function tryRecordServerStatusHistory(serverId: number, statusPayload: Record<string, unknown>): Promise<void>;
export declare function listServerStatusHistory(serverId: number, since: Date): Promise<Array<{
    sampled_at: Date;
    online: boolean;
    players_online: number | null;
    players_max: number | null;
    latency_ms: number | null;
    version_raw: string | null;
}>>;
/** Bucket into time windows for charts (ms timestamps + aggregated max players_online in bucket). */
export declare function aggregateHistoryPoints(rows: Array<{
    sampled_at: Date;
    players_online: number | null;
    online: boolean;
}>, bucketMs: number): Array<{
    t: number;
    online: number;
    maxInBucket: number;
}>;
//# sourceMappingURL=serverStatusHistoryService.d.ts.map