import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Search, X, SlidersHorizontal, TrendingUp, MapPin, LampDesk, Users, Clock, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/request';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '../../api/rustV2';
import { cn } from '../../utils/cn';
import { toArray } from '../../utils/apiData';
import { LazyImage } from './MobileLazyImage';
import { Skeleton } from './MobileSkeleton';
import { copyText } from '../../utils/clipboard';
import { toast } from '../../hooks/use-toast';
import MobileSelectSheet, { type MobileSelectOption } from './MobileSelectSheet';
import {
  getDiscoveryQuery,
  mergeDiscoveryFilters,
  readDiscoveryFilters,
  toDiscoverySearchParams,
  type DiscoveryFilters,
  type DiscoveryIntent,
} from '../../utils/serverDiscovery';
import {
  getServerName,
  getServerPlayersMax,
  getServerPlayersOnline,
  getServerSummary,
  getServerThumbnail,
  getServerVersionLabel,
  parseListField,
} from '../../utils/serverView';

const hotSearches = ['生存', 'PVP', 'RPG', '模组', '建筑', '科技', '魔法'];
const categories = ['全部', '生存', 'PVP', 'RPG', '小游戏', '创造', '模组'];
const intentOptions: Array<{ id: DiscoveryIntent; label: string }> = [
  { id: 'online', label: '现在就玩' },
  { id: 'players', label: '多人活跃' },
  { id: 'created', label: '刚刚加入' },
  { id: 'all', label: '全部服务器' },
];
const platformOptions: readonly MobileSelectOption<DiscoveryFilters['platform']>[] = [
  { value: '', label: '全部平台' },
  { value: 'java', label: 'Java 版' },
  { value: 'bedrock', label: '基岩版' },
];
const onlineOptions: readonly MobileSelectOption<DiscoveryFilters['online']>[] = [
  { value: '', label: '全部状态' },
  { value: 'true', label: '在线' },
  { value: 'false', label: '离线' },
];
const sortOptions: readonly MobileSelectOption<DiscoveryFilters['sortBy']>[] = [
  { value: 'activity', label: '最近活跃' },
  { value: 'players', label: '在线人数' },
  { value: 'created', label: '最近加入' },
];

type FilterSheet = 'platform' | 'online' | 'sort';

