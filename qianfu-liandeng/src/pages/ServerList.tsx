import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { request } from '@/api/request';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { useT } from '@/store/uiStore';
import StatusWrapper from '@/components/ui/StatusWrapper';
import ServerCard from '@/components/business/ServerCard';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { getServerName, getServerSummary, parseListField } from '@/utils/serverView';
import {
  getDiscoveryQuery,
  mergeDiscoveryFilters,
  readDiscoveryFilters,
  toDiscoverySearchParams,
  type DiscoveryFilters,
  type DiscoveryIntent,
} from '@/utils/serverDiscovery';
import type { ServerListItem } from '@/types/server';
import { normalizeServerListResponse } from '@/utils/frontendResponseNormalization';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

const categories = [
  'discovery.cat.all',
  'discovery.cat.survival',
  'discovery.cat.creative',
  'discovery.cat.hardcore',
  'discovery.cat.minigames',
  'discovery.cat.roleplay',
] as const;

const categoryValues: Record<(typeof categories)[number], string | undefined> = {
  'discovery.cat.all': undefined,
  'discovery.cat.survival': '生存',
  'discovery.cat.creative': '创造',
  'discovery.cat.hardcore': '硬核',
  'discovery.cat.minigames': '小游戏',
  'discovery.cat.roleplay': 'RPG',
};

const intentOptions: Array<{ id: DiscoveryIntent; label: string; description: string }> = [
  { id: 'online', label: '现在就玩', description: '只看当前在线服务器' },
  { id: 'players', label: '多人活跃', description: '按在线人数优先' },
  { id: 'created', label: '刚刚加入', description: '优先查看新加入的服务器' },
  { id: 'all', label: '全部服务器', description: '浏览完整公开目录' },
];

