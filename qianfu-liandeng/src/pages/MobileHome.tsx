import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Search, Send, Server, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from '@/api/request';
import { toArray } from '@/utils/apiData';

const quickActions: { name: string; Icon: LucideIcon; path: string; color: string }[] = [
  { name: '找服', Icon: Server, path: '/servers', color: 'bg-blue-500' },
  { name: '发布', Icon: Send, path: '/editor', color: 'bg-green-500' },
  { name: '支付', Icon: CreditCard, path: '/payment', color: 'bg-orange-500' },
  { name: '搜索', Icon: Search, path: '/search', color: 'bg-black' },
];

const MobileHome: React.FC = () => {
  const navigate = useNavigate();
  const { data: featuredServerResponse, isLoading } = useQuery({
    queryKey: ['mobile-featured-servers'],
    queryFn: () => request<any>('/public/servers', { params: { limit: 3, sortBy: 'activity', sortOrder: 'desc' }, useAuth: false }),
    staleTime: 60_000,
    retry: 1,
  });
  const featuredServers = toArray<any>(featuredServerResponse);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="px-2 pb-8 pt-3 space-y-7">
         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-4"
         >
            <h1 className="text-4xl font-black tracking-tighter leading-none">
               发现下一台 <br />
               <span className="text-muted-foreground">想加入的服务器</span>
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
               在手机上快速找服、发布、充值和查看精选内容。
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
              type="text" 
              placeholder="搜索服务器..." 
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                }
              }}
              className="w-full pl-11 pr-4 py-4 bg-muted border-none rounded-xl text-sm font-bold"
            />
         </form>
      </section>

      {/* Quick Access Grid */}
      <section className="grid grid-cols-2 gap-3 px-2 py-4">
         {quickActions.map(item => {
           const Icon = item.Icon;
           return (
           <Link 
             key={item.name}
             to={item.path}
             className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white p-4 active:scale-95 transition-transform"
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
      <section className="space-y-6 px-2 pb-10 pt-32 min-[390px]:pt-12">
         <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/95 py-2">
            <h2 className="text-xl font-black uppercase tracking-tight">精选推荐</h2>
            <Link to="/servers" className="shrink-0 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground active:bg-zinc-100">查看全部</Link>
         </div>

         {isLoading ? (
           <div className="rounded-2xl border border-border p-6 text-sm font-bold text-muted-foreground">加载中...</div>
         ) : featuredServers.length === 0 ? (
           <div className="rounded-2xl border border-dashed border-border p-6 text-sm font-bold text-muted-foreground">暂无已审核服务器</div>
         ) : (
         <div className="space-y-4">
            {featuredServers.map((server: any) => (
              <Link key={server.id} to={`/server/${server.id}`} className="flex gap-4 p-4 border border-border rounded-2xl active:bg-muted transition-colors">
                 <div className="w-20 h-20 bg-muted rounded-xl shrink-0 overflow-hidden">
                   {server.thumbnail ? <img src={server.thumbnail} alt={server.name} className="w-full h-full object-cover" /> : null}
                 </div>
                 <div className="flex-grow space-y-1">
                    <h3 className="font-bold">{server.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase rounded">{server.category || '服务器'}</span>
                       <span className="text-[10px] font-mono text-muted-foreground">{server.supported_versions || server.version || '版本未填'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                       <span className="text-[10px] font-bold text-muted-foreground">在线 {server.status?.playersOnline ?? server.players ?? 0} 人</span>
                    </div>
                 </div>
                 <div className="self-center">
                    <span className="text-lg font-black text-muted-foreground">›</span>
                 </div>
              </Link>
            ))}
         </div>
         )}
      </section>
    </div>
  );
};

export default MobileHome;
