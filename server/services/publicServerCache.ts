import { redisService } from './redisService';
import { cacheDelete } from './cache';

const GLOBAL_STATS_CACHE_KEY = 'global:stats';
const SERVER_CACHE_PREFIX = 'server:info:';
const PUBLIC_SERVERS_CACHE_PREFIX = 'server:public_list:';

/** Clear all public server list / detail caches (Redis + in-memory). */
export async function clearPublicServersCache(): Promise<void> {
  await redisService.del(GLOBAL_STATS_CACHE_KEY);
  await redisService.del('global_stats');
  cacheDelete(GLOBAL_STATS_CACHE_KEY);
  cacheDelete('global_stats');
  await redisService.delByPattern(SERVER_CACHE_PREFIX + '*');
  await redisService.delByPattern(PUBLIC_SERVERS_CACHE_PREFIX + '*');
  await redisService.delByPattern('public_servers_*');
  await redisService.del('admin:review_stats');
}
