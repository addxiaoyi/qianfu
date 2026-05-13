import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/request';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT } from '@/store/uiStore';
import StatusWrapper from '@/components/StatusWrapper';
import ServerCard from '@/components/ServerCard';

const categories = [
  'discovery.cat.all',
  'discovery.cat.survival',
  'discovery.cat.creative',
  'discovery.cat.hardcore',
  'discovery.cat.minigames',
  'discovery.cat.roleplay',
] as const;

const ServerList: React.FC = () => {
  const t = useT();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>(categories[0]);

  const { data: servers, isLoading, isError, refetch } = useQuery({
    queryKey: ['servers', search, activeCategory],
    queryFn: () => request<any[]>('/public/servers'),
  });

  const displayedServers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = servers ?? [];
    if (!q) return base;
    return base.filter((server: any) => [server.name, server.description, ...(server.tags || [])].join(' ').toLowerCase().includes(q));
  }, [search, servers]);

  return (
    <div className="max-w-[1400px] mx-auto px-8 pt-20 pb-16 bg-white selection:bg-black selection:text-white">
      {/* Search & Meta Header */}
      <div className="space-y-10 mb-16">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-sm italic shadow-xl shadow-black/10">
                   {t('discovery.status_live')}
                </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">{t('discovery.protocol')}</span>
               </div>
            </div>
            <h1 className="text-8xl font-black tracking-tighter text-black uppercase italic leading-[0.9]">{t('discovery.title')}</h1>
            <p className="text-zinc-400 text-lg font-bold italic border-l-2 border-zinc-100 pl-8 max-w-xl">
               {t('discovery.status').replace('{count}', '1,240')}
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
            <button className="p-7 border border-zinc-100 rounded-[2.5rem] hover:bg-black hover:text-white transition-all duration-700 shadow-xs group">
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
                  <button
                    key={catKey}
                    onClick={() => setActiveCategory(catKey)}
                    className={`px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-500 italic ${
                      activeCategory === label
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

      {/* Grid Content */}
      <StatusWrapper
        isLoading={isLoading}
        isError={isError}
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

      {/* Pagination / Status Bar */}
      <div className="mt-48 flex flex-col items-center gap-12">
         <div className="flex items-center gap-12 opacity-20 group">
            <div className="flex items-center gap-4">
               <GeometricLantern variant="terminal" className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-[0.5em] italic">{t('discovery.buffer')}</span>
            </div>
            <div className="w-32 h-[1px] bg-zinc-200" />
            <div className="flex items-center gap-4 text-right">
               <span className="text-[10px] font-black uppercase tracking-[0.5em] italic text-right">{t('common.page')}: 01 / 24</span>
               <GeometricLantern variant="network" className="w-4 h-4" />
            </div>
         </div>
         <button className="group px-16 py-8 border border-zinc-100 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] hover:bg-black hover:text-white transition-all duration-700 shadow-xs hover:shadow-2xl hover:shadow-black/20 italic flex items-center gap-6">
            {t('discovery.load_more')} <ChevronRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" />
         </button>
      </div>
    </div>
  );
};

export default ServerList;
