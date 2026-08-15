import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Send, Server, Ticket, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '@/api/request';
import { toArray } from '@/utils/apiData';
import type { ServerListItem } from '@/types/server';
import { getServerName, getServerPlayersOnline, getServerThumbnail, getServerVersionLabel } from '@/utils/serverView';

const quickActions: { name: string; Icon: LucideIcon; path: string; color: string }[] = [
  { name: '找服', Icon: Server, path: '/servers', color: 'bg-blue-500' },
  { name: '发布', Icon: Send, path: '/editor', color: 'bg-green-500' },
  { name: '搜索', Icon: Search, path: '/search', color: 'bg-black' },
  { name: '工单', Icon: Ticket, path: '/tickets', color: 'bg-sky-500' },
];

const MobileHome: React.FC = () => {
  const navigate = useNavigate();
  const { data: featuredServerResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['mobile-featured-servers'],
     queryFn: () => request<ServerListItem[]>('/public/servers', { params: { limit: 3, sortBy: 'activity', sortOrder: 'desc' }, useAuth: false }),
    staleTime: 60_000,
    retry: 1,
  });
   const featuredServers = toArray<ServerListItem>(featuredServerResponse);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="space-y-6 px-1 pb-6 pt-2">
         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-4"
         >
            <h1 className="text-[2rem] font-black leading-[0.98] tracking-tight">
               发现下一台 <br />
               <span className="text-muted-foreground">想加入的服务器</span>
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
               在手机上快速找服、发布服务器和提交支持请求。
            </p>
         </motion.div>

         <form
           className="relative"
           onSubmit={(event) => {
             event.preventDefault();
             const form = new FormData(event.currentTarget);
             const q = String(form.get('q') || '').trim();
             navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
           }}
         >
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input 
              name="q"
              type="search"
              aria-label="搜索服务器"
              autoComplete="off"
              placeholder="搜索服务器..." 
              className="w-full pl-11 pr-4 py-4 bg-muted border-none rounded-xl text-sm font-bold"
            />
         </form>
      </section>

      {/* Quick Access Grid */}
       <section className="grid grid-cols-2 gap-3 px-1 py-2">
         {quickActions.map(item => {
           const Icon = item.Icon;
           return (
           <Link 
             key={item.name}
             to={item.path}
              className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white p-4 active:scale-95 transition-transform"
           >
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.color} text-white shadow-lg shadow-black/5`}>
                 <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">{item.name}</span>
           </Link>
           );
         })}
      </section>

      {/* Featured List */}
       <section className="space-y-5 px-1 pb-8 pt-6">
         <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/95 py-2">
            <h2 className="text-xl font-black uppercase tracking-tight">精选推荐</h2>
            <Link to="/servers" className="shrink-0 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground active:bg-zinc-100">查看全部</Link>
         </div>

         {isLoading ? (
           <div className="rounded-2xl border border-border p-6 text-sm font-bold text-muted-foreground">加载中...</div>
         ) : isError ? (
           <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">
             <p>精选服务器暂时加载失败，请稍后重试。</p>
             <button type="button" onClick={() => refetch()} className="mt-4 rounded-xl bg-black px-4 py-2 text-xs font-black text-white active:scale-[0.98]">重新加载</button>
           </div>
         ) : featuredServers.length === 0 ? (
           <div className="rounded-2xl border border-dashed border-border p-6 text-sm font-bold text-muted-foreground">暂无已审核服务器</div>
         ) : (
         <div className="space-y-4">
             {featuredServers.map((server) => {
               const name = getServerName(server);
               const thumbnail = getServerThumbnail(server);
               const playersOnline = getServerPlayersOnline(server);
               const isOnline = Boolean(server.status?.online);

               return (
               <Link key={server.id} to={`/server/${server.id}`} className="flex gap-4 p-4 border border-border rounded-2xl active:bg-muted transition-colors">
                  <div className="w-20 h-20 bg-muted rounded-xl shrink-0 overflow-hidden">
                    {thumbnail ? <img src={thumbnail} alt={name} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-grow space-y-1">
                     <h3 className="font-bold">{name}</h3>
                     <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase rounded">{server.category || '服务器'}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{getServerVersionLabel(server)}</span>
                     </div>
                     <div className="flex items-center gap-2 mt-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-zinc-300'}`} />
                        <span className="text-[10px] font-bold text-muted-foreground">{isOnline ? `在线 ${playersOnline} 人` : '当前离线'}</span>
                     </div>
                  </div>
                 <div className="self-center">
                    <span className="text-lg font-black text-muted-foreground">›</span>
                 </div>
               </Link>
               );
             })}
         </div>
         )}
      </section>
    </div>
  );
};

export default MobileHome;
