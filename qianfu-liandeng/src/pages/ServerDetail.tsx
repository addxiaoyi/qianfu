import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import { 
  Heart, ChevronLeft, ChevronRight, Loader2, MessageSquare, 
  Activity, Shield, ThumbsUp, ThumbsDown, Share2,
  Clock, Award, UserCheck, Zap, Globe, Cpu, AlertTriangle, Settings
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT } from '@/store/uiStore';
import PageSeo from '@/components/PageSeo';

const tabs = [
  { id: 'overview', labelKey: 'detail.tabs.overview', icon: Activity },
  { id: 'community', labelKey: 'detail.tabs.community', icon: MessageSquare, count: true },
  { id: 'technical', labelKey: 'detail.tabs.technical', icon: Cpu },
  { id: 'rules', labelKey: 'detail.tabs.rules', icon: Shield },
] as const;

type TabId = (typeof tabs)[number]['id'];

const formatServerMetric = (value: unknown, fallback = '暂无') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const parseServerTags = (tags: unknown): string[] => {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (typeof tags !== 'string' || !tags.trim()) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
};

const stripHtml = (value: unknown) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncateText = (value: unknown, maxLength = 150) => {
  const text = stripHtml(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
};

const ServerDetail: React.FC = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuthStore();
  const t = useT();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const COMMENT_MAX_LENGTH = 2000;

  // 图片 URL 安全验证 - 仅允许 https 协议
  const SAFE_IMAGE_PROTOCOLS = new Set(['https:', 'data:']);
  const isValidImageUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return SAFE_IMAGE_PROTOCOLS.has(parsed.protocol);
    } catch {
      return false;
    }
  };

  const getSafeImageUrl = (url: string | undefined): string => {
    if (!url || !isValidImageUrl(url)) {
      return '/placeholder-server.jpg';
    }
    return url;
  };

  const { data: server, isLoading, isError } = useQuery({
    queryKey: ['server', id],
    queryFn: async () => {
      return await request<any>(`/servers/${id}`);
    },
  });
  const serverTags = useMemo(() => parseServerTags(server?.tags), [server?.tags]);
  const latestComments = Array.isArray(server?.comments) ? server.comments : [];
  const serverName = server?.name || `Minecraft 服务器 ${id || ''}`.trim();
  const serverDescription = truncateText(
    server?.description ||
      [
        serverName,
        server?.category,
        server?.supported_versions || server?.version,
        serverTags.length ? serverTags.join('、') : '',
      ].filter(Boolean).join('，'),
    155,
  );
  const safeSeoImage = getSafeImageUrl(server?.image);
  const technicalCards = [
    { label: t('detail.tech.latency'), value: formatServerMetric(server?.latency ?? server?.status?.latency), icon: Globe, status: server?.online === false ? 'OFFLINE' : 'LIVE' },
    { label: t('detail.tech.uptime'), value: formatServerMetric(server?.uptime), icon: Activity, status: server?.online === false ? 'OFFLINE' : 'RECORDED' },
    { label: t('detail.tech.integrity'), value: server?.review_status || 'UNKNOWN', icon: Shield, status: 'AUDIT' },
  ];
  const rules = [
    server?.online_mode ? { title: '在线模式', desc: String(server.online_mode) } : null,
    server?.network_env ? { title: '网络环境', desc: String(server.network_env) } : null,
    server?.supported_versions ? { title: '支持版本', desc: String(server.supported_versions) } : null,
    server?.category ? { title: '服务器分类', desc: String(server.category) } : null,
    ...serverTags.slice(0, 4).map((tag) => ({ title: '标签规则', desc: tag })),
  ].filter(Boolean) as Array<{ title: string; desc: string }>;

  const handleCopy = () => {
    if (server?.ip) {
       navigator.clipboard.writeText(server.ip);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
       toast({ title: '协议已同步', description: t('detail.side.ip_label') });
    }
  };

  const likeMutation = useMutation({
    mutationFn: () => request(`/servers/${id}/like`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', id] });
      toast({ title: '已点赞该服务器' });
    }
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => request(`/servers/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['server', id] });
      toast({ title: '评论已发布' });
    }
  });

  const TabButton = ({ id, labelKey, icon: Icon, count }: { id: TabId; labelKey: any; icon: any; count?: number }) => (
    <button type="button"
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-4 px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.3em] italic transition-all duration-500 relative overflow-hidden group ${
        activeTab === id ? 'bg-black text-white shadow-2xl shadow-black/20' : 'text-zinc-400 hover:bg-zinc-50 hover:text-black'
      }`}
    >
      <Icon className={`w-4 h-4 ${activeTab === id ? 'text-accent' : 'text-zinc-300 group-hover:text-black'} transition-colors`} />
      {t(labelKey)}
      {count !== undefined && (
        <span className={`ml-2 px-2 py-0.5 rounded-sm text-[8px] ${activeTab === id ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
          {count.toString().padStart(2, '0')}
        </span>
      )}
      {activeTab === id && (
        <motion.div layoutId="tab-glow" className="absolute inset-0 bg-accent/5 pointer-events-none" />
      )}
    </button>
  );

  return (
    <StatusWrapper isLoading={isLoading} isError={isError}>
      {server && (
        <PageSeo
          title={`${serverName} - Minecraft 服务器详情 - 千服联灯`}
          description={serverDescription || `${serverName} 的 Minecraft 服务器资料、状态、版本、标签和玩家评论。`}
          canonicalPath={`/server/${id}`}
          image={safeSeoImage.startsWith('http') ? safeSeoImage : undefined}
          schema={{
            '@context': 'https://schema.org',
            '@type': 'VideoGameServer',
            name: serverName,
            description: serverDescription,
            game: 'Minecraft',
            serverStatus: server?.online === false ? 'Offline' : 'Online',
            playersOnline: Number(server?.players ?? server?.playersOnline ?? server?.status?.playersOnline ?? 0),
            keywords: serverTags,
            url: `https://mc-u.top/server/${id}`,
          }}
        />
      )}
      <div className="max-w-[1400px] mx-auto px-8 pt-20 pb-16 bg-white selection:bg-black selection:text-white">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 italic">
             <Link to="/servers" className="hover:text-black transition-all flex items-center gap-1.5 group">
                <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> 
                {t('detail.nav.back')}
             </Link>
             <span className="opacity-30">/</span>
             <span className="text-black truncate max-w-[200px]">{server?.name}</span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.4em] italic text-zinc-200 hidden md:block">{t('detail.nav.ref')}: {id?.toUpperCase()}</span>
        </div>

        {/* Hero Area */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-16 mb-24">
           {/* Cover Photo */}
           <div className="xl:col-span-8 relative aspect-video rounded-[4rem] overflow-hidden bg-zinc-50 shadow-2xl group border border-zinc-100">
              <img 
                src={getSafeImageUrl(server?.image)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 grayscale group-hover:grayscale-0" 
                alt={server?.name}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-transparent" />
              <div className="absolute bottom-12 left-12 right-12 flex items-end justify-between z-10">
                 <div className="space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2 px-3 py-1 bg-green-500 rounded-sm shadow-[0_0_12px_rgba(34,197,94,0.3)] animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          <span className="text-white text-[9px] font-black uppercase tracking-[0.2em] italic">{t('detail.status.active')}</span>
                       </div>
                       <div className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-sm italic">
                          {t('detail.protocol.v')}{server?.version}
                       </div>
                    </div>
                    <div className="flex items-end gap-12">
                       <h1 className="text-4xl sm:text-6xl lg:text-8xl xl:text-9xl font-black text-white tracking-tighter uppercase italic leading-[0.8] break-words max-w-full">{server?.name}</h1>
                       {isAuthenticated && user?.id === server?.ownerId && (
                         <Link 
                           to={`/editor?id=${id}`}
                           className="mb-2 px-6 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest italic flex items-center gap-3 hover:bg-accent hover:text-white transition-all shadow-2xl active:scale-95"
                         >
                            <Settings className="w-4 h-4" />
编辑服务器
                         </Link>
                       )}
                    </div>
                 </div>
              </div>
              
              <div className="absolute top-12 right-12 flex gap-4">
                 <button type="button" className="w-14 h-14 bg-white/10 backdrop-blur-xl border border-white/20 rounded-[1.2rem] flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90">
                    <Share2 className="w-6 h-6" />
                 </button>
                 <div className="w-14 h-14 bg-white text-black rounded-[1.2rem] flex items-center justify-center shadow-2xl">
                    <GeometricLantern variant="spark" className="w-6 h-6 fill-current" />
                 </div>
              </div>
           </div>

           {/* Quick Stats Sidebar */}
           <div className="xl:col-span-4 grid grid-rows-2 gap-10">
              <div className="bg-black text-white rounded-[4rem] p-12 relative overflow-hidden group shadow-2xl">
                 <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                 <div className="relative z-10 h-full flex flex-col justify-between">
                    <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-600 italic">{t('detail.side.endpoint')}</label>
                       <div className="flex items-center justify-between p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl group/ip">
                          <span className="text-2xl font-black font-mono tracking-tight italic">{server?.ip}</span>
                          <button type="button" onClick={handleCopy} className="p-4 bg-white text-black rounded-xl hover:bg-accent hover:text-white transition-all shadow-xl">
                             {copied ? <Award className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                          </button>
                       </div>
                    </div>
                    <div className="flex justify-between items-end">
                       <div className="space-y-1">
                          <span className="text-6xl font-black font-mono italic leading-none">{server?.players}</span>
                          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">{t('detail.side.nodes_active')}</p>
                       </div>
                       <button type="button" 
                         onClick={() => likeMutation.mutate()}
                         disabled={likeMutation.isPending}
                         className={`p-6 rounded-[1.5rem] border ${server?.isLiked ? 'bg-accent border-accent text-white' : 'border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-500'} transition-all ${likeMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                          {likeMutation.isPending ? <Loader2 className="w-8 h-8 animate-spin" /> : <Heart className={`w-8 h-8 ${server?.isLiked ? 'fill-current' : ''}`} />}
                       </button>
                    </div>
                 </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-100 rounded-[4rem] p-12 flex flex-col justify-between">
                 <div className="flex justify-between items-start">
                    <div className="space-y-2">
                       <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 italic">{t('detail.side.intel')}</h3>
                       <p className="text-xl font-black italic tracking-tighter uppercase leading-tight">{t('detail.side.handshake')}: <span className="text-green-500">{t('detail.side.optimal')}</span></p>
                    </div>
                    <GeometricLantern variant="network" className="w-8 h-8 text-zinc-200" />
                 </div>
                 <div className="grid grid-cols-3 gap-6 pt-8 border-t border-zinc-100">
                    <div className="space-y-1">
                       <span className="text-[9px] font-black text-zinc-300 uppercase italic">{t('detail.tech.latency')}</span>
                       <p className="text-xl font-black italic">{formatServerMetric(server?.latency ?? server?.status?.latency)}</p>
                    </div>
                    <div className="space-y-1">
                       <span className="text-[9px] font-black text-zinc-300 uppercase italic">{t('detail.tech.uptime')}</span>
                       <p className="text-xl font-black italic">{formatServerMetric(server?.uptime)}</p>
                    </div>
                    <div className="space-y-1">
                       <span className="text-[9px] font-black text-zinc-300 uppercase italic">{t('detail.tabs.online')}</span>
                       <p className="text-xl font-black italic">{formatServerMetric(server?.review_status)}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Forum Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-12 p-1.5 bg-zinc-50/80 border border-zinc-100 rounded-[2.5rem] sticky top-20 z-30 backdrop-blur-xl shadow-sm">
           <TabButton id="overview" labelKey="detail.tabs.overview" icon={Activity} />
           <TabButton id="community" labelKey="detail.tabs.community" icon={MessageSquare} count={server?.comments?.length} />
           <TabButton id="technical" labelKey="detail.tabs.technical" icon={Cpu} />
           <TabButton id="rules" labelKey="detail.tabs.rules" icon={Shield} />
           
           <div className="ml-auto hidden items-center gap-4 px-6 border-l border-zinc-100 lg:flex">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300 italic">
                {formatServerMetric(server?.players ?? server?.playersOnline ?? 0, '0')} {t('detail.tabs.online')}
              </span>
           </div>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-16">
           <div className="xl:col-span-8">
              <AnimatePresence mode="wait">
                 {activeTab === 'overview' && (
                    <motion.div 
                      key="overview"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-12"
                    >
                       <section className="space-y-8">
                          <header className="flex items-center gap-6">
                             <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                             <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-zinc-300 italic">{t('detail.overview.mission')}</h2>
                          </header>
                          <div className="p-16 border border-zinc-50 bg-zinc-50/20 rounded-[4rem] shadow-xs relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-12 opacity-5">
                                <GeometricLantern variant="terminal" className="w-48 h-48" />
                             </div>
                             <div className="relative z-10 prose prose-zinc max-w-none">
                                <p className="text-2xl font-bold leading-relaxed italic text-zinc-600 first-letter:text-7xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-black">
                                   {server?.description || t('detail.overview.init_content')}
                                </p>
                             </div>
                          </div>
                       </section>

                       <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="p-12 border border-zinc-100 rounded-[3rem] space-y-6 bg-white shadow-xl shadow-black/5 hover:-translate-y-2 transition-transform duration-500">
                             <div className="flex items-center justify-between">
                                <div className="p-4 bg-zinc-50 rounded-2xl text-black"><Zap className="w-6 h-6" /></div>
                                <span className="text-[10px] font-black text-zinc-200 uppercase tracking-widest italic">{t('detail.overview.feat_primary')}</span>
                             </div>
                             <h3 className="text-2xl font-black italic uppercase tracking-tighter">{t('detail.overview.feat_latency')}</h3>
                             <p className="text-zinc-400 font-bold italic leading-relaxed text-sm">
                               {server?.ip ? `当前连接地址：${server.ip}` : '该服务器暂未公开连接地址。'}
                             </p>
                          </div>
                          <div className="p-12 border border-zinc-100 rounded-[3rem] space-y-6 bg-white shadow-xl shadow-black/5 hover:-translate-y-2 transition-transform duration-500">
                             <div className="flex items-center justify-between">
                                <div className="p-4 bg-zinc-50 rounded-2xl text-black"><Globe className="w-6 h-6" /></div>
                                <span className="text-[10px] font-black text-zinc-200 uppercase tracking-widest italic">{t('detail.overview.feat_dist')}</span>
                             </div>
                             <h3 className="text-2xl font-black italic uppercase tracking-tighter">{t('detail.overview.feat_dist')}</h3>
                             <p className="text-zinc-400 font-bold italic leading-relaxed text-sm">
                               {serverTags.length > 0 ? serverTags.join(' / ') : '服务器标签暂未配置。'}
                             </p>
                          </div>
                       </section>
                    </motion.div>
                 )}

                 {activeTab === 'community' && (
                    <motion.div 
                      key="community"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-12"
                    >
                       {/* Comment Input Forum Style */}
                       {isAuthenticated ? (
                         <div className="p-12 border-2 border-black rounded-[4rem] bg-white space-y-10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                               <MessageSquare className="w-64 h-64" />
                            </div>
                            <div className="flex items-center justify-between relative z-10">
                               <div className="flex items-center gap-6">
                                  <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center font-black text-xl uppercase italic shadow-2xl">
                                     {user?.username?.[0]}
                                  </div>
                                  <div className="flex flex-col -space-y-1">
                                     <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent italic">{t('detail.comm.auth_user')}</span>
                                     <span className="text-2xl font-black uppercase italic tracking-tight">{user?.username}</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50 rounded-xl">
                                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-[9px] font-black uppercase tracking-widest italic text-zinc-400">{t('detail.comm.session_stable')}</span>
                               </div>
                            </div>
                            <textarea 
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              maxLength={COMMENT_MAX_LENGTH}
                              className="w-full bg-zinc-50/50 border border-transparent rounded-[2.5rem] p-10 min-h-[300px] text-xl font-black italic tracking-tight focus:bg-white focus:border-black outline-hidden transition-all duration-700 shadow-xs resize-none relative z-10"
                              placeholder={t('detail.comm.placeholder')}
                            />
                            <div className="text-xs text-zinc-400 text-right mt-4">{commentText.length}/{COMMENT_MAX_LENGTH}</div>
                            <div className="flex justify-between items-center relative z-10">
                               <div className="flex items-center gap-4 text-zinc-300">
                                  <button type="button" className="p-4 hover:text-black transition-colors"><Zap className="w-5 h-5" /></button>
                                  <button type="button" className="p-4 hover:text-black transition-colors"><Globe className="w-5 h-5" /></button>
                                  <button type="button" className="p-4 hover:text-black transition-colors"><Shield className="w-5 h-5" /></button>
                               </div>
                               <button type="button" 
                                 onClick={() => commentMutation.mutate(commentText)}
                                 disabled={!commentText.trim() || commentMutation.isPending}
                                 className="group px-16 py-8 bg-black text-white rounded-[3rem] font-black text-[12px] uppercase tracking-[0.6em] flex items-center gap-6 hover:bg-accent transition-all italic active:scale-95 shadow-2xl shadow-black/20"
                               >
                                  {commentMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <GeometricLantern variant="spark" className="w-6 h-6 group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform duration-700" />}
                                  {t('detail.comm.broadcast')}
                               </button>
                            </div>
                         </div>
                       ) : (
                         <div className="p-24 border-4 border-dashed border-zinc-100 rounded-[5rem] text-center space-y-10 group hover:border-black transition-all duration-1000 bg-zinc-50/30">
                            <div className="flex flex-col items-center gap-6">
                               <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl group-hover:rotate-180 transition-transform duration-1000">
                                  <GeometricLantern variant="security" className="w-12 h-12 text-black" />
                               </div>
                               <div className="space-y-2">
                                  <h3 className="text-4xl font-black uppercase tracking-tighter italic">{t('detail.comm.handshake_req')}</h3>
                                  <p className="text-zinc-400 font-bold italic tracking-widest text-[10px] uppercase">{t('detail.comm.auth_req_desc')}</p>
                               </div>
                            </div>
                            <Link to="/login" className="inline-flex items-center gap-8 px-20 py-8 bg-black text-white rounded-[3rem] font-black text-[12px] uppercase tracking-[0.6em] hover:bg-accent transition-all italic shadow-2xl">
                               {t('detail.comm.init_sync')} <ChevronRight className="w-5 h-5" />
                            </Link>
                         </div>
                       )}

                       {/* Threaded Feed Style */}
                       <div className="space-y-16">
                          <header className="flex items-center justify-between border-b border-zinc-50 pb-8">
                             <div className="flex items-center gap-4">
                                <Activity className="w-5 h-5 text-accent" />
                                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">{t('detail.comm.live_feed')}</span>
                             </div>
                             <div className="flex items-center gap-6">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">{t('detail.comm.sort_latest')}</span>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                             </div>
                          </header>

                          <div className="space-y-10">
                             {latestComments.length === 0 ? (
                               <div className="rounded-[3rem] border border-dashed border-zinc-100 bg-zinc-50/50 p-12 text-center text-sm font-bold text-zinc-400">
                                 暂无真实评论
                               </div>
                             ) : latestComments.map((comment: any, idx: number) => (
                               <motion.div 
                                 key={comment.id} 
                                 initial={{ opacity: 0, y: 30 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 transition={{ delay: idx * 0.1, duration: 0.8 }}
                                 className="group flex gap-12 p-10 hover:bg-zinc-50/50 rounded-[4rem] border border-transparent hover:border-zinc-100 transition-all duration-700"
                               >
                                 <div className="flex flex-col items-center gap-6 shrink-0 pt-4">
                                    <div className="w-20 h-20 rounded-[2rem] bg-white border-2 border-zinc-100 flex items-center justify-center font-black text-3xl italic shadow-xl group-hover:rotate-6 transition-all duration-700 group-hover:border-black group-hover:text-accent">
                                       {(comment.user?.display_name || comment.user?.username || comment.author || 'U')?.[0]}
                                    </div>
                                    <div className="flex flex-col items-center gap-4 bg-zinc-50 p-3 rounded-[2rem] border border-zinc-100 opacity-20 group-hover:opacity-100 transition-opacity">
                                       <button type="button" className="text-zinc-400 hover:text-black active:scale-110 transition-all"><ThumbsUp className="w-4 h-4" /></button>
                                       <span className="text-[10px] font-black font-mono">0</span>
                                       <button type="button" className="text-zinc-400 hover:text-red-500 active:scale-110 transition-all"><ThumbsDown className="w-4 h-4" /></button>
                                    </div>
                                 </div>
                                 <div className="flex-grow space-y-6 py-4 pr-12">
                                    <div className="flex justify-between items-start">
                                       <div className="space-y-2">
                                          <div className="flex items-center gap-6">
                                             <span className="text-3xl font-black italic tracking-tighter uppercase group-hover:translate-x-2 transition-transform duration-500">
                                               {comment.user?.display_name || comment.user?.username || comment.author || '用户'}
                                             </span>
                                             <div className="flex items-center gap-3 px-3 py-1 bg-black text-white text-[8px] font-black uppercase tracking-widest rounded-sm italic">
                                                <Award className="w-3 h-3" /> {t('detail.comm.verified')}
                                             </div>
                                          </div>
                                          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-300 italic">
                                             <Clock className="w-3.5 h-3.5" /> {comment.created_at ? new Date(comment.created_at).toLocaleString() : comment.time}
                                             <span className="opacity-20">|</span>
                                             <UserCheck className="w-3.5 h-3.5" /> {comment.user?.tier_badge || t('detail.comm.supporter')}
                                          </div>
                                       </div>
                                       <button type="button" className="text-zinc-200 hover:text-black transition-colors"><Share2 className="w-5 h-5" /></button>
                                    </div>
                                    <div className="relative">
                                       <div className="absolute left-[-2rem] top-0 bottom-0 w-[2px] bg-zinc-50 group-hover:bg-accent/20 transition-colors" />
                                       <p className="text-xl font-bold leading-relaxed italic text-zinc-500 group-hover:text-zinc-800 transition-colors">
                                          {comment.content || comment.body}
                                       </p>
                                    </div>
                                    <div className="flex items-center gap-8 pt-4">
                                       <button type="button" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-black transition-all flex items-center gap-2 italic">
                                          <MessageSquare className="w-3.5 h-3.5" /> {t('detail.comm.reply')}
                                       </button>
                                       <button type="button" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 hover:text-black transition-all flex items-center gap-2 italic">
                                          <Shield className="w-3.5 h-3.5" /> {t('detail.comm.report')}
                                       </button>
                                    </div>
                                 </div>
                               </motion.div>
                             ))}
                          </div>
                       </div>
                    </motion.div>
                 )}

                 {activeTab === 'technical' && (
                    <motion.div 
                      key="technical"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-16"
                    >
                       <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {[
                            ...technicalCards,
                          ].map(item => (
                            <div key={item.label} className="p-10 border border-zinc-100 rounded-[3rem] bg-white space-y-6 shadow-xl shadow-black/5">
                               <div className="flex items-center justify-between">
                                  <div className="p-4 bg-zinc-50 rounded-2xl text-black"><item.icon className="w-5 h-5" /></div>
                                  <span className="text-[9px] font-black text-green-500 uppercase italic tracking-widest">{item.status}</span>
                               </div>
                               <div className="space-y-1">
                                  <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest italic">{item.label}</span>
                                  <p className="text-4xl font-black italic tracking-tighter">{item.value}</p>
                               </div>
                            </div>
                          ))}
                       </section>

                       <section className="p-16 border border-zinc-50 bg-zinc-50/20 rounded-[4rem] space-y-10">
                          <header className="flex items-center gap-6">
                             <Cpu className="w-6 h-6 text-accent" />
                             <h2 className="text-[12px] font-black uppercase tracking-[0.6em] text-zinc-300 italic">{t('detail.tech.log_buffer')}</h2>
                          </header>
                          <div className="space-y-4 font-mono text-[11px] text-zinc-400">
                             {[
                               `> SERVER_ID ${formatServerMetric(server?.id)}`,
                               `> HOST ${formatServerMetric(server?.ip)}`,
                               `> VERSION ${formatServerMetric(server?.version ?? server?.supported_versions)}`,
                               `> REVIEW_STATUS ${formatServerMetric(server?.review_status)}`,
                               `> UPDATED_AT ${server?.updated_at ? new Date(server.updated_at).toLocaleString() : '暂无'}`,
                             ].map((line, i) => (
                               <motion.div 
                                 key={i} 
                                 initial={{ opacity: 0, x: -10 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 transition={{ delay: i * 0.1 }}
                                 className="flex items-center gap-4 hover:text-black transition-colors cursor-default"
                               >
                                  <span className="text-accent/40 font-black">#</span>
                                  {line}
                               </motion.div>
                             ))}
                          </div>
                       </section>
                    </motion.div>
                 )}

                 {activeTab === 'rules' && (
                    <motion.div 
                      key="rules"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-8"
                    >
                       {(rules.length > 0 ? rules : [{ title: '规则未配置', desc: '该服务器暂未填写公开规则，请以服务器内公告为准。' }]).map((rule, i) => (
                         <div key={i} className="p-12 border border-zinc-100 rounded-[3rem] bg-white space-y-6 hover:bg-black hover:text-white transition-all duration-700 group shadow-xl shadow-black/5">
                            <div className="flex items-center justify-between">
                               <div className="w-12 h-12 rounded-2xl bg-zinc-50 text-black flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                                  <span className="font-black italic text-xl">{i+1}</span>
                               </div>
                               <Shield className="w-5 h-5 text-zinc-100 group-hover:text-accent transition-colors" />
                            </div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter">{rule.title}</h3>
                            <p className="text-zinc-400 font-bold italic leading-relaxed group-hover:text-zinc-300 transition-colors">{rule.desc}</p>
                         </div>
                       ))}
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>

           {/* Community Sidebar */}
           <div className="xl:col-span-4 space-y-16">
              <section className="p-12 border border-zinc-100 bg-white rounded-[4rem] space-y-12 shadow-2xl shadow-black/5 group/sidebar">
                 <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">{t('detail.side.top_nodes')}</h3>
                    <Award className="w-5 h-5 text-zinc-100 group-hover/sidebar:rotate-12 transition-transform duration-700" />
                 </div>
                 <div className="space-y-8">
                    {server?.owner ? [server.owner].map((owner: any, i: number) => (
                      <div key={i} className="flex items-center justify-between group/user cursor-pointer">
                         <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center overflow-hidden group-hover/user:scale-110 transition-transform">
                               {owner.avatar_url ? (
                                 <img src={owner.avatar_url} className="w-full h-full object-cover grayscale" alt={owner.display_name || owner.username || 'owner'} />
                               ) : (
                                 <span className="font-black text-zinc-500">{(owner.display_name || owner.username || 'O')[0]}</span>
                               )}
                            </div>
                            <div className="flex flex-col -space-y-1">
                               <span className="text-lg font-black italic tracking-tighter uppercase group-hover/user:text-accent transition-colors">{owner.display_name || owner.username || '服务器主'}</span>
                               <span className="text-[9px] font-black text-zinc-300 uppercase italic">OWNER</span>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 px-3 py-1 bg-zinc-50 rounded-sm text-[8px] font-black italic text-zinc-400 group-hover/user:bg-black group-hover/user:text-white transition-all">
                            OWNER
                         </div>
                      </div>
                    )) : (
                      <div className="rounded-[2rem] border border-dashed border-zinc-100 p-6 text-center text-xs font-bold text-zinc-400">
                        暂无公开成员数据
                      </div>
                    )}
                 </div>
              </section>

              <section className="p-12 border border-zinc-100 rounded-[4rem] bg-zinc-900 text-white space-y-8 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
                    <GeometricLantern variant="activity" className="w-32 h-32" />
                 </div>
                 <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-4">
                       <AlertTriangle className="w-5 h-5 text-accent" />
                       <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 italic">{t('detail.side.alert')}</span>
                    </div>
                    <p className="text-2xl font-black uppercase italic leading-tight">{t('detail.side.integrity_guaranteed')}</p>
                    <p className="text-zinc-600 text-xs font-bold leading-relaxed italic">{t('detail.side.encrypted')}</p>
                    <div className="pt-4 flex items-center justify-between border-t border-zinc-800 border-dashed">
                       <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 italic">{t('detail.side.sys_ver')}: 4.2.0</span>
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-green-500 italic">{t('detail.side.ready')}</span>
                       </div>
                    </div>
                 </div>
              </section>
           </div>
        </div>
      </div>
    </StatusWrapper>
  );
};

export default ServerDetail;
