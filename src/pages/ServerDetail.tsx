import React, { useMemo, useState } from 'react';
import { copyText } from '@/utils/clipboard';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, request } from '@/api/request';
import StatusWrapper from '@/components/ui/StatusWrapper';
import {
  Heart, ChevronLeft, Loader2,
  Activity, Shield, Share2,
  Award, Globe, Settings,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/authStore';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { useT } from '@/store/uiStore';
import PageSeo from '@/components/ui/PageSeo';
import { isServerRouteId } from '@/utils/routeParams';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
import {
  getServerName,
  getServerPlatformLabel,
  getServerSummary,
  getServerThumbnail,
  getServerVersionLabels,
  parseListField,
} from '@/utils/serverView';
import { sanitizeHtml } from '@/utils/htmlSanitizer';

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
  const [copied, setCopied] = useState(false);

  const useRustV2 = isRustV2Enabled() && Boolean(id && !/^\d+$/.test(id));
  const isValidServerId = isServerRouteId(id);
  const isInvalidServerId = !isValidServerId;
  const { data: server, error, isLoading, isError, refetch } = useQuery({
    queryKey: ['server', id],
    queryFn: async () => {
      return useRustV2
        ? await request<any>(rustV2Path(`/servers/${id}`), { ...rustV2RequestOptions })
        : await request<any>(`/servers/${id}`);
    },
    enabled: isValidServerId,
    retry: (failureCount, queryError) =>
      !(queryError instanceof ApiError && queryError.status === 404) && failureCount < 1,
  });
  const isNotFound = error instanceof ApiError && error.status === 404;
  const isMissingServer = !isInvalidServerId && (isNotFound || (!isLoading && !isError && !server));
  const serverTags = useMemo(() => parseListField(server?.tags), [server?.tags]);
  const networkEnvironments = useMemo(() => parseListField(server?.network_env), [server?.network_env]);
  const serverName = getServerName(server) || `Minecraft 服务器 ${id || ''}`.trim();
  const submittedSummary = getServerSummary(server);
  const submittedDescriptionHtml = sanitizeHtml(String(server?.content_html || ''));
  const serverDescription = truncateText(submittedSummary);
  const safeSeoImage = getServerThumbnail(server) || undefined;
  const serverVersions = getServerVersionLabels(server);
  const submittedDetails = [
    { label: '服务器平台', value: server?.platform || server?.edition ? getServerPlatformLabel(server) : '' },
    { label: '服务器分类', value: String(server?.category || '').trim() },
    { label: '支持版本', value: serverVersions.join(' / ') },
    { label: '网络环境', value: networkEnvironments.join(' / ') },
    {
      label: '在线模式',
      value: server?.online_mode === true ? '开启正版验证' : server?.online_mode === false ? '关闭正版验证' : '',
    },
    { label: '交流群', value: String(server?.group_number || server?.qq_group || '').trim() },
    { label: '相关链接', value: String(server?.link || '').trim() },
  ].filter((item) => item.value);

  const { data: likeState } = useQuery({
    queryKey: ['server-like-state', id],
    queryFn: () => request<{ liked: boolean }>(rustV2Path(`/servers/${id}/like-state`), { ...rustV2RequestOptions }),
    enabled: useRustV2 && Boolean(id && server && isAuthenticated),
  });

  const handleCopy = async () => {
    const endpoint = String(server?.ip || server?.host || server?.link || '').trim();
    if (!endpoint) {
      toast({ variant: 'destructive', title: '该服务器未公开连接地址' });
      return;
    }
    try {
       await copyText(endpoint);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
       toast({ title: '服务器地址已复制', description: t('detail.side.ip_label') });
    } catch {
      toast({ variant: 'destructive', title: '复制失败', description: `请手动复制：${endpoint}` });
    }
  };

  const shareServer = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: serverName, text: serverDescription, url });
      } else {
       await copyText(url);
        toast({ title: '详情页链接已复制' });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ variant: 'destructive', title: '分享失败', description: '请手动复制浏览器地址。' });
    }
  };

  const likeMutation = useMutation<{ liked: boolean }, ApiError>({
    mutationFn: () => useRustV2
      ? request<{ liked: boolean }>(rustV2Path(`/servers/${id}/like`), { method: 'POST', ...rustV2RequestOptions })
      : request<{ liked: boolean }>(`/servers/${id}/like`, { method: 'POST' }),
    onSuccess: (state) => {
      queryClient.invalidateQueries({ queryKey: ['server', id] });
      queryClient.invalidateQueries({ queryKey: ['server-like-state', id] });
      toast({ title: useRustV2 && !state.liked ? '已取消点赞' : '已点赞该服务器' });
    },
    onError: (error) => toast({
      variant: 'destructive',
      title: '点赞失败',
      description: error.status === 401 ? '登录后才能点赞服务器。' : '请稍后重试。',
    }),
  });

  return (
    <StatusWrapper
      isLoading={isValidServerId && isLoading}
      isError={isValidServerId && isError && !isNotFound}
      isEmpty={isInvalidServerId || isMissingServer}
      onRetry={isValidServerId ? () => { void refetch(); } : undefined}
      emptyTitle={isInvalidServerId ? '服务器链接格式无效' : '服务器不存在'}
      emptyDescription={isInvalidServerId
        ? '服务器编号必须只包含数字。请检查链接后重试。'
        : '该服务器可能已下架、尚未公开，或链接已经失效。'}
      emptyAction={(
        <Link to="/servers" className="rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white">
          返回服务器列表
        </Link>
      )}
    >
      {server && (
        <PageSeo
          title={`${serverName} - Minecraft 服务器详情 - 千服联灯`}
           description={serverDescription || `${serverName} 的公开资料。`}
          canonicalPath={`/server/${id}`}
          image={safeSeoImage?.startsWith('http') ? safeSeoImage : undefined}
          schema={{
            '@context': 'https://schema.org',
            '@type': 'VideoGameServer',
            name: serverName,
            description: serverDescription,
            keywords: serverTags,
            url: `${import.meta.env.VITE_APP_URL || 'https://mc-u.top'}/server/${id}`,
          }}
        />
      )}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-16 bg-white selection:bg-black selection:text-white">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-zinc-400">
             <Link to="/servers" className="hover:text-black transition-all flex items-center gap-1.5 group">
                <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" /> 
                {t('detail.nav.back')}
             </Link>
             <span className="opacity-30">/</span>
             <span className="text-black truncate max-w-[200px]">{server?.name}</span>
          </div>
         </div>

        {/* Hero Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 mb-10">
           {/* Cover Photo */}
           <div className="lg:col-span-7 relative aspect-[16/10] rounded-3xl overflow-hidden bg-zinc-50 shadow-xl group border border-zinc-100">
              <img 
                 src={getServerThumbnail(server) || '/placeholder-server.jpg'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 grayscale group-hover:grayscale-0" 
                alt={server?.name}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 sm:right-7 flex items-end justify-between z-10">
                 <div className="space-y-4">
                     {serverVersions[0] ? (
                          <div className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-semibold tracking-wide rounded-lg">
                             支持版本 {serverVersions[0]}
                          </div>
                     ) : null}
                    <div className="flex flex-wrap items-end gap-4">
                        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-none break-words max-w-full">{server?.name}</h1>
                       {isAuthenticated && user?.id === server?.ownerId && (
                         <Link 
                           to={`/editor?id=${id}`}
                           className="mb-1 px-4 py-2.5 bg-white text-black rounded-xl font-semibold text-xs flex items-center gap-2 hover:bg-accent hover:text-white transition-all shadow-xl active:scale-95"
                         >
                            <Settings className="w-4 h-4" />
编辑服务器
                         </Link>
                       )}
                    </div>
                 </div>
              </div>
              
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-2">
                 <button type="button" onClick={() => { void shareServer(); }} aria-label={`分享服务器 ${serverName}`} className="w-11 h-11 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90">
                    <Share2 className="w-5 h-5" />
                 </button>
                 <div className="w-11 h-11 bg-white text-black rounded-xl flex items-center justify-center shadow-xl">
                    <GeometricLantern variant="spark" className="w-5 h-5 fill-current" />
                 </div>
              </div>
           </div>

            <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
                 <div className="bg-black text-white rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-xl">
                   <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                    <div className="relative z-10 space-y-3">
                       <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium tracking-wide text-zinc-400">{t('detail.side.endpoint')}</label>
                            <button type="button"
                             onClick={() => { likeMutation.mutate(); }}
                             disabled={likeMutation.isPending}
                             aria-label={(useRustV2 ? likeState?.liked : server?.isLiked) ? '取消点赞该服务器' : '点赞该服务器'}
                             className={`rounded-xl border p-2.5 ${(useRustV2 ? likeState?.liked : server?.isLiked) ? 'bg-accent border-accent text-white' : 'border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-500'} transition-all ${likeMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {likeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${(useRustV2 ? likeState?.liked : server?.isLiked) ? 'fill-current' : ''}`} />}
                            </button>
                          </div>
                        <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4 group/ip">
                            <span className="min-w-0 break-all text-lg sm:text-2xl font-semibold font-mono tracking-tight">{server?.ip || server?.host || server?.link || '暂未公开'}</span>
                           <button type="button" onClick={() => { void handleCopy(); }} aria-label="复制服务器地址" className="shrink-0 p-3 sm:p-4 bg-white text-black rounded-xl hover:bg-accent hover:text-white transition-all shadow-xl">
                             {copied ? <Award className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                           </button>
                         </div>
                      </div>
                  </div>
               </div>

               <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-5 sm:p-6">
                  <div className="flex justify-between items-start">
                     <div className="space-y-1">
                         <h3 className="text-xs font-semibold tracking-wide text-zinc-500">{t('detail.side.intel')}</h3>
                         <p className="text-base font-semibold tracking-tight leading-tight">发布者填写的公开资料</p>
                      </div>
                      <GeometricLantern variant="network" className="w-8 h-8 text-zinc-200" />
                   </div>
                  {submittedDetails.length > 0 ? (
                    <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-zinc-100 pt-5 sm:grid-cols-3">
                      {submittedDetails.slice(0, 6).map((item) => (
                        <div key={item.label} className="space-y-1">
                          <dt className="text-[11px] font-medium text-zinc-500">{item.label}</dt>
                          <dd className="truncate text-sm font-semibold text-zinc-800">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-5 border-t border-zinc-100 pt-5 text-sm font-medium text-zinc-500">该服务器未填写更多公开资料。</p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
                    <span className="mr-1 text-[11px] font-medium text-zinc-500">服务器标签</span>
                    {serverTags.length > 0 ? serverTags.slice(0, 6).map((tag) => (
                      <span key={tag} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">{tag}</span>
                    )) : <span className="text-xs font-medium text-zinc-500">暂无公开标签</span>}
                  </div>
              </div>
           </div>
        </div>

         <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
           <div className="space-y-6 xl:col-span-12">
             <section className="border border-zinc-100 bg-white p-5 sm:p-6" aria-labelledby="server-summary-title">
               <header className="flex items-center gap-2">
                 <Activity className="h-4 w-4 text-accent" />
                 <h2 id="server-summary-title" className="text-sm font-semibold text-zinc-800">服务器简介</h2>
               </header>
              {submittedDescriptionHtml ? (
                <div className="prose prose-zinc mt-4 max-w-none break-words text-sm leading-7 sm:text-base" dangerouslySetInnerHTML={{ __html: submittedDescriptionHtml }} />
              ) : submittedSummary ? (
                 <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700 sm:text-base">{submittedSummary}</p>
               ) : (
                 <p className="mt-4 text-sm leading-7 text-zinc-500">该服务器暂未填写公开简介。</p>
               )}
             </section>

             <section data-testid="server-detail-published-details" className="border border-zinc-100 bg-white p-5 sm:p-6" aria-labelledby="server-details-title">
               <header className="flex items-center gap-2">
                 <Settings className="h-4 w-4 text-accent" />
                 <div>
                   <h2 id="server-details-title" className="text-sm font-semibold text-zinc-800">发布者填写的详细资料</h2>
                   <p className="mt-1 text-xs text-zinc-500">以下内容由发布时填写并公开。</p>
                 </div>
               </header>
               {submittedDetails.length > 0 ? (
                 <dl className="mt-5 grid grid-cols-1 divide-y divide-zinc-100 border-y border-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                   {submittedDetails.map((item) => (
                     <div key={item.label} className="px-4 py-4 first:pl-0 sm:odd:pl-0 sm:even:pr-0">
                       <dt className="text-xs font-medium text-zinc-500">{item.label}</dt>
                       <dd className="mt-1.5 break-words text-sm font-semibold text-zinc-900">{item.value}</dd>
                     </div>
                   ))}
                 </dl>
               ) : (
                 <p className="mt-5 text-sm text-zinc-500">该服务器未填写更多发布配置。</p>
               )}
             </section>

             <section className="border border-zinc-100 bg-white p-5 sm:p-6" aria-labelledby="server-tags-title">
               <header className="flex items-center gap-2">
                 <Shield className="h-4 w-4 text-accent" />
                 <h2 id="server-tags-title" className="text-sm font-semibold text-zinc-800">服务器标签</h2>
               </header>
               {serverTags.length > 0 ? (
                 <div className="mt-4 flex flex-wrap gap-2">
                   {serverTags.map((tag) => <span key={tag} className="border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700">{tag}</span>)}
                 </div>
               ) : (
                 <p className="mt-4 text-sm text-zinc-500">该服务器未填写公开标签。</p>
               )}
             </section>
           </div>

         </div>
      </div>
    </StatusWrapper>
  );
};

export default ServerDetail;
