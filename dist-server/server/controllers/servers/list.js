import localPrisma from '../../localDb';
import prisma from '../../db';
import crypto from 'crypto';
import { paginationQuerySchema } from '../../utils/validation';
import { AppError, ErrorCode } from '../../utils/errors';
import { sendListResponse } from '../../utils/response';
import { redisService } from '../../services/redisService';
import { logger } from '../../utils/logger';
import { buildDateRange, buildKeywordOrConditions, buildPagination, normalizeKeyword, resolveSortField, resolveSortOrder, } from '../../utils/queryBuilder';
import { PUBLIC_SERVERS_CACHE_PREFIX, PUBLIC_SERVERS_TTL, SERVER_LIST_SELECTION, SERVER_ORDER_BY, } from './shared';
/**
 * List all approved public servers
 */
export const listAllServers = async (req, res, next) => {
    try {
        const queryValidation = paginationQuerySchema.safeParse(req.query);
        if (!queryValidation.success) {
            throw new AppError('Invalid query parameters', 400, ErrorCode.VALIDATION_ERROR, false, queryValidation.error.issues);
        }
        const { page, limit, search, tag, bedrock, host, sortBy, sortOrder, version, online, status, category, platform, online_mode, fuzzy, startDate, endDate, } = queryValidation.data;
        const { skip, take } = buildPagination({ page, limit });
        const keyword = normalizeKeyword(search);
        // Use hash for cache key to ensure fixed length and handle long search strings
        const cacheKeyParts = [
            page,
            limit,
            keyword || '',
            tag || '',
            bedrock || '',
            host || '',
            sortBy || '',
            sortOrder || '',
            version || '',
            online || '',
            status || '',
            category || '',
            platform || '',
            online_mode || '',
            fuzzy ? 'fuzzy' : 'exact',
            startDate?.toISOString() || '',
            endDate?.toISOString() || '',
        ];
        const cacheKeyHash = crypto.createHash('md5').update(JSON.stringify(cacheKeyParts)).digest('hex');
        const cacheKey = `${PUBLIC_SERVERS_CACHE_PREFIX}${cacheKeyHash}`;
        const cached = await redisService.get(cacheKey);
        if (cached) {
            return sendListResponse(res, cached.servers, cached.total, page, limit, { resource: 'Server' });
        }
        const where = { review_status: 'APPROVED' };
        const andConditions = [];
        if (keyword) {
            andConditions.push({
                OR: buildKeywordOrConditions(['name', 'name_en', 'summary', 'summary_en', 'tags', 'ip'], keyword, fuzzy),
            });
        }
        if (tag && tag !== 'all') {
            where.tags = { contains: tag };
        }
        if (platform === 'java') {
            andConditions.push({
                OR: [
                    { platform: 'java' },
                    {
                        AND: [
                            { OR: [{ platform: null }, { platform: '' }] },
                            {
                                NOT: {
                                    OR: [
                                        { tags: { contains: 'bedrock' } },
                                        { tags: { contains: '基岩' } },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            });
        }
        else if (platform === 'bedrock' || bedrock) {
            andConditions.push({
                OR: [
                    { platform: 'bedrock' },
                    { tags: { contains: 'bedrock' } },
                    { tags: { contains: '基岩' } },
                    { name: { contains: '基岩' } },
                    { summary: { contains: '基岩' } },
                ],
            });
        }
        if (category && category !== 'all') {
            andConditions.push({
                OR: [{ category }, { tags: { contains: category } }],
            });
        }
        if (online_mode === 'yes') {
            andConditions.push({ online_mode: true });
        }
        else if (online_mode === 'no') {
            andConditions.push({ online_mode: false });
        }
        if (host) {
            where.ip = fuzzy ? { contains: host } : { equals: host };
        }
        if (version) {
            andConditions.push({
                OR: [
                    { status: { versionNameRaw: fuzzy ? { contains: version } : { equals: version } } },
                    { supported_versions: fuzzy ? { contains: version } : { equals: version } },
                ],
            });
        }
        if (online === 'true') {
            andConditions.push({ status: { online: true } });
        }
        else if (online === 'false') {
            andConditions.push({ status: { online: false } });
        }
        if (status === 'online') {
            andConditions.push({ status: { online: true } });
        }
        else if (status === 'offline') {
            andConditions.push({ status: { online: false } });
        }
        else if (status === 'unknown') {
            andConditions.push({
                OR: [
                    { status: { is: null } },
                ],
            });
        }
        const range = buildDateRange({ startDate, endDate });
        if (range) {
            where.updated_at = range;
        }
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }
        const normalizedSortBy = resolveSortField(sortBy, ['activity', 'updated', 'created', 'players', 'name'], 'activity');
        const normalizedSortOrder = resolveSortOrder(sortOrder, 'desc');
        const safeOrderBy = (() => {
            if (!normalizedSortBy)
                return SERVER_ORDER_BY;
            switch (normalizedSortBy) {
                case 'name':
                    return [{ name: normalizedSortOrder }, { updated_at: 'desc' }];
                case 'players':
                    return [{ status: { playersOnline: normalizedSortOrder } }, { updated_at: 'desc' }];
                case 'updated':
                    return [{ updated_at: normalizedSortOrder }];
                case 'created':
                    return [{ created_at: normalizedSortOrder }];
                case 'activity':
                default:
                    return [{ activity: normalizedSortOrder }, { updated_at: 'desc' }];
            }
        })();
        const safeSelect = SERVER_LIST_SELECTION;
        try {
            logger.debug(`[Servers] Querying local database for public list...`);
            const servers = await localPrisma.server.findMany({
                where,
                select: safeSelect,
                orderBy: safeOrderBy,
                skip,
                take,
            });
            const total = await localPrisma.server.count({ where });
            logger.debug(`[Servers] Successfully retrieved ${servers.length} servers (total: ${total}) from local DB`);
            // 存入 Redis 缓存 (TTL: 1分钟)
            await redisService.set(cacheKey, { servers, total }, PUBLIC_SERVERS_TTL);
            return sendListResponse(res, servers, total, page, limit, { resource: 'Server' });
        }
        catch (dbError) {
            logger.warn('[Servers] Local DB query failed, falling back to main DB', {
                error: dbError instanceof Error ? dbError.message : String(dbError),
            });
            try {
                const servers = await prisma.server.findMany({
                    where,
                    select: safeSelect,
                    orderBy: safeOrderBy,
                    skip,
                    take,
                });
                const total = await prisma.server.count({ where });
                // 存入 Redis 缓存 (TTL: 1分钟)
                await redisService.set(cacheKey, { servers, total }, PUBLIC_SERVERS_TTL);
                return sendListResponse(res, servers, total, page, limit, { resource: 'Server' });
            }
            catch (mainDbError) {
                logger.error('[Servers] Main DB fallback also failed', {
                    localDbError: dbError instanceof Error ? dbError.message : String(dbError),
                    mainDbError: mainDbError instanceof Error ? mainDbError.message : String(mainDbError),
                });
                logger.warn('[Servers] Returning empty public list as degraded response');
                await redisService.set(cacheKey, { servers: [], total: 0 }, PUBLIC_SERVERS_TTL);
                return sendListResponse(res, [], 0, page, limit, {
                    resource: 'Server',
                    message: 'Degraded: public server list temporarily unavailable',
                });
            }
        }
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=list.js.map