const MobileSearch: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<DiscoveryFilters>(() => readDiscoveryFilters(searchParams), [searchParams]);
  const [query, setQuery] = useState(filters.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<FilterSheet | null>(null);
  const [copiedServerId, setCopiedServerId] = useState<string | number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFilters = (patch: Partial<DiscoveryFilters>) => {
    const next = mergeDiscoveryFilters(filters, patch);
    setSearchParams(toDiscoverySearchParams(next), { replace: true });
    setQuery(next.search);
  };

  const queryParams = useMemo(() => ({ ...getDiscoveryQuery(filters), limit: 20 }), [filters]);

  const { data: serverResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['mobile-search-servers', queryParams],
    queryFn: () => api.get<any>(isRustV2Enabled() ? rustV2Path('/servers') : '/public/servers', queryParams, isRustV2Enabled() ? { ...rustV2RequestOptions, useAuth: false } : { useAuth: false }),
  });
  const servers = toArray<any>(serverResponse);

  const { data: featuredServerResponse, isError: featuredError, refetch: refetchFeatured } = useQuery({
    queryKey: ['mobile-search-featured-servers'],
    queryFn: () => api.get<any>(isRustV2Enabled() ? rustV2Path('/servers') : '/public/servers', { limit: 6, ...(isRustV2Enabled() ? {} : { sortBy: 'activity', sortOrder: 'desc' }) }, isRustV2Enabled() ? { ...rustV2RequestOptions, useAuth: false } : { useAuth: false }),
    staleTime: 60_000,
  });
  const featuredServers = toArray<any>(featuredServerResponse);

  const hasSearched = !!filters.search || !!filters.category || filters.intent !== 'all' || !!filters.platform || !!filters.version || !!filters.online;
  const appliedFilterCount = [filters.platform, filters.online, filters.version].filter(Boolean).length;

  const handleSearch = (text: string) => {
    const next = text.trim();
    updateFilters({ search: next });
  };

  const handleCategoryClick = (cat: string) => {
    updateFilters({ category: cat === '全部' ? '' : cat, intent: 'all' });
  };

  const openPlatformSheet = () => setActiveSheet('platform');
  const openOnlineSheet = () => setActiveSheet('online');
  const openSortSheet = () => setActiveSheet('sort');
  const closeActiveSheet = () => setActiveSheet(null);
  const setPlatform = (platform: DiscoveryFilters['platform']) => updateFilters({ platform });
  const setOnline = (online: DiscoveryFilters['online']) => updateFilters({ intent: 'all', online });
  const setSort = (sortBy: DiscoveryFilters['sortBy']) => updateFilters({ intent: 'all', sortBy });

  const handleCopyAddress = async (event: React.MouseEvent<HTMLButtonElement>, server: any) => {
    event.preventDefault();
    event.stopPropagation();
    const endpoint = String(server?.ip || '').trim();
    if (!endpoint) {
      toast({ title: '该服务器未公开连接地址', variant: 'destructive' });
      return;
    }
    try {
      await copyText(endpoint);
      setCopiedServerId(server.id);
      toast({ title: '服务器地址已复制' });
      window.setTimeout(() => setCopiedServerId(null), 1600);
    } catch {
      toast({ title: '复制失败，请手动查看连接地址', variant: 'destructive' });
    }
  };

  const renderFilterTrigger = (label: string, value: string, onClick: () => void) => (
    <div className="space-y-1">
      <span className="px-1 text-[10px] font-bold text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-white px-3 text-left text-xs font-bold text-zinc-800 transition-colors hover:bg-zinc-50"
      >
        <span className="truncate">{value}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
      </button>
    </div>
  );

  const renderServerCard = (server: any, index: number) => {
    const players = getServerPlayersOnline(server);
    const maxPlayers = getServerPlayersMax(server);
    const tags = parseListField(server.tags);
    const thumbnail = getServerThumbnail(server);
    const online = server?.status?.online ?? server?.online;

    return (
      <motion.div
        key={server.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
      >
        <div className="bg-white rounded-2xl overflow-hidden flex gap-3 p-3 active:opacity-80">
          <Link to={`/server/${server.id}`} className="flex min-w-0 flex-1 gap-3">
          <div className="w-20 h-20 rounded-xl bg-zinc-100 overflow-hidden shrink-0">
            {thumbnail ? (
              <LazyImage src={thumbnail} alt={getServerName(server)} className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="text-sm font-black truncate">{getServerName(server)}</h4>
            <p className="text-xs text-muted-foreground line-clamp-1">{getServerSummary(server)}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 bg-black text-white rounded-md font-bold">
                {server.category || tags[0] || 'SERVER'}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {maxPlayers ? `${players}/${maxPlayers}` : players}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{getServerVersionLabel(server)}</span>
              <span className={cn('flex items-center gap-1', online === true ? 'text-green-500' : online === false ? 'text-red-500' : 'text-zinc-400')}>
                <Clock className="w-3 h-3" />
                {online === true ? '在线' : online === false ? '离线' : '未知'}
              </span>
            </div>
          </div>
          </Link>
          <div className="flex shrink-0 flex-col items-center justify-center gap-1">
            <button
              type="button"
              onClick={(event) => void handleCopyAddress(event, server)}
              aria-label="复制服务器地址"
              title="复制服务器地址"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-100 text-muted-foreground transition-colors hover:border-black hover:text-black"
            >
              {copiedServerId === server.id ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-full bg-gray-50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <h1 className="sr-only">发现服务器</h1>
      <div className="sticky top-0 z-50 bg-gray-50/90 backdrop-blur-xl border-b border-gray-100">
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              name="server-search"
              aria-label="搜索服务器和玩法"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch(query);
                }
              }}
              placeholder="搜索服务器、玩法..."
              className="w-full pl-10 pr-10 py-3 bg-white border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-black/10"
            />
            {query && (
              <button
                type="button"
                aria-label="清除搜索内容"
                onClick={() => {
                  setQuery('');
                  updateFilters({ search: '' });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="flex max-w-full gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0',
                (filters.category || '全部') === cat ? 'bg-black text-white' : 'bg-white text-muted-foreground active:bg-gray-100',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex max-w-full gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {intentOptions.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => updateFilters({ intent: option.id })}
              className={cn(
                'shrink-0 rounded-xl px-3 py-2 text-xs font-black transition-colors',
                filters.intent === option.id ? 'bg-black text-white' : 'bg-white text-muted-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="mobile-server-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-black text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              <span>筛选</span>
              {appliedFilterCount > 0 ? (
                <span className="rounded-full bg-black px-2 py-0.5 text-[10px] text-white">{appliedFilterCount}</span>
              ) : null}
            </span>
            <span className="text-[10px]">{filtersOpen ? '收起' : '展开'}</span>
          </button>

          <AnimatePresence initial={false}>
            {filtersOpen ? (
              <motion.div
                id="mobile-server-filters"
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                className="grid grid-cols-2 gap-2 overflow-hidden"
              >
                {renderFilterTrigger(
                  '服务器平台',
                  platformOptions.find((option) => option.value === filters.platform)?.label || '全部平台',
                  openPlatformSheet,
                )}
                {renderFilterTrigger(
                  '在线状态',
                  onlineOptions.find((option) => option.value === filters.online)?.label || '全部状态',
                  openOnlineSheet,
                )}
                {renderFilterTrigger(
                  '排序方式',
                  sortOptions.find((option) => option.value === filters.sortBy)?.label || '最近活跃',
                  openSortSheet,
                )}
                <label className="col-span-2 space-y-1">
                  <span className="px-1 text-[10px] font-bold text-muted-foreground">服务器版本</span>
                  <input aria-label="服务器版本" value={filters.version} onChange={(event) => updateFilters({ version: event.target.value.trim() })} placeholder="如 1.21.1" className="min-h-11 w-full rounded-xl border-0 bg-white px-3 text-xs font-bold placeholder:text-zinc-300" />
                </label>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <AnimatePresence mode="wait">
          {!hasSearched ? (
            <motion.div
              key="explore"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  热门搜索
                </h3>
                <div className="flex flex-wrap gap-2">
                  {hotSearches.map((term) => (
                    <button
                      type="button"
                      key={term}
                      onClick={() => handleSearch(term)}
                      className="px-4 py-2 bg-white rounded-xl text-xs font-bold text-muted-foreground active:bg-gray-100 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                  <LampDesk className="w-4 h-4" />
                  推荐服务器
                </h3>
                {featuredError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">
                    推荐服务器加载失败。
                    <button type="button" onClick={() => refetchFeatured()} className="ml-3 underline underline-offset-4">重试</button>
                  </div>
                ) : featuredServers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-sm font-bold text-zinc-400 bg-white">
                    暂无已审核服务器
                  </div>
                ) : (
                  <div className="flex max-w-full gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {featuredServers.slice(0, 4).map((server: any) => {
                      const thumbnail = getServerThumbnail(server);
                      return (
                        <Link key={server.id} to={`/server/${server.id}`} className="shrink-0 w-64 bg-white rounded-2xl overflow-hidden shadow-sm">
                          <div className="w-full h-32 bg-zinc-100">
                            {thumbnail ? <LazyImage src={thumbnail} alt={getServerName(server)} className="w-full h-full object-cover" /> : null}
                          </div>
                          <div className="p-3 space-y-2">
                            <h4 className="text-sm font-black truncate">{getServerName(server)}</h4>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {getServerPlayersOnline(server)}
                              </span>
                              <span>{getServerVersionLabel(server)}</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-tight mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  全部服务器
                </h3>
                <div className="space-y-3">
                  {isLoading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : servers.map(renderServerCard)}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">找到 {servers.length} 个结果</p>
                <button type="button" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-muted-foreground">清除筛选</button>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Search className="w-12 h-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground font-bold">搜索失败</p>
                  <button type="button" onClick={() => refetch()} className="px-6 py-3 bg-black text-white text-sm font-bold rounded-xl">
                    重试
                  </button>
                </div>
              ) : servers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Search className="w-12 h-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground font-bold">没有找到相关服务器</p>
                  <button
                    type="button"
                    onClick={() => {
                       setSearchParams(new URLSearchParams(), { replace: true });
                       setQuery('');
                    }}
                    className="px-6 py-3 bg-black text-white text-sm font-bold rounded-xl"
                  >
                    重新开始
                  </button>
                </div>
              ) : (
                <div className="space-y-3">{servers.map(renderServerCard)}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MobileSelectSheet
        open={activeSheet === 'platform'}
        title="选择服务器平台"
        value={filters.platform}
        options={platformOptions}
        onChange={setPlatform}
        onClose={closeActiveSheet}
      />
      <MobileSelectSheet
        open={activeSheet === 'online'}
        title="选择在线状态"
        value={filters.online}
        options={onlineOptions}
        onChange={setOnline}
        onClose={closeActiveSheet}
      />
      <MobileSelectSheet
        open={activeSheet === 'sort'}
        title="选择排序方式"
        value={filters.sortBy}
        options={sortOptions}
        onChange={setSort}
        onClose={closeActiveSheet}
      />
    </div>
  );
};

export default MobileSearch;
