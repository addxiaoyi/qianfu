import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, MessageSquare, User, ArrowRight, Shield, Bell, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/request';
import { cn } from '../../utils/cn';
import { formatDateTime } from '../../utils/serverView';
import { toArray } from '../../utils/apiData';

type Tab = 'inbox' | 'system' | 'support';

interface ConversationItem {
  id: string;
  title: string;
  lastMsg: string;
  time: string;
  timestamp: number;
  unread: boolean;
  href: string;
  type: Tab;
}

const tabConfig: Record<Tab, { label: string; icon: React.ElementType }> = {
  inbox: { label: '全部', icon: MessageSquare },
  system: { label: '系统', icon: Shield },
  support: { label: '工单', icon: User },
};

const MobileMessages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');

  const notificationQuery = useQuery({
    queryKey: ['notifications', 'mobile-messages'],
    queryFn: () => api.get<any>('/notifications'),
  });
  const notifications = toArray<any>(notificationQuery.data);

  const ticketQuery = useQuery({
    queryKey: ['tickets', 'mobile-messages'],
    queryFn: () => api.get<any>('/tickets', { limit: 50 }),
  });
  const tickets = toArray<any>(ticketQuery.data);

  const items = useMemo<ConversationItem[]>(() => {
    const noticeItems = notifications.map((item: any) => ({
      id: `notification-${item.id}`,
      title: item.title || '系统通知',
      lastMsg: item.message || item.content || '暂无内容',
      time: formatDateTime(item.created_at || item.createdAt),
      timestamp: new Date(String(item.created_at || item.createdAt || 0)).getTime() || 0,
      unread: item.is_read === false || item.read === false,
      href: '/me/notifications',
      type: 'system' as const,
    }));

    const ticketItems = tickets.map((ticket: any) => ({
      id: `ticket-${ticket.id}`,
      title: ticket.title || ticket.subject || `工单 #${ticket.id}`,
      lastMsg: ticket.description || ticket.messages?.[0]?.content || ticket.status || '暂无最新回复',
      time: formatDateTime(ticket.updated_at || ticket.updatedAt || ticket.created_at),
      timestamp: new Date(String(ticket.updated_at || ticket.updatedAt || ticket.created_at || 0)).getTime() || 0,
      unread: ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED',
      href: `/tickets/${ticket.id}`,
      type: 'support' as const,
    }));

    return [...noticeItems, ...ticketItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [notifications, tickets]);

  const filteredMessages = items.filter((item) => {
    const matchTab = activeTab === 'inbox' || item.type === activeTab;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || `${item.title} ${item.lastMsg}`.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });
  const unreadCount = items.filter((item) => item.unread).length;

  return (
    <div className="space-y-4 pb-4">
      <div className="rounded-2xl border border-zinc-100 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">MESSAGES</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">消息中心</h2>
          </div>
          <div className="rounded-xl bg-zinc-900 px-3 py-2 text-center text-white">
            <p className="text-base font-black leading-none">{unreadCount}</p>
            <p className="mt-1 text-[9px] font-bold text-white/60">未读</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          aria-label="搜索消息"
          placeholder="搜索消息..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
        />
      </div>

      <div className="flex gap-2 bg-white p-1 rounded-xl border border-zinc-200">
        {(Object.keys(tabConfig) as Tab[]).map((tab) => {
          const Icon = tabConfig[tab].icon;
          return (
            <button
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              <Icon className="w-4 h-4" />
              {tabConfig[tab].label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden">
        {notificationQuery.isLoading || ticketQuery.isLoading ? (
          <div className="space-y-3 p-4" aria-label="正在加载消息">
            {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-zinc-100" />)}
          </div>
        ) : notificationQuery.isError || ticketQuery.isError ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-red-200 mb-3" />
            <p className="text-sm font-semibold text-zinc-600">消息加载失败</p>
            <button type="button" onClick={() => { void notificationQuery.refetch(); void ticketQuery.refetch(); }} className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white">重试</button>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-zinc-200 mb-3" />
            <p className="text-sm font-semibold text-zinc-500">{searchQuery.trim() || activeTab !== 'inbox' ? '没有匹配的消息' : '暂无消息'}</p>
            <p className="mt-2 text-xs text-zinc-400">{searchQuery.trim() || activeTab !== 'inbox' ? '调整搜索或分类条件后重试。' : '系统通知和工单回复会显示在这里。'}</p>
          </div>
        ) : (
          filteredMessages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link to={msg.href} className="flex items-center gap-3 p-4 hover:bg-zinc-50 active:bg-zinc-100 transition-colors">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 bg-zinc-100 rounded-full flex items-center justify-center">
                    {msg.type === 'system' ? <Bell className="w-5 h-5 text-zinc-500" /> : <MessageSquare className="w-5 h-5 text-zinc-500" />}
                  </div>
                  {msg.unread && <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-zinc-900 truncate">{msg.title}</span>
                    <span className="text-xs text-zinc-400 ml-2 shrink-0">{msg.time}</span>
                  </div>
                  <p className="text-sm text-zinc-500 truncate">{msg.lastMsg}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-300 shrink-0" />
              </Link>
            </motion.div>
          ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/tickets" className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-zinc-700">工单中心</span>
        </Link>
        <Link to="/tickets/new" className="bg-white rounded-xl border border-zinc-200 p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors">
          <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
            <Plus className="w-5 h-5 text-zinc-600" />
          </div>
          <span className="text-sm font-medium text-zinc-700">新建工单</span>
        </Link>
      </div>
    </div>
  );
};

export default MobileMessages;
