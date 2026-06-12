export declare const startCacheCleanup: () => void;
export declare const stopCacheCleanup: () => void;
interface ServerProbeRequest {
    host: string;
    bedrock: boolean;
    id?: string;
}
interface ServerProbeResult {
    id?: string;
    host: string;
    bedrock: boolean;
    status: any;
    error?: string;
    duration: number;
}
/**
 * Get Minecraft server status
 * @param host Server address
 * @param bedrock Whether it's a Bedrock server
 * @returns Server status info
 */
export declare const getMinecraftServerStatus: (host: string, bedrock: boolean) => Promise<any>;
/**
 * Parallel probe multiple Minecraft servers
 * @param servers Server list
 * @param maxConcurrent Max concurrency (default 10)
 * @returns Array of probe results
 */
export declare const getMultipleServerStatus: (servers: ServerProbeRequest[], maxConcurrent?: number) => Promise<ServerProbeResult[]>;
export {};
//# sourceMappingURL=minecraftProbeService.d.ts.map