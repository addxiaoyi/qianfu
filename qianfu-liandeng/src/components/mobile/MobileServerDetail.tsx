import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Heart, Share2, Users, Server, Clock, MessageSquare, Play, ShieldCheck, AlertCircle
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/request';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../hooks/use-toast';
import { cn } from '../../utils/cn';
import { toArray } from '../../utils/apiData';
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
  { id: 'reviews' as const, label: '评论' },
  { id: 'similar' as const, label: '相似' },
];

type TabId = (typeof tabs)[number]['id'];

const MobileServerDetail: React.FC<MobileServerDetailProps> = ({ serverId }) => {
  const params = useParams();
  const id = serverId || params.id;
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [activeTab, setActiveTab] = useState<TabId>('info');

  const { data: server, isLoading, isError, refetch } = useQuery({
    queryKey: ['server', id, 'mobile'],
    queryFn: () => api.get<any>(`/servers/${id}`, undefined, { useAuth: false }),
    enabled: !!id,
  });

  const { data: commentResponse } = useQuery({
    queryKey: ['server-comments', id, 'mobile'],
    queryFn: () => api.get<any>(`/public/servers/${id}/comments`, { limit: 20 }, { useAuth: false }),
    enabled: !!id,
  });
  const comments = toArray<any>(commentResponse);

  const { data: likeState } = useQuery({
    queryKey: ['server-like-state', id],
    queryFn: () => api.get<any>(`/public/servers/${id}/like-state`),
    enabled: !!id && isAuthenticated,
    retry: false,
  });

  const tags = useMemo(() => parseListField(server?.tags), [server?.tags]);
  const networkEnv = useMemo(() => parseListField(server?.network_env), [server?.network_env]);
  const versions = useMemo(() => parseListField(server?.supported_versions), [server?.supported_versions]);
  const similarCategory = server?.category || tags[0];

  const { data: similarServerResponse } = useQuery({
    queryKey: ['similar-servers', id, similarCategory],
    queryFn: () => api.get<any>('/public/servers', { limit: 5, category: similarCategory }, { useAuth: false }),
    enabled: !!similarCategory,
  });
  const similarServers = toArray<any>(similarServerResponse);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/servers/${id}/like`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server-like-state', id] });
      queryClient.invalidateQueries({ queryKey: ['server', id, 'mobile'] });
      toast({ title: '已更新收藏状态' });
    },
  });

  const copyConnection = async () => {
    const target = server?.ip || server?.link;
    if (!target) {
      toast({ title: '该服务器未公开连接地址' });
      return;
    }
    await navigator.clipboard.writeText(target);
    toast({ title: '连接地址已复制' });
  };

  const shareServer = async () => {
    const url = `${window.location.origin}/server/${id}`;
    await navigator.clipboard.writeText(url);
    toast({ title: '分享链接已复制' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pb-24">
        <div className="h-64 bg-zinc-100 animate-pulse" />
        <div className="px-4 -mt-6 relative z-10">
          <div className="h-24 rounded-2xl bg-white shadow-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !server) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-300" />
        <p className="text-sm font-bold text-zinc-500">服务器详情加载失败</p>
        <button type="button" onClick={() => refetch()} className="px-6 py-3 rounded-xl bg-black text-white text-xs font-black">重试</button>
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
    <div className="min-h-screen bg-white pb-24">
      <div className="relative h-64 overflow-hidden bg-zinc-100">
        {thumbnail ? (
          <LazyImage src={thumbnail} alt={getServerName(server)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[radial-gradient(circle_at_30%_20%,#e4e4e7,transparent_35%),linear-gradient(135deg,#fafafa,#d4d4d8)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

        <Link to="/servers" className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>

        <div className="absolute top-4 right-4 flex gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => likeMutation.mutate()}
              disabled={likeMutation.isPending}
              className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              <Heart className={cn('w-5 h-5', likeState?.liked ? 'fill-red-500 text-red-500' : 'text-white')} />
            </button>
          ) : (
            <Link to="/login" className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </Link>
          )}
          <button type="button" onClick={shareServer} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
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

      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-lg font-black">{maxPlayers ? `${players}/${maxPlayers}` : players}</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">在线</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-lg font-black">{server.like_count ?? 0}</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">收藏</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className={cn('w-4 h-4', online === false ? 'text-red-500' : 'text-green-500')} />
              <span className="text-lg font-black">{online === true ? '在线' : online === false ? '离线' : '未知'}</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">状态</p>
          </div>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="px-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-6">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm font-bold text-zinc-400">暂无公开评论</div>
            ) : (
              comments.map((comment: any) => (
                <div key={comment.id} className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                      <p className="text-xs font-black">{comment.user?.username || comment.author || '用户'}</p>
                      <p className="text-[10px] text-zinc-400">{formatDateTime(comment.created_at || comment.createdAt)}</p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{comment.body || comment.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'similar' && (
          <div className="space-y-4">
            {similarServers.filter((item: any) => String(item.id) !== String(id)).length === 0 ? (
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

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-gray-100 md:hidden">
        <div className="flex gap-3">
          <button type="button" onClick={copyConnection} className="flex-1 py-4 bg-black text-white font-black text-sm rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            复制地址
          </button>
          <Link to="/tickets/new" className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MobileServerDetail;