const ServerList: React.FC = () => {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<DiscoveryFilters>(
    () => readDiscoveryFilters(searchParams),
    [searchParams],
  );
  const [showFilters, setShowFilters] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const hasActiveFilters = Boolean(filters.search || filters.category || filters.platform || filters.version || filters.online || filters.intent !== 'all' || filters.sortBy !== 'activity');
  useEffect(() => setSearchDraft(filters.search), [filters.search]);
  const { backendDegraded, isLoading: backendHealthLoading } = useBackendHealth();

  const updateFilters = (patch: Partial<DiscoveryFilters>) => {
    setSearchParams(toDiscoverySearchParams(mergeDiscoveryFilters(filters, patch)), { replace: true });
  };
  const clearFilters = () => setSearchParams(new URLSearchParams(), { replace: true });
  const activeCategory = categories.find((category) => categoryValues[category] === filters.category) || categories[0];

  const { data: servers, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['servers', filters],
    queryFn: async () => {
      const useRustV2 = isRustV2Enabled();
      const response = await request<ServerListItem[]>(useRustV2 ? rustV2Path('/servers') : '/public/servers', {
        params: useRustV2 ? { limit: 100, offset: 0 } : getDiscoveryQuery(filters),
        useAuth: false,
        ...(useRustV2 ? rustV2RequestOptions : {}),
      });
      return normalizeServerListResponse(response);
    },
  });

  const publicDirectoryDegraded = backendDegraded || isError;
  const publicDirectoryChecking = !publicDirectoryDegraded && (backendHealthLoading || isLoading || isFetching);
  const showUnavailableState = publicDirectoryDegraded && !(servers?.length);

  const displayedServers = useMemo(() => {
    const q = filters.search.toLowerCase();
    const base = servers ?? [];
    const filtered = base.filter((server) => {
      const platform = String(server.edition || server.platform || '').toLowerCase();
      const searchable = [getServerName(server), getServerSummary(server), server.ip || '', ...parseListField(server.tags)].join(' ').toLowerCase();
      if (q && !searchable.includes(q)) return false;
      if (filters.category && !searchable.includes(filters.category.toLowerCase())) return false;
      if (filters.platform && platform !== filters.platform) return false;
      if (filters.version && !getServerVersionLabels(server).some((value) => value.includes(filters.version))) return false;
      if (filters.online === 'true' && server.probe_reachable !== true && server.online !== true) return false;
      if (filters.online === 'false' && (server.probe_reachable === true || server.online === true)) return false;
      return true;
    });
    return [...filtered].sort((left, right) => {
      if (filters.sortBy === 'created') return String(right.created_at || '').localeCompare(String(left.created_at || ''));
      return Number(right.players || right.players_online || 0) - Number(left.players || left.players_online || 0);
    });
  }, [filters, servers]);

  const statusChipLabel = isError
    ? t('discovery.status_degraded')
    : publicDirectoryDegraded
      ? t('discovery.status_degraded')
      : publicDirectoryChecking
      ? t('discovery.status_loading')
      : t('discovery.status_live');
  const protocolLabel = publicDirectoryDegraded
    ? t('discovery.protocol_degraded')
    : publicDirectoryChecking
      ? t('discovery.protocol_checking')
      : t('discovery.protocol');
  const summaryText = publicDirectoryDegraded
    ? t('discovery.status_error')
    : publicDirectoryChecking
      ? t('discovery.status_loading_desc')
      : t('discovery.status').replace('{count}', String(displayedServers.length));
  const bufferLabel = publicDirectoryDegraded
    ? t('discovery.buffer_degraded')
    : publicDirectoryChecking
      ? t('discovery.buffer_checking')
      : t('discovery.buffer');
  const loadedCountLabel = publicDirectoryDegraded
    ? t('discovery.loaded_unavailable')
    : publicDirectoryChecking
      ? t('discovery.loaded_pending')
      : t('discovery.loaded_count').replace('{count}', String(displayedServers.length));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-16 bg-white selection:bg-black selection:text-white">
      {/* Search & Meta Header */}
      <div className="space-y-8 mb-10">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-black text-white text-[10px] font-semibold tracking-wide rounded-sm shadow-xl shadow-black/10">
                   {statusChipLabel}
                </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="text-[10px] font-semibold text-zinc-300 tracking-wide">{protocolLabel}</span>
               </div>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-black leading-tight break-words">{t('discovery.title')}</h1>
            <p className="text-zinc-400 text-base font-medium border-l-2 border-zinc-100 pl-6 max-w-xl">
               {summaryText}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full xl:w-auto">
            <form className="relative group w-full sm:w-[440px]" onSubmit={(event) => { event.preventDefault(); updateFilters({ search: searchDraft.trim() }); }}>
              <GeometricLantern variant="spark" className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-100 group-focus-within:text-black transition-all duration-500" />
              <input 
                type="search"
                name="serverSearch"
                aria-label="搜索服务器"
                aria-describedby="server-search-status"
                autoComplete="off"
                spellCheck={false}
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                className="w-full py-5 pl-16 pr-24 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-black focus-visible:ring-4 focus-visible:ring-black/10 rounded-[2rem] transition-[background-color,border-color,box-shadow] duration-300 outline-hidden text-base font-semibold tracking-tight shadow-xs group-hover:bg-zinc-50"
                placeholder={t('discovery.search.placeholder')}
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800">搜索</button>
            </form>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[2rem] border border-zinc-200 px-5 text-sm font-semibold hover:bg-black hover:text-white transition-colors shadow-xs group disabled:cursor-wait disabled:opacity-50"
              aria-label={isFetching ? '正在刷新服务器列表' : '刷新服务器列表'}
              aria-busy={isFetching}
            >
               <GeometricLantern variant="settings" className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
               <span>刷新</span>
            </button>
          </div>
        </div>

        <section aria-label="服务器发现入口" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {intentOptions.map((option) => {
            const active = filters.intent === option.id;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => updateFilters({ intent: option.id })}
                aria-pressed={active}
                className={`min-h-20 rounded-3xl border px-5 py-3.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 ${
                  active
                    ? 'border-black bg-black text-white shadow-xl shadow-black/10'
                    : 'border-zinc-100 bg-white text-zinc-700 hover:border-zinc-300 hover:shadow-md'
                }`}
              >
                <span className="block text-base font-semibold tracking-tight">{option.label}</span>
                <span className={`mt-1 block text-xs font-medium ${active ? 'text-zinc-300' : 'text-zinc-400'}`}>{option.description}</span>
              </button>
            );
          })}
        </section>

        {/* Category Navigation */}
        <div className="flex items-center gap-4 p-2 bg-zinc-50/50 border border-zinc-100 rounded-[3rem] overflow-hidden">
           <div className="px-6 py-4 flex items-center gap-3 border-r border-zinc-200 lg:block hidden">
              <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-300" />
           </div>
           <div className="flex overflow-x-auto gap-2 no-scrollbar px-4 py-2 flex-grow">
              {categories.map((catKey) => {
                const label = t(catKey);
                return (
                  <button type="button"
                    key={catKey}
                    onClick={() => updateFilters({ category: categoryValues[catKey] || '' })}
                    aria-pressed={activeCategory === catKey}
                    className={`px-8 py-4 rounded-[2rem] text-xs font-semibold tracking-tight whitespace-nowrap transition-all duration-500 ${
                      activeCategory === catKey
                        ? 'bg-black text-white shadow-xl shadow-black/20'
                        : 'text-zinc-400 hover:bg-white hover:text-black hover:shadow-xs'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
           </div>
           <div className="px-6 py-4 border-l border-zinc-200 lg:block hidden">
              <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-300" />
           </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:border-black">
            {showFilters ? '收起高级筛选' : '高级筛选'}{hasActiveFilters ? ' · 已启用' : ''}
          </button>
          {hasActiveFilters ? <button type="button" onClick={clearFilters} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-black">清除全部</button> : null}
        </div>

        {showFilters ? <section aria-label="服务器筛选" className="mt-4 grid grid-cols-1 gap-3 rounded-[2rem] border border-zinc-100 bg-white p-3 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="px-1 text-xs font-medium text-zinc-500">服务器平台</span>
            <select
              aria-label="服务器平台"
              value={filters.platform}
              onChange={(event) => updateFilters({ platform: event.target.value as DiscoveryFilters['platform'] })}
              className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-black focus:bg-white"
            >
              <option value="">全部平台</option>
              <option value="java">Java版</option>
              <option value="bedrock">基岩版</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="px-1 text-xs font-medium text-zinc-500">服务器版本</span>
            <input
              type="text"
              aria-label="服务器版本"
              value={filters.version}
              onChange={(event) => updateFilters({ version: event.target.value.trim() })}
              placeholder="如 1.21.1"
              className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none transition placeholder:text-zinc-300 focus:border-black focus:bg-white"
            />
          </label>
          <label className="space-y-2">
            <span className="px-1 text-xs font-medium text-zinc-500">在线状态</span>
            <select
              aria-label="在线状态"
              value={filters.online}
              onChange={(event) => updateFilters({ intent: 'all', online: event.target.value as DiscoveryFilters['online'] })}
              className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-black focus:bg-white"
            >
              <option value="">全部状态</option>
              <option value="true">在线</option>
              <option value="false">离线</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="px-1 text-xs font-medium text-zinc-500">排序方式</span>
            <select
              aria-label="服务器排序"
              value={filters.sortBy}
              onChange={(event) => updateFilters({ intent: 'all', sortBy: event.target.value as DiscoveryFilters['sortBy'] })}
              className="w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-black focus:bg-white"
            >
              <option value="activity">最近活跃</option>
              <option value="players">在线人数</option>
              <option value="created">最近加入</option>
            </select>
          </label>
        </section> : null}
      </div>

      <p id="server-search-status" role="status" aria-live="polite" className="sr-only">
        {isFetching ? '正在更新服务器列表' : `当前显示 ${displayedServers.length} 个服务器`}
      </p>

      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-zinc-100 bg-zinc-50/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-700">服务器目录 · 当前筛选</p>
          <p className="mt-1 truncate text-sm font-medium text-zinc-400">
            {intentOptions.find((option) => option.id === filters.intent)?.label} · {displayedServers.length} 个公开服务器
          </p>
        </div>
        {hasActiveFilters ? <button type="button" onClick={clearFilters} className="shrink-0 self-start rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 transition hover:border-black hover:text-black sm:self-auto">
          清除筛选
        </button> : null}
      </div>

      {/* Grid Content */}
      <StatusWrapper
        isLoading={!showUnavailableState && isLoading}
        isError={showUnavailableState}
        isEmpty={!isLoading && !isFetching && !isError && displayedServers.length === 0}
        onRetry={() => void refetch()}
        loadingType="skeleton"
        emptyTitle={filters.search ? '没有匹配的服务器' : '暂时没有已公开服务器'}
        emptyDescription={filters.search
          ? `没有找到与“${filters.search}”匹配的公开服务器，请尝试更短的关键词或切换筛选。`
          : '当前还没有审核通过的公开服务器。提交资料并通过审核后，会自动长期出现在公开列表中。'}
        emptyAction={filters.search ? (
          <button type="button" onClick={() => updateFilters({ search: '' })} className="rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800">
            清除搜索条件
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link to="/editor" className="rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800">
              发布服务器
            </Link>
            <button type="button" onClick={() => void refetch()} className="rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-50">
              刷新列表
            </button>
          </div>
        )}
      >
        <div aria-label="服务器列表" className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3 xl:gap-12">
          {displayedServers.map((server, idx) => (
            <ServerCard
              key={server.id}
              server={server}
              index={idx}
              protocolLabel={t('detail.protocol.v')}
              nodesOnlineLabel={t('discovery.nodes_online')}
            />
          ))}
        </div>
      </StatusWrapper>

      <section className="mt-12 rounded-[2rem] border border-zinc-100 bg-zinc-50/70 p-5 sm:p-6">
        <div className="max-w-4xl space-y-2">
          <div className="text-[10px] font-semibold tracking-wide text-zinc-400">公开索引</div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Minecraft 服务器公开列表</h2>
          <p className="text-sm text-zinc-500 font-medium leading-7">
            这里汇总已公开的服务器名称、分类、标签、版本、在线状态和简介，方便玩家按关键词和玩法筛选目标服务器。
          </p>
        </div>
      </section>

      {/* Status Bar */}
      <div className="mt-24 flex flex-col items-center gap-6">
         <div className="flex items-center gap-12 opacity-20 group">
            <div className="flex items-center gap-4">
               <GeometricLantern variant="terminal" className="w-4 h-4" />
             <span className="text-[10px] font-semibold tracking-wide">{bufferLabel}</span>
            </div>
            <div className="w-32 h-[1px] bg-zinc-200" />
            <div className="flex items-center gap-4 text-right">
               <span className="text-[10px] font-semibold tracking-wide text-right">{loadedCountLabel}</span>
               <GeometricLantern variant="network" className="w-4 h-4" />
            </div>
         </div>
      </div>
    </div>
  );
};

export default ServerList;
