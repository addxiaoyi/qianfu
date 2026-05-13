import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Heart, Share2, MapPin,
  Users, Server, Clock, Star,
  MessageSquare, Play, ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { LazyImage } from './MobileLazyImage';
import { CardSkeleton } from './MobileSkeleton';

interface ServerData {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  maxPlayers: number;
  currentPlayers: number;
  rating: number;
  images: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface MobileServerDetailProps {
  serverId?: string;
}

const MobileServerDetail: React.FC<MobileServerDetailProps> = ({ serverId = '1' }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'reviews' | 'similar'>('info');

  // Mock data — in real app, fetch from API
  const server: ServerData = {
    id: serverId,
    name: '无尽生存服务器',
    description: '一个专注于生存模式的社区驱动服务器，拥有活跃的管理团队和丰富的插件生态。我们提供稳定的游戏环境和友好的玩家社区。',
    category: '生存',
    version: '1.20.4',
    maxPlayers: 100,
    currentPlayers: 42,
    rating: 4.8,
    images: [
      'https://picsum.photos/seed/server1/800/400',
      'https://picsum.photos/seed/server2/800/400',
      'https://picsum.photos/seed/server3/800/400',
    ],
    tags: ['生存', 'PVP', 'RPG', '经济系统'],
    createdAt: '2024-01-15',
    updatedAt: '2024-03-20',
  };

  const tabs = [
    { id: 'info' as const, label: '详情' },
    { id: 'reviews' as const, label: '评价' },
    { id: 'similar' as const, label: '相似' },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Hero Image Carousel */}
      <div className="relative h-64 overflow-hidden">
        {server.images.map((img, index) => (
          <LazyImage
            key={index}
            src={img}
            alt={server.name}
            className={cn('w-full h-full object-cover', index !== 0 && 'hidden')}
          />
        ))}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Back button */}
        <Link to="/mobile">
          <div className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>

        {/* Favorite & Share */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
          >
            <Heart className={cn('w-5 h-5', isFavorite ? 'fill-red-500 text-red-500' : 'text-white')} />
          </button>
          <button className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Server name overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-black text-white leading-tight">{server.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase">
              {server.category}
            </span>
            <span className="text-xs font-mono text-white/80">v{server.version}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-lg font-black">{server.currentPlayers}</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">在线</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-lg font-black">{server.rating}</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">评分</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-green-500" />
              <span className="text-lg font-black">99.9%</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">在线率</p>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="px-4 mt-4">
        <div className="flex flex-wrap gap-2">
          {server.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-wider"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-6">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-3 text-sm font-bold uppercase tracking-wider relative',
                activeTab === tab.id ? 'text-black' : 'text-muted-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 py-6">
        {activeTab === 'info' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider mb-3">服务器介绍</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{server.description}</p>
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-wider mb-3">服务器信息</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-muted-foreground">服务器类型</span>
                  <span className="text-xs font-black flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    Java Edition
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-muted-foreground">最大玩家数</span>
                  <span className="text-xs font-black">{server.maxPlayers} 人</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-muted-foreground">创建时间</span>
                  <span className="text-xs font-black">{server.createdAt}</span>
                </div>
              </div>
            </div>

            {/* IP Address */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">服务器 IP</p>
              <p className="text-lg font-mono font-black tracking-wider">play.qianfu.com</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <p className="text-xs font-black">玩家{i}</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, i <= 2 ? 5 : 4].map((star) => (
                        <Star
                          key={star}
                          className={cn('w-3 h-3', star <= 4 ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300')}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  这是一个非常棒的服务器！玩家社区很友好，管理员也很负责。强烈推荐！
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'similar' && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Link
                key={i}
                to={`/server/${i + 10}`}
                className="flex gap-4 p-4 border border-gray-100 rounded-2xl active:bg-gray-50 transition-colors"
              >
                <div className="w-20 h-20 bg-gray-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-black">相似服务器 #{i}</h4>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-black text-white text-[8px] font-bold rounded">生存</span>
                    <span className="text-[10px] font-mono text-muted-foreground">4.7</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-gray-100 md:hidden">
        <div className="flex gap-3">
          <button className="flex-1 py-4 bg-black text-white font-black text-sm rounded-2xl active:scale-95 transition-transform">
            开始游戏
          </button>
          <button className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileServerDetail;
