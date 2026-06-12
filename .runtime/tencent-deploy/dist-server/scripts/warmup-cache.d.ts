/**
 * 缓存预热脚本
 * 目的：在系统启动或定期执行，提前填充高频访问的 Redis 缓存，减少冷启动压力
 */
declare function warmUpCache(): Promise<void>;
export { warmUpCache };
//# sourceMappingURL=warmup-cache.d.ts.map