import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, RefreshCcw, Server } from 'lucide-react';
import { api } from '../../api/request';
import { useAuthStore } from '../../store/authStore';
import { toArray } from '../../utils/apiData';

interface Stats {
  totalUsers?: number;
  totalServers?: number;
  onlineServers?: number;
  totalPlayers?: number;
}

export default function MobileAdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN' || user?.role === 'admin';

  const statsQuery = useQuery({
    queryKey: ['stats', 'mobile-dashboard'],
    queryFn: () => api.get<Stats>('/stats', undefined, { useAuth: false }),
  });

  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'mobile-dashboard'],
    queryFn: () => api.get<any>('/tickets', { limit: 100 }),
  });

  const loading = statsQuery.isLoading || ticketsQuery.isLoading;
  const stats = statsQuery.data || {};
  const tickets = toArray<any>(ticketsQuery.data);
  const activeTickets = tickets.filter((ticket) => ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED').length;
  const health =
    stats.totalServers && stats.totalServers > 0
      ? `${Math.round(((stats.onlineServers || 0) / stats.totalServers) * 100)}%`
      : '0%';

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-zinc-200 animate-pulse">
              <div className="h-8 bg-zinc-200 rounded w-16 mb-2" />
              <div className="h-3 bg-zinc-200 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {(statsQuery.isError || ticketsQuery.isError) && (
        <button
          type="button"
          onClick={() => {
            statsQuery.refetch();
            ticketsQuery.refetch();
          }}
          className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-black text-red-500 flex items-center justify-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" />
          数据加载不完整，点击重试
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-zinc-900">{(stats.onlineServers || 0).toLocaleString()}</div>
          <div className="text-xs text-zinc-500">在线服务器</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-zinc-900">{(stats.totalUsers || 0).toLocaleString()}</div>
          <div className="text-xs text-zinc-500">注册用户</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-zinc-900">{activeTickets}</div>
          <div className="text-xs text-zinc-500">{isAdmin ? '待处理工单' : '我的未结工单'}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-emerald-600">{health}</div>
          <div className="text-xs text-zinc-500">在线率</div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">快速操作</h3>
        <div className="space-y-2">
          <Link to="/tickets" className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <MessageSquare className="h-4 w-4" />
            </span>
            <span className="text-sm text-zinc-700">查看工单列表</span>
          </Link>
          <Link to="/servers" className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Server className="h-4 w-4" />
            </span>
            <span className="text-sm text-zinc-700">服务器列表</span>
          </Link>
          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white">
                <LayoutDashboard className="h-4 w-4" />
              </span>
              <span className="text-sm text-zinc-700">管理面板</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
