import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, MessageSquare, User, Server,
  Check, Trash2, ChevronRight, Filter
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface Notification {
  id: string;
  type: 'system' | 'message' | 'player' | 'server';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const notifications: Notification[] = [
  {
    id: '1',
    type: 'system',
    title: '系统通知',
    message: '平台升级完成，体验更加流畅！',
    time: '2 分钟前',
    read: false,
  },
  {
    id: '2',
    type: 'player',
    title: '新玩家加入',
    message: '张三 加入了你的服务器',
    time: '15 分钟前',
    read: false,
  },
  {
    id: '3',
    type: 'message',
    title: '新消息',
    message: '李四 向你发送了一条消息',
    time: '1 小时前',
    read: true,
  },
  {
    id: '4',
    type: 'server',
    title: '服务器状态',
    message: '你的服务器已恢复在线',
    time: '3 小时前',
    read: true,
  },
];

const typeConfig = {
  system: { icon: Bell, bg: 'bg-blue-100', color: 'text-blue-500' },
  message: { icon: MessageSquare, bg: 'bg-green-100', color: 'text-green-500' },
  player: { icon: User, bg: 'bg-purple-100', color: 'text-purple-500' },
  server: { icon: Server, bg: 'bg-orange-100', color: 'text-orange-500' },
};

const MobileNotifications: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [list, setList] = useState(notifications);

  const markAllRead = () => {
    setList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const deleteAll = () => {
    setList([]);
  };

  const filtered = filter === 'unread' ? list.filter((n) => !n.read) : list;
  const unreadCount = list.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-base font-black uppercase tracking-tight">通知</h1>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-bold text-primary"
              >
                全部已读
              </button>
            )}
          </div>
        </div>
        {/* Filter */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-bold transition-colors',
              filter === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-muted-foreground'
            )}
          >
            全部
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-bold transition-colors',
              filter === 'unread' ? 'bg-black text-white' : 'bg-gray-100 text-muted-foreground'
            )}
          >
            未读
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-bold">暂无通知</p>
          </div>
        ) : (
          filtered.map((item, index) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => markRead(item.id)}
                className={cn(
                  'flex gap-3 p-4 rounded-2xl transition-colors',
                  !item.read ? 'bg-gray-50' : '',
                  'active:opacity-80'
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', config.bg)}>
                  <Icon className={cn('w-5 h-5', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'text-sm font-bold',
                      !item.read ? 'text-black' : 'text-muted-foreground'
                    )}>
                      {item.title}
                    </span>
                    {!item.read && (
                      <div className="w-2 h-2 bg-black rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className={cn(
                    'text-xs mt-1 truncate',
                    !item.read ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {item.message}
                  </p>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {item.time}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {list.length > 0 && (
        <div className="px-4 pb-24">
          <button
            onClick={deleteAll}
            className="w-full py-4 bg-white border border-gray-100 rounded-2xl text-red-500 font-bold text-sm active:bg-red-50"
          >
            清空通知
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileNotifications;
