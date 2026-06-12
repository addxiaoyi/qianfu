import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { api } from '@/api/request';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminStatCard from '@/components/AdminStatCard';
import GeometricLantern from '@/components/icons/GeometricLantern';
import StatusWrapper from '@/components/StatusWrapper';
import { formatDateTime } from '@/utils/serverView';

type AuditStats = {
  period: string;
  totalEvents: number;
  todayEvents: number;
  eventsByType: Record<string, number>;
  topUsers: Array<{
    user_id: number;
    username?: string | null;
    role?: string | null;
    event_count: number;
  }>;
};

type AuditPoint = {
  time: string;
  count: number;
};

const AdminAuditStats: React.FC = () => {
  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-audit-stats-page'],
    queryFn: () => api.get<AuditStats>('/audit/stats', { days: 7 }),
  });

  const { data: timeseries = [] } = useQuery({
    queryKey: ['admin-audit-timeseries-page'],
    queryFn: () => api.get<AuditPoint[]>('/audit/timeseries', { days: 1, interval: 'hour' }),
  });

  const chartData = useMemo(() => {
    const max = Math.max(1, ...timeseries.map((item) => item.count));
    return timeseries.map((item) => ({
      ...item,
      ratio: Math.max(6, Math.round((item.count / max) * 100)),
    }));
  }, [timeseries]);

  const topAction = Object.entries(stats?.eventsByType || {}).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-16 pb-32 bg-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader
          badge="审计统计 / 最近 7 天"
          title="审计洞察"
          description="审计统计页现已接入真实 `/audit/stats` 与 `/audit/timeseries` 数据，不再显示伪造吞吐和延迟数字。"
          statusLabel={`Period ${stats?.period || '7d'}`}
          statusTone="success"
          rightSlot={(
            <div className="flex gap-6">
              <button type="button" className="group px-10 py-6 border border-zinc-50 rounded-[2.5rem] bg-zinc-50/30 text-[11px] font-black uppercase tracking-[0.4em] flex items-center gap-4 hover:bg-white hover:border-zinc-200 transition-all duration-500 shadow-xs italic active:scale-[0.98]">
                <GeometricLantern variant="data" className="w-5 h-5 group-hover:rotate-12 transition-transform duration-500" /> 导出 JSON
              </button>
              <button type="button" className="group px-12 py-6 btn-accent rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.5em] flex items-center gap-6 transition-all duration-500 shadow-2xl shadow-accent/20 italic active:scale-[0.98]">
                生成报告 <ChevronRight className="w-5 h-5 group-hover:translate-x-4 transition-transform duration-500" />
              </button>
            </div>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10">
          {[
            { label: '总事件数', value: String(stats?.totalEvents ?? 0), trend: stats?.period || '7d', up: true, variant: 'user' as const, color: 'text-blue-500', tag: 'AN_01' },
            { label: '今日事件', value: String(stats?.todayEvents ?? 0), trend: 'today', up: true, variant: 'network' as const, color: 'text-green-500', tag: 'AN_02' },
            { label: '最高频动作', value: topAction?.[1]?.toString() || '0', trend: topAction?.[0] || 'none', up: true, variant: 'terminal' as const, color: 'text-orange-500', tag: 'AN_03' },
            { label: '活跃操作人', value: String(stats?.topUsers?.length ?? 0), trend: 'contributors', up: true, variant: 'activity' as const, color: 'text-zinc-400', tag: 'AN_04' },
          ].map((item, idx) => (
            <AdminStatCard key={item.label} tag={item.tag} value={item.value} label={item.label} variant={item.variant} colorClassName={item.color} trend={item.trend} delay={idx * 0.1} up={item.up} />
          ))}
        </div>

        <section className="p-16 border border-zinc-50 rounded-[5rem] bg-white space-y-16 shadow-xs relative overflow-hidden">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10 relative z-10">
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="w-3 h-3 bg-accent rounded-full shadow-accent/20 animate-pulse" />
                <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none text-accent">小时分布</h3>
              </div>
              <p className="text-[11px] font-black font-mono text-zinc-300 uppercase tracking-[0.5em] italic border-l-2 border-zinc-50 pl-10">按小时统计真实审计事件数量</p>
            </div>
            <div className="px-6 py-3 bg-zinc-50 border border-zinc-100 rounded-sm text-[11px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic flex items-center gap-4">
              <GeometricLantern variant="terminal" className="w-4 h-4 opacity-50" /> 统计间隔：1 小时
            </div>
          </div>

          <div className="h-[400px] flex items-end gap-2 md:gap-4 px-4 relative z-10 pt-10">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
              {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-black" />)}
            </div>
            {chartData.map((item) => (
              <div key={item.time} className="flex-grow flex flex-col items-center gap-6 group/bar">
                <div className="flex-grow w-full flex flex-col justify-end">
                  <motion.div initial={{ height: 0 }} animate={{ height: `${item.ratio}%` }} transition={{ duration: 0.8 }} className="w-full bg-zinc-50 group-hover/bar:bg-accent transition-all duration-700 rounded-sm relative shadow-xs">
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent text-white text-[10px] font-black font-mono rounded shadow-2xl opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 italic">
                      {item.count}
                    </div>
                  </motion.div>
                </div>
                <span className="text-[9px] font-black font-mono text-zinc-200 uppercase tracking-widest group-hover/bar:text-black transition-all italic h-4">
                  {item.time.slice(11, 16)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <section className="lg:col-span-7 p-16 border border-zinc-50 rounded-[4rem] bg-white space-y-12 shadow-xs">
            <div className="flex items-center gap-8">
              <div className="w-20 h-20 bg-zinc-50 rounded-[2.5rem] flex items-center justify-center text-zinc-100 shadow-xs">
                <GeometricLantern variant="network" className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none">动作分布</h3>
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em] italic">统计周期内最常见的审计动作</p>
              </div>
            </div>
            <div className="space-y-10">
              {Object.entries(stats?.eventsByType || {}).slice(0, 6).map(([action, count]) => {
                const max = Math.max(1, ...Object.values(stats?.eventsByType || { _: 1 }));
                return (
                  <div key={action} className="space-y-4 group/row">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-4">
                        <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-100 group-hover/row:text-black transition-colors" />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-300 group-hover/row:text-accent transition-colors italic">{action}</span>
                      </div>
                      <span className="text-2xl font-black font-mono italic text-black">{count}</span>
                    </div>
                    <div className="w-full h-3 bg-zinc-50 rounded-full overflow-hidden shadow-xs border border-zinc-100/50">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round((count / max) * 100)}%` }} transition={{ duration: 0.8 }} className="h-full bg-accent shadow-2xl relative overflow-hidden" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="lg:col-span-5 p-16 bg-accent text-white rounded-[5rem] flex flex-col justify-between shadow-accent relative overflow-hidden group">
            <div className="space-y-10 relative z-10">
              <div className="flex items-center justify-between">
                <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-black">
                  <GeometricLantern variant="security" className="w-10 h-10 text-blue-500" />
                </div>
                <div className="px-6 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-500">
                  系统摘要
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-5xl font-black tracking-tighter uppercase italic leading-[0.9] text-white">审计摘要</h3>
                <p className="text-zinc-400 text-lg font-bold leading-relaxed italic max-w-sm">
                  最近 7 天记录了 {stats?.totalEvents ?? 0} 条审计事件，今日新增 {stats?.todayEvents ?? 0} 条。最近最活跃的操作是 {topAction?.[0] || 'none'}。
                </p>
              </div>
            </div>

            <div className="pt-12 relative z-10 space-y-6">
              <div className="space-y-3">
                {(stats?.topUsers || []).slice(0, 3).map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between rounded-[2rem] bg-white/10 px-6 py-4">
                    <div className="text-sm font-black uppercase italic">{user.username || `USER_${user.user_id}`}</div>
                    <div className="text-xs font-mono">{user.event_count} events</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest italic text-white/40">
                Last updated: {formatDateTime(new Date().toISOString())}
              </div>
            </div>
          </section>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminAuditStats;
