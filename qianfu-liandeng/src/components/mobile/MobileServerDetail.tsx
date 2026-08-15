import React, { useMemo, useState } from 'react';
import { copyText } from '@/utils/clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Heart, Share2, Users, Server, Clock, MessageSquare, Play, Copy, ShieldCheck, AlertCircle
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../../api/request';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../hooks/use-toast';
import { cn } from '../../utils/cn';
import { toArray } from '../../utils/apiData';
import { isNumericRouteId } from '../../utils/routeParams';
import { LazyImage } from './MobileLazyImage';
import {
  formatDateTime,
  getServerName,
  getServerPlayersMax,
  getServerPlayersOnline,
  getServerSummary,
  getServerThumbnail,
  getServerVersionLabel,
  parseListField,
} from '../../utils/serverView';

interface MobileServerDetailProps {
  serverId?: string;
}

const tabs = [
  { id: 'info' as const, label: '详情' },
  { id: 'rules' as const, label: '规则' },
  { id: 'similar' as const, label: '相似' },
];

type TabId = (typeof tabs)[number]['id'];

const MobileServerDetail: React.FC<MobileServerDetailProps> = ({ serverId }) => {
  const params = useParams();
  const id = serverId || params.id;
  const isValidServerId = isNumericRouteId(id);
  const isInvalidServerId = !isValidServerId;
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [activeTab, setActiveTab] = useState<TabId>('info');

  const { data: server, error, isLoading, isError, refetch } = useQuery({
    queryKey: ['server', id, 'mobile'],
    queryFn: () => api.get<any>(`/servers/${id}`, undefined, { useAuth: false }),
    enabled: isValidServerId,
    retry: (failureCount, queryError) =>
      !(queryError instanceof ApiError && [403, 404].includes(queryError.status)) && failureCount < 1,
  });
  const isNotFound = error instanceof ApiError && error.status === 404;
  const isForbidden = error instanceof ApiError && error.status === 403;
  const isMissingServer = isNotFound || (!isLoading && !isError && !server);

  const { data: favoriteState, isError: favoriteStateError, refetch: refetchFavoriteState } = useQuery({
    queryKey: ['server-favorite-state', id],
    queryFn: () => api.get<any>(`/servers/${id}/favorite-state`),
    enabled: Boolean(id && server && isAuthenticated),
    retry: false,
  });

  const tags = useMemo(() => parseListField(server?.tags), [server?.tags]);
  const networkEnv = useMemo(() => parseListField(server?.network_env), [server?.network_env]);
  const versions = useMemo(() => parseListField(server?.supported_versions), [server?.supported_versions]);
  const similarCategory = server?.category || tags[0];

  const { data: similarServerResponse, isError: similarServersError, refetch: refetchSimilarServers } = useQuery({
    queryKey: ['similar-servers', id, similarCategory],
    queryFn: () => api.get<any>('/public/servers', { limit: 5, category: similarCategory }, { useAuth: false }),
    enabled: !!similarCategory,
  });
  const similarServers = toArray<any>(similarServerResponse);

  const favoriteMutation = useMutation({
    mutationFn: () => api.post(`/servers/${id}/favorite`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-favorite-state', id] });
      queryClient.invalidateQueries({ queryKey: ['server', id, 'mobile'] });
      toast({ title: '已更新收藏状态' });
    },
    onError: () => toast({ variant: 'destructive', title: '收藏状态更新失败' }),
  });

  const copyConnection = async () => {
    const target = server?.ip || server?.link;
    if (!target) {
      toast({ title: '该服务器未公开连接地址' });
      return;
    }
    try {
      await copyText(target);
      toast({ title: '连接地址已复制' });
    } catch {
      toast({ variant: 'destructive', title: '复制失败', description: `请手动复制：${target}` });
    }
  };

  const shareServer = async () => {
    const url = `${window.location.origin}/server/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: getServerName(server), url });
      else await copyText(url);
      if (!navigator.share) toast({ title: '分享链接已复制' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ variant: 'destructive', title: '分享失败' });
    }
  };

  if (isInvalidServerId) {
    return (
      <div role="status" aria-live="polite" className="min-h-full bg-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400" aria-hidden="true" />
        <div className="space-y-2">
          <h1 className="text-lg font-black text-zinc-900">服务器链接格式无效</h1>
          <p className="max-w-xs text-sm font-medium leading-relaxed text-zinc-500">服务器编号必须只包含数字。请检查链接后重试。</p>
        </div>
        <Link to="/servers" className="px-6 py-3 rounded-xl bg-black text-white text-xs font-black">返回服务器列表</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="min-h-full bg-white pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <span className="sr-only">正在加载服务器详情</span>
        <div className="h-64 bg-zinc-100 animate-pulse" />
        <div className="px-4 -mt-6 relative z-10">
          <div className="h-24 rounded-2xl bg-white shadow-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isMissingServer) {
    return (
      <div role="status" className="min-h-full bg-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <Server className="w-12 h-12 text-zinc-300" aria-hidden="true" />
        <div className="space-y-2">
          <h1 className="text-lg font-black text-zinc-900">服务器不存在</h1>
          <p className="max-w-xs text-sm font-medium leading-relaxed text-zinc-500">该服务器可能已下架、尚未公开，或链接已经失效。</p>
        </div>
        <Link to="/servers" className="px-6 py-3 rounded-xl bg-black text-white text-xs font-black">返回服务器列表</Link>
      </div>
    );
  }

  if (isError) {
    const errorTitle = isForbidden ? '暂时无法查看该服务器' : '服务器详情加载失败';
    const errorDescription = isForbidden
      ? '请求被安全策略拒绝，或该服务器尚未公开。'
      : '请检查网络连接后重新加载。';

    return (
      <div role="alert" className="min-h-full bg-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-300" aria-hidden="true" />
        <div className="space-y-2">
          <h1 className="text-lg font-black text-zinc-900">{errorTitle}</h1>
          <p className="max-w-xs text-sm font-medium leading-relaxed text-zinc-500">{errorDescription}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => { void refetch(); }}
            aria-label="重新加载服务器详情"
            className="px-6 py-3 rounded-xl bg-black text-white text-xs font-black"
          >
            重新加载
          </button>
          <Link to="/servers" className="px-6 py-3 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-black">返回列表</Link>
        </div>
      </div>
    );
  }

  const thumbnail = getServerThumbnail(server);
  const players = getServerPlayersOnline(server);
  const maxPlayers = getServerPlayersMax(server);
  const online = server?.status?.online ?? server?.online;
  const rules = [
    server.online_mode !== undefined ? { title: '在线模式', desc: server.online_mode ? '开启正版验证' : '未开启正版验证' } : null,
    networkEnv.length > 0 ? { title: '网络环境', desc: networkEnv.join(' / ') } : null,
    versions.length > 0 ? { title: '支持版本', desc: versions.join(' / ') } : null,
    server.category ? { title: '服务器分类', desc: server.category } : null,
    ...tags.slice(0, 4).map((tag) => ({ title: '标签', desc: tag })),
  ].filter(Boolean) as Array<{ title: string; desc: string }>;

  return (
    <div className="min-h-full bg-white pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <div className="relative h-64 overflow-hidden bg-zinc-100">
        {thumbnail ? (
          <LazyImage src={thumbnail} alt={getServerName(server)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[radial-gradient(circle_at_30%_20%,#e4e4e7,transparent_35%),linear-gradient(135deg,#fafafa,#d4d4d8)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        <div className="absolute top-4 right-4 flex gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => { if (favoriteStateError) { void refetchFavoriteState(); return; } favoriteMutation.mutate(); }}
              disabled={favoriteMutation.isPending}
              aria-label={favoriteStateError ? '重新加载收藏状态' : favoriteState?.favorited ? '取消收藏该服务器' : '收藏该服务器'}
              className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              <Heart className={cn('w-5 h-5', favoriteState?.favorited ? 'fill-red-500 text-red-500' : 'text-white')} />
            </button>
          ) : (
            <Link to="/login" aria-label="登录后收藏该服务器" className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </Link>
          )}
          <button type="button" onClick={shareServer} aria-label="分享该服务器" className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-black text-white leading-tight">{getServerName(server)}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase">
              {server.category || tags[0] || 'SERVER'}
            </span>
            <span className="text-xs font-mono text-white/80">{getServerVersionLabel(server)}</span>
          </div>
        </div>
      </div>

      <div data-testid="server-detail-first-screen" className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-lg font-black">{maxPlayers ? `${players}/${maxPlayers}` : players}</span>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">在线人数</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Clock className={cn('w-4 h-4', online === false ? 'text-red-500' : online === true ? 'text-green-500' : 'text-zinc-400')} />
                <span data-testid="server-detail-status" aria-label="服务器状态" className="text-lg font-black">
                  {online === true ? '在线' : online === false ? '离线' : '未知'}
                </span>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">状态</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-lg font-black">{server.like_count ?? 0}</span>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">收藏热度</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs">
            <div>
              <p className="font-bold text-muted-foreground">服务器版本</p>
              <p className="mt-1 font-black font-mono truncate">{getServerVersionLabel(server)}</p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground">服务器平台</p>
              <p className="mt-1 font-black truncate">{server.platform || 'Java Edition'}</p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground">服务器分类</p>
              <p className="mt-1 font-black truncate">{server.category || '未分类'}</p>
            </div>
            <div>
              <p className="font-bold text-muted-foreground">更新时间</p>
              <p className="mt-1 font-black truncate">{formatDateTime(server.updated_at)}</p>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-muted-foreground mb-2">服务器标签</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted-foreground">连接地址</p>
                <p className="mt-1 text-sm font-mono font-black tracking-wide truncate">{server.ip || server.link || '暂未公开'}</p>
              </div>
              <button
                type="button"
                data-testid="server-detail-copy-address"
                onClick={copyConnection}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-xs font-black text-white active:scale-95 transition-transform"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
                复制地址
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="flex border-b border-gray-200" role="group" aria-label="服务器详情分区">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={cn('flex-1 py-3 text-sm font-bold uppercase tracking-wider relative', activeTab === tab.id ? 'text-black' : 'text-muted-foreground')}
            >
              {tab.label}
              {activeTab === tab.id && <motion.div layoutId="tabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6">
        {activeTab === 'info' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider mb-3">服务器介绍</h3>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{getServerSummary(server)}</p>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider mb-3">服务器信息</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-muted-foreground">平台类型</span>
                  <span className="text-xs font-black flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    {server.platform || 'Java Edition'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-muted-foreground">更新时间</span>
                  <span className="text-xs font-black">{formatDateTime(server.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-muted-foreground">审核状态</span>
                  <span className="text-xs font-black">{server.review_status || 'UNKNOWN'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">服务器 IP</p>
              <p className="text-lg font-mono font-black tracking-wider break-all">{server.ip || '暂未公开'}</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm font-bold text-zinc-400">
                该服务器暂未填写公开规则，请以服务器内公告为准。
              </div>
            ) : (
              rules.map((rule) => (
                <div key={`${rule.title}-${rule.desc}`} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-zinc-500" />
                    <p className="text-xs font-black">{rule.title}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{rule.desc}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'similar' && (
          <div className="space-y-4">
            {similarServersError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-800">相似服务器加载失败。<button type="button" onClick={() => refetchSimilarServers()} className="ml-2 underline">重试</button></div>
            ) : similarServers.filter((item: any) => String(item.id) !== String(id)).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm font-bold text-zinc-400">暂无相似服务器</div>
            ) : (
              similarServers.filter((item: any) => String(item.id) !== String(id)).slice(0, 4).map((item: any) => (
                <Link key={item.id} to={`/server/${item.id}`} className="flex gap-4 p-4 border border-gray-100 rounded-2xl active:bg-gray-50 transition-colors">
                  <div className="w-20 h-20 bg-gray-100 rounded-xl shrink-0 overflow-hidden">
                    {getServerThumbnail(item) ? <LazyImage src={getServerThumbnail(item)} alt={getServerName(item)} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <h4 className="text-sm font-black truncate">{getServerName(item)}</h4>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-black text-white text-[8px] font-bold rounded">{item.category || 'SERVER'}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{getServerVersionLabel(item)}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <div data-testid="server-detail-actions" className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-xl border-t border-gray-100 md:hidden">
        <div className="flex gap-3">
          <button type="button" onClick={copyConnection} className="flex-1 py-4 bg-black text-white font-black text-sm rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            复制地址
          </button>
          <Link to="/tickets/new" aria-label="提交服务器相关工单" className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MobileServerDetail;
