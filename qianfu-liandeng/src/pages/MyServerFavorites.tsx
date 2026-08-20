/**
 * 我的收藏服务器页面
 * 优化项 302: 用户偏好 - 服务器收藏功能
 * 优化项 22: 预加载Next-fetch - getServerSideProps
 *
 * 用户收藏的服务器列表页面，支持：
 * - 显示收藏的服务器卡片
 * - 复制服务器 IP
 * - 取消收藏功能（带乐观更新）
 * - 空状态处理
 * - 路由预加载优化
 */
import React, { useState, useEffect } from 'react';
import { copyText } from '@/utils/clipboard';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Globe, Users, Copy, Award, Server, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFavoriteServers, useToggleFavorite, type FavoriteServer } from '@/hooks/useFavoriteServers';
import { useAuthStore } from '@/store/authStore';
import { isImageUrlSafe } from '@/utils/urlValidator';
import { toast } from '@/hooks/use-toast';

// ============================================================
// 类型定义
// ============================================================

interface ServerCardProps {
  server: FavoriteServer;
  index: number;
}

// ============================================================
// 工具函数
// ============================================================

const getSafeImageUrl = (url: string | undefined): string => {
  return url && isImageUrlSafe(url) ? url : '/placeholder-server.jpg';
};

// ============================================================
// 服务器卡片组件
// ============================================================

const ServerFavoriteCard: React.FC<ServerCardProps> = ({ server, index }) => {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const toggleFavorite = useToggleFavorite(server.id);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await copyText(server.ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: '复制失败', description: `请手动复制：${server.ip}` });
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate(undefined, {
      onError: () => toast({ variant: 'destructive', title: '取消收藏失败', description: '请稍后重试。' }),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.08, duration: 0.6 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={`/server/${server.id}`}
        className="group relative block rounded-[1.5rem] overflow-hidden bg-white border border-zinc-200 hover:border-zinc-400 transition-all duration-500 shadow-sm hover:shadow-xl"
      >
        {/* 封面图片 */}
        <div className="aspect-video overflow-hidden relative bg-zinc-100">
          <img
            src={getSafeImageUrl(server.image)}
            alt={server.name}
            className={`w-full h-full object-cover transition-all duration-700 ${
              isHovered ? 'scale-105 grayscale-0' : 'grayscale'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* 在线状态 */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                server.online ? 'bg-green-500 animate-pulse' : 'bg-zinc-400'
              }`}
            />
            <span className="text-white text-[10px] font-bold uppercase tracking-wider">
              {server.online ? '在线' : '离线'}
            </span>
          </div>

          {/* 移除按钮 */}
          <button
            type="button"
            onClick={handleRemove}
            disabled={toggleFavorite.isPending}
            aria-label={`取消收藏 ${server.name}`}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all hover:bg-red-500 hover:scale-110 disabled:opacity-50"
          >
            <Heart className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4">
          {/* 分类 */}
          <div className="flex items-center justify-between">
            {server.category && (
              <span className="px-2.5 py-1 bg-zinc-100 text-zinc-600 text-[10px] font-semibold uppercase tracking-wider rounded-full">
                {server.category}
              </span>
            )}
            {server.players !== undefined && (
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold">{server.players}</span>
              </div>
            )}
          </div>

          {/* 服务器名称 */}
          <h3 className="text-xl font-bold leading-tight group-hover:text-amber-600 transition-colors">
            {server.name}
          </h3>

          {/* IP 地址 */}
          <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl text-white">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-500" />
              <span className="font-mono font-semibold text-sm">{server.ip}</span>
            </div>
            <button
              type="button"
              onClick={(event) => { void handleCopy(event); }}
              aria-label={`复制服务器地址 ${server.ip}`}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {copied ? (
                <Award className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-400" />
              )}
            </button>
          </div>

          {/* 版本 */}
          {server.version && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Protocol v{server.version}
            </p>
          )}
        </div>

        {/* 悬停强调线 */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </Link>
    </motion.div>
  );
};

// ============================================================
// 空状态组件
// ============================================================

const EmptyState: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
        <Server className="w-12 h-12 text-zinc-300" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-700 mb-2">暂无收藏</h2>
      <p className="text-zinc-400 mb-8 max-w-md">
        浏览服务器时点击收藏按钮，之后可以在这里快速找到它
      </p>
      <Link
        to="/servers"
        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
      >
        <Server className="w-5 h-5" />
        浏览服务器
        <ChevronRight className="w-4 h-4" />
      </Link>
    </motion.div>
  );
};

// ============================================================
// 加载状态
// ============================================================

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-[1.5rem] overflow-hidden bg-white border border-zinc-200 animate-pulse">
          <div className="aspect-video bg-zinc-200" />
          <div className="p-5 space-y-4">
            <div className="flex justify-between">
              <div className="h-6 w-20 bg-zinc-200 rounded-full" />
              <div className="h-6 w-12 bg-zinc-200 rounded-full" />
            </div>
            <div className="h-7 w-3/4 bg-zinc-200 rounded" />
            <div className="h-10 bg-zinc-200 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// 主页面组件
// ============================================================

export default function MyServerFavorites() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // 原有 React Query 数据获取
  const { data, isLoading, isError, refetch } = useFavoriteServers(1, 50);

  const favorites = data ?? [];

  // 未认证时重定向
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 头部 */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-amber-500 fill-amber-500" />
            <h1 className="text-3xl font-bold text-zinc-900">我的收藏</h1>
          </div>
          <p className="text-zinc-500">
            {favorites.length > 0
              ? `已收藏 ${favorites.length} 个服务器`
              : '收藏你喜欢的服务器，方便快速访问'}
          </p>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">加载失败</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              重试
            </button>
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {favorites.map((server, index) => (
                <ServerFavoriteCard key={server.id} server={server} index={index} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
