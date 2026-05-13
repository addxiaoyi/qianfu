import { useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';

interface Stats {
  onlineServers: number;
  registeredUsers: number;
  pendingTickets: number;
  systemHealth: string;
}

interface Ticket {
  id: string;
  title: string;
  user: string;
  status: 'pending' | 'processing' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  time: string;
}

const mockApi = <T,>(data: T, delay = 500): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), delay));

const mockStats: Stats = {
  onlineServers: 1234,
  registeredUsers: 567,
  pendingTickets: 42,
  systemHealth: '98%',
};

/** Generate slightly varying stats to simulate real API responses. */
function generateMockStats(): Stats {
  const jitter = (base: number, pct: number) => base + Math.floor(Math.random() * base * pct * 2 - base * pct);
  return {
    onlineServers: jitter(mockStats.onlineServers, 0.05),
    registeredUsers: jitter(mockStats.registeredUsers, 0.02),
    pendingTickets: Math.max(0, mockStats.pendingTickets + Math.floor(Math.random() * 5 - 2)),
    systemHealth: `${(97 + Math.random() * 2.9).toFixed(1)}%`,
  };
}

let fetchCallCount = 0;
async function fetchStats(): Promise<Stats> {
  fetchCallCount += 1;
  return mockApi(generateMockStats(), 400 + Math.random() * 300);
}

export default function MobileAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    let cancelled = false;
    fetchStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return loadData();
  }, [loadData]);

  // Show skeleton while loading
  if (loading || !stats) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-4 border border-zinc-200 animate-pulse"
            >
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
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-zinc-900">
            {stats.onlineServers.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500">在线服务器</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-zinc-900">
            {stats.registeredUsers.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500">注册用户</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-zinc-900">
            {stats.pendingTickets}
          </div>
          <div className="text-xs text-zinc-500">待审工单</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="text-2xl font-bold text-emerald-600">
            {stats.systemHealth}
          </div>
          <div className="text-xs text-zinc-500">系统健康度</div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 border border-zinc-200">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">快速操作</h3>
        <div className="space-y-2">
          <a
            href="/mobile/tickets"
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">
              🎫
            </span>
            <span className="text-sm text-zinc-700">查看工单列表</span>
          </a>
          <a
            href="/admin"
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm">
              ⚙️
            </span>
            <span className="text-sm text-zinc-700">管理面板</span>
          </a>
          <a
            href="/mobile/users"
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm">
              👥
            </span>
            <span className="text-sm text-zinc-700">用户管理</span>
          </a>
        </div>
      </div>
    </div>
  );
}
