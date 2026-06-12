import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, MessageSquare, User, Server } from 'lucide-react';
import { api } from '../../api/request';
import { cn } from '../../utils/cn';
import { formatDateTime } from '../../utils/serverView';
import { toArray } from '../../utils/apiData';

interface Notification {
  id: number | string;
  type?: 'system' | 'message' | 'player' | 'server' | string;
  title?: string;
  message?: string;
  content?: string;
  created_at?: string;
  createdAt?: string;
  is_read?: boolean;
  read?: boolean;
}

const typeConfig = {
  system: { icon: Bell, bg: 'bg-blue-100', color: 'text-blue-500' },
  message: { icon: MessageSquare, bg: 'bg-green-100', color: 'text-green-500' },
  player: { icon: User, bg: 'bg-zinc-100', color: 'text-zinc-500' },
  server: { icon: Server, bg: 'bg-orange-100', color: 'text-orange-500' },
};

const resolveType = (type: unknown): keyof typeof typeConfig => {
  const value = String(type || 'system').toLowerCase();
  return value in typeConfig ? value as keyof typeof typeConfig : 'system';
};

const isUnread = (item: Notification) => item.is_read === false || item.read === false;

const MobileNotifications: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: listResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', 'mobile'],
    queryFn: () => api.get<any>('/notifications'),
  });
  const list = toArray<Notification>(listResponse);

  const markReadMutation = useMutation({
    mutationFn: (id: Notification['id']) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const filtered = useMemo(
    () => filter === 'unread' ? list.filter(isUnread) : list,
    [filter, list],
  );
  const unreadCount = list.filter(isUnread).length;

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-base font-black uppercase tracking-tight">通知</h1>
          {unreadCount > 0 && (
            <button type="button" onClick={() => markAllReadMutation.mutate()} className="text-xs font-bold text-primary">
              全部已读
            </button>
          )}
        </div>
        <div className="flex gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={cn('px-4 py-1.5 rounded-lg text-xs font-bold transition-colors', filter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-muted-foreground')}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={cn('px-4 py-1.5 rounded-lg text-xs font-bold transition-colors', filter === 'unread' ? 'bg-black text-white' : 'bg-gray-100 text-muted-foreground')}
          >
            未读 {unreadCount > 0 ? unreadCount : ''}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((item) => <div key={item} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />)
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Bell className="w-8 h-8 text-red-300" />
            <p className="text-sm text-muted-foreground font-bold">通知加载失败</p>
            <button type="button" onClick={() => refetch()} className="px-5 py-3 rounded-xl bg-black text-white text-xs font-black">重试</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-bold">暂无通知</p>
          </div>
        ) : (
          filtered.map((item, index) => {
            const config = typeConfig[resolveType(item.type)];
            const Icon = config.icon;
            const unread = isUnread(item);
            return (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => unread && markReadMutation.mutate(item.id)}
                className={cn('w-full text-left flex gap-3 p-4 rounded-2xl transition-colors', unread ? 'bg-gray-50' : 'bg-white', 'active:opacity-80')}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', config.bg)}>
                  <Icon className={cn('w-5 h-5', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm font-bold', unread ? 'text-black' : 'text-muted-foreground')}>
                      {item.title || '系统通知'}
                    </span>
                    {unread && <div className="w-2 h-2 bg-black rounded-full flex-shrink-0" />}
                  </div>
                  <p className={cn('text-xs mt-1 truncate', unread ? 'text-foreground' : 'text-muted-foreground')}>
                    {item.message || item.content || '暂无内容'}
                  </p>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {formatDateTime(item.created_at || item.createdAt)}
                  </span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MobileNotifications;
