import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Clock, AlertCircle, Plus, MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/request';
import { cn } from '../../utils/cn';
import { formatDateTime } from '../../utils/serverView';
import { toArray } from '../../utils/apiData';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface Ticket {
  id: number | string;
  title?: string;
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  updated_at?: string;
  updatedAt?: string;
  created_at?: string;
  messages?: unknown[];
}

const statusConfig: Record<TicketStatus, { label: string; bg: string }> = {
  OPEN: { label: '进行中', bg: 'bg-blue-50 text-blue-600' },
  IN_PROGRESS: { label: '处理中', bg: 'bg-amber-50 text-amber-600' },
  RESOLVED: { label: '已解决', bg: 'bg-green-50 text-green-600' },
  CLOSED: { label: '已关闭', bg: 'bg-zinc-100 text-zinc-500' },
};

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  LOW: { label: '低', color: 'text-zinc-400' },
  MEDIUM: { label: '中', color: 'text-orange-500' },
  HIGH: { label: '高', color: 'text-red-500' },
  URGENT: { label: '紧急', color: 'text-red-600' },
};

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
  const debouncedSearch = useDebounce(rawSearch.trim(), 250);

  const { data: ticketResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'mobile'],
    queryFn: () => api.get<any>('/tickets', { limit: 100 }),
  });
  const tickets = toArray<Ticket>(ticketResponse);

  const filteredTickets = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return tickets.filter((ticket) => {
      const status = ticket.status || 'OPEN';
      const title = ticket.title || ticket.subject || '';
      const body = ticket.description || '';
      const matchFilter = filter === 'all' || status === filter;
      const matchSearch = !q || `${title} ${body}`.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [tickets, filter, debouncedSearch]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              name="ticket-search"
              aria-label="搜索工单"
              autoComplete="off"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              placeholder="搜索工单..."
              className="w-full pl-10 pr-4 py-3 bg-white rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <Link
            to="/tickets/new"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black text-white"
            aria-label="新建工单"
          >
            <Plus className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { key: 'all' as const, label: '全部' },
            { key: 'OPEN' as const, label: '进行中' },
            { key: 'IN_PROGRESS' as const, label: '处理中' },
            { key: 'RESOLVED' as const, label: '已解决' },
            { key: 'CLOSED' as const, label: '已关闭' },
          ].map((tab) => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              aria-pressed={filter === tab.key}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
                filter === tab.key ? 'bg-black text-white' : 'bg-white text-zinc-600',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((item) => <div key={item} className="h-32 rounded-2xl bg-white animate-pulse" />)
        ) : isError ? (
          <div className="py-16 text-center">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">工单加载失败</p>
            <button type="button" onClick={() => refetch()} className="mt-4 text-sm font-black text-black">重试</button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-base font-black text-zinc-800">还没有工单</p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-zinc-500">审核申诉、账号问题、充值异常或违规举报都可以在这里留下可追踪记录。</p>
            <Link to="/tickets/new" className="mt-5 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-bold text-white">
              新建第一张工单
            </Link>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
            <p className="text-sm font-bold text-zinc-700">没有符合条件的工单</p>
            <button
              type="button"
              onClick={() => {
                setRawSearch('');
                setFilter('all');
              }}
              className="mt-4 text-sm font-bold text-black underline underline-offset-4"
            >
              清除搜索和筛选
            </button>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const status = statusConfig[ticket.status || 'OPEN'];
            const priority = priorityConfig[ticket.priority || 'MEDIUM'];
            const title = ticket.title || ticket.subject || `工单 #${ticket.id}`;
            const replies = Array.isArray(ticket.messages) ? Math.max(ticket.messages.length - 1, 0) : 0;

            return (
              <motion.div
                key={ticket.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link to={`/tickets/${ticket.id}`} className="block bg-white rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold flex-1 line-clamp-2">{title}</h3>
                    <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap', status.bg)}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(ticket.updated_at || ticket.updatedAt || ticket.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {replies} 回复
                    </span>
                    <span className={cn('font-bold', priority.color)}>
                      优先级: {priority.label}
                    </span>
                  </div>
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
