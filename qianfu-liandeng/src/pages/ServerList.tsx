import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/request';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT } from '@/store/uiStore';
import StatusWrapper from '@/components/StatusWrapper';
import ServerCard from '@/components/ServerCard';
import { useBackendHealth } from '@/hooks/useBackendHealth';

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

const ServerList: React.FC = () => {
  const t = useT();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>(categories[0]);
  const { backendDegraded, isLoading: backendHealthLoading } = useBackendHealth();

  const { data: servers, isLoading, isError, refetch } = useQuery({
    queryKey: ['servers', search, activeCategory],
    queryFn: () => request<any[]>('/public/servers', {
      params: {
        category: categoryValues[activeCategory],
        search: search.trim() || undefined,
        limit: 60,
      },
      useAuth: false,
    }),
  });

  const publicDirectoryDegraded = backendDegraded || isError;
  const publicDirectoryChecking = !publicDirectoryDegraded && (backendHealthLoading || isLoading);
  const showUnavailableState = publicDirectoryDegraded && !(servers?.length);

  const displayedServers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = servers ?? [];
    if (!q) return base;
    return base.filter((server: any) => [server.name, server.description, ...(server.tags || [])].join(' ').toLowerCase().includes(q));
  }, [search, servers]);

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
    <div className="max-w-[1400px] mx-auto px-8 pt-20 pb-16 bg-white selection:bg-black selection:text-white">
      {/* Search & Meta Header */}
      <div className="space-y-10 mb-16">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-sm italic shadow-xl shadow-black/10">
                   {statusChipLabel}
                </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">{protocolLabel}</span>
               </div>
            </div>
            <h1 className="text-8xl font-black tracking-tighter text-black uppercase italic leading-[0.9]">{t('discovery.title')}</h1>
            <p className="text-zinc-400 text-lg font-bold italic border-l-2 border-zinc-100 pl-8 max-w-xl">
               {summaryText}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full xl:w-auto">
            <div className="relative group w-full sm:w-[500px]">
              <GeometricLantern variant="spark" className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-100 group-focus-within:text-black transition-all duration-500" />
              <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-black rounded-[2.5rem] transition-all duration-500 outline-hidden text-lg font-black italic tracking-tight shadow-xs group-hover:bg-zinc-50"
                placeholder={t('discovery.search.placeholder')}
              />
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="p-7 border border-zinc-100 rounded-[2.5rem] hover:bg-black hover:text-white transition-all duration-700 shadow-xs group"
              aria-label="刷新服务器列表"
            >
               <GeometricLantern variant="settings" className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
            </button>
          </div>
        </div>

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
                    onClick={() => setActiveCategory(catKey)}
                    className={`px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-500 italic ${
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
      </div>

      <section className="mb-14 rounded-[2rem] border border-zinc-100 bg-zinc-50/70 p-6 sm:p-8">
        <div className="max-w-4xl space-y-3">
          <div className="text-[10px] font-black uppercase tracking-[0.45em] italic text-zinc-400">公开索引</div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">Minecraft 服务器公开列表</h2>
          <p className="text-sm sm:text-base text-zinc-500 font-medium leading-7">
            这里汇总已公开的服务器名称、分类、标签、版本、在线状态和简介，方便玩家按关键词和玩法筛选目标服务器。
          </p>
        </div>
      </section>

      {/* Grid Content */}
      <StatusWrapper
        isLoading={!showUnavailableState && isLoading}
        isError={showUnavailableState}
        isEmpty={!isLoading && !!servers && servers.length === 0}
        onRetry={() => refetch()}
        loadingType="skeleton"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12 md:gap-14 xl:gap-16">
          {displayedServers.map((server: any, idx: number) => (
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

      {/* Status Bar */}
      <div className="mt-24 flex flex-col items-center gap-6">
         <div className="flex items-center gap-12 opacity-20 group">
            <div className="flex items-center gap-4">
               <GeometricLantern variant="terminal" className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">{bufferLabel}</span>
            </div>
            <div className="w-32 h-[1px] bg-zinc-200" />
            <div className="flex items-center gap-4 text-right">
               <span className="text-[10px] font-black uppercase tracking-[0.5em] italic text-right">{loadedCountLabel}</span>
               <GeometricLantern variant="network" className="w-4 h-4" />
            </div>
         </div>
      </div>
    </div>
  );
};

export default ServerList;
