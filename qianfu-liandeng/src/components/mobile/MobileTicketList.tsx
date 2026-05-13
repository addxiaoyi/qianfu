import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, ChevronRight, Clock,
  AlertCircle, CheckCircle, Filter, Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

type TicketStatus = 'open' | 'pending' | 'closed';

interface Ticket {
  id: string;
  title: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high';
  replies: number;
  lastReply: string;
  category: string;
}

const mockTickets: Ticket[] = [
  { id: '1', title: '服务器连接问题', status: 'open', priority: 'high', replies: 5, lastReply: '2小时前', category: '技术支持' },
  { id: '2', title: '支付失败反馈', status: 'pending', priority: 'high', replies: 3, lastReply: '1天前', category: '支付问题' },
  { id: '3', title: '功能建议：暗黑模式', status: 'open', priority: 'low', replies: 1, lastReply: '3天前', category: '功能建议' },
  { id: '4', title: '账户登录异常', status: 'closed', priority: 'medium', replies: 7, lastReply: '1周前', category: '账户问题' },
  { id: '5', title: 'API 使用咨询', status: 'open', priority: 'medium', replies: 2, lastReply: '2天前', category: '技术咨询' },
];

const statusConfig = {
  open: { label: '进行中', color: 'bg-blue-500', bg: 'bg-blue-50 text-blue-600' },
  pending: { label: '待回复', color: 'bg-yellow-500', bg: 'bg-yellow-50 text-yellow-600' },
  closed: { label: '已解决', color: 'bg-green-500', bg: 'bg-green-50 text-green-600' },
};

const priorityConfig = {
  low: { label: '低', color: 'text-zinc-400' },
  medium: { label: '中', color: 'text-orange-500' },
  high: { label: '高', color: 'text-red-500' },
};

/** Debounce helper — returns latest value after `delay` ms of inactivity. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const MobileTicketList: React.FC = () => {
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [rawSearch, setRawSearch] = useState('');
  const debouncedSearch = useDebounce(rawSearch, 300);

  const filteredTickets = useMemo(
    () =>
      mockTickets.filter((ticket) => {
        const matchFilter = filter === 'all' || ticket.status === filter;
        const matchSearch =
          !debouncedSearch ||
          ticket.title.includes(debouncedSearch) ||
          ticket.category.includes(debouncedSearch);
        return matchFilter && matchSearch;
      }),
    [filter, debouncedSearch],
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/me" className="flex items-center gap-1 text-sm font-bold">
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <h1 className="text-base font-black uppercase tracking-tight">工单</h1>
          <Link to="/tickets/new">
            <Plus className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="搜索工单..."
            className="w-full pl-10 pr-4 py-3 bg-white rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { key: 'all' as const, label: '全部' },
            { key: 'open' as const, label: '进行中' },
            { key: 'pending' as const, label: '待回复' },
            { key: 'closed' as const, label: '已解决' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
                filter === tab.key
                  ? 'bg-black text-white'
                  : 'bg-white text-zinc-600',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      <div className="px-4 space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">暂无工单</p>
            <Link
              to="/tickets/new"
              className="mt-4 inline-block text-sm font-bold text-primary"
            >
              创建新工单
            </Link>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const status = statusConfig[ticket.status];
            const priority = priorityConfig[ticket.priority];

            return (
              <motion.div
                key={ticket.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={`/tickets/${ticket.id}`}
                  className="block bg-white rounded-2xl p-4 space-y-3"
                >
                  {/* Title and Status */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold flex-1">{ticket.title}</h3>
                    <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap', status.bg)}>
                      {status.label}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {ticket.lastReply}
                    </span>
                    <span className="flex items-center gap-1">
                      💬 {ticket.replies} 回复
                    </span>
                    <span>{ticket.category}</span>
                    <span className={cn('font-bold', priority.color)}>
                      优先级: {priority.label}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-100" />
                </Link>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MobileTicketList;
