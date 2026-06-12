import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminStatCard from '@/components/AdminStatCard';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';
import { formatDateTime } from '@/utils/serverView';

type UserStats = {
  totalUsers: number;
  verifiedUsers: number;
  activeUsers: number;
};

type GlobalStats = {
  totalUsers: number;
  totalServers: number;
  onlineServers: number;
  totalPlayers: number;
};

type ReviewStats = {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  totalTodayReviews: number;
};

type TicketRecord = {
  id: number;
  title: string;
  status: string;
  updated_at?: string;
  user?: {
    username?: string | null;
  } | null;
};

type AuditStats = {
  totalEvents: number;
  todayEvents: number;
  eventsByType?: Record<string, number>;
};

type AuditLog = {
  id: number;
  action: string;
  target?: string | null;
  details?: string | null;
  created_at?: string;
  user?: {
    username?: string | null;
  } | null;
};

type RecentActivity = {
  id: string;
  msg: string;
  time: string;
  variant: 'user' | 'network' | 'payment' | 'security' | 'alert' | 'data' | 'activity';
  protocol: string;
};

const PLACEHOLDER_METRICS = [
  { labelKey: 'admin.dash.metrics.users' as TranslationKey, value: '—', variant: 'user', color: 'text-blue-500', trend: '', tag: 'DAT_01' },
  { labelKey: 'admin.dash.metrics.servers' as TranslationKey, value: '—', variant: 'network', color: 'text-green-500', trend: '', tag: 'DAT_02' },
  { labelKey: 'admin.dash.metrics.review' as TranslationKey, value: '—', variant: 'security', color: 'text-orange-500', trend: '', tag: 'DAT_03' },
  { labelKey: 'admin.dash.metrics.tickets' as TranslationKey, value: '—', variant: 'activity', color: 'text-accent', trend: '', tag: 'DAT_04' },
] as const;

const classifyActivity = (action: string): RecentActivity['variant'] => {
  const upper = action.toUpperCase();
  if (upper.includes('PAYMENT') || upper.includes('CHECKIN')) return 'payment';
  if (upper.includes('REVIEW') || upper.includes('REPORT')) return 'security';
  if (upper.includes('TICKET')) return 'activity';
  if (upper.includes('USER') || upper.includes('LOGIN') || upper.includes('REGISTER')) return 'user';
  return 'data';
};

const AdminDashboard: React.FC = () => {
  const t = useT();

  const { data: userStats, isLoading: userLoading, isError: userError, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-dashboard-user-stats'],
    queryFn: () => api.get<UserStats>('/admin/stats'),
  });

  const { data: globalStats, isLoading: globalLoading } = useQuery({
    queryKey: ['admin-dashboard-global-stats'],
    queryFn: () => api.get<GlobalStats>('/stats'),
  });

  const { data: reviewStats, isLoading: reviewLoading } = useQuery({
    queryKey: ['admin-dashboard-review-stats'],
    queryFn: () => api.get<ReviewStats>('/review/stats'),
  });

  const { data: tickets = [], isLoading: ticketLoading } = useQuery({
    queryKey: ['admin-dashboard-tickets'],
    queryFn: () => api.get<TicketRecord[]>('/tickets', { limit: 5 }),
  });

  const { data: auditStats, isLoading: auditStatsLoading } = useQuery({
    queryKey: ['admin-dashboard-audit-stats'],
    queryFn: () => api.get<AuditStats>('/audit/stats', { days: 7 }),
  });

  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery({
    queryKey: ['admin-dashboard-audit-logs'],
    queryFn: () => api.get<AuditLog[]>('/audit/logs', { limit: 5 }),
  });

  const isLoading = userLoading || globalLoading || reviewLoading || ticketLoading || auditStatsLoading || auditLogsLoading;

  const metrics = useMemo(() => {
    if (!userStats || !globalStats || !reviewStats) return PLACEHOLDER_METRICS;
    return [
      { ...PLACEHOLDER_METRICS[0], value: userStats.totalUsers?.toLocaleString() ?? '0', trend: `${userStats.verifiedUsers ?? 0} verified` },
      { ...PLACEHOLDER_METRICS[1], value: (globalStats.totalServers ?? 0).toLocaleString(), trend: `${globalStats.onlineServers ?? 0} 在线` },
      { ...PLACEHOLDER_METRICS[2], value: (reviewStats.totalPending ?? 0).toString(), trend: `${reviewStats.totalTodayReviews ?? 0} today` },
      { ...PLACEHOLDER_METRICS[3], value: tickets.filter((ticket) => ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS').length.toString(), trend: `${tickets.length} loaded` },
    ];
  }, [globalStats, reviewStats, tickets, userStats]);

  const displayActivities = useMemo<RecentActivity[]>(() => {
    return auditLogs.map((log) => ({
      id: String(log.id),
      msg: log.action.replaceAll('_', ' '),
      time: formatDateTime(log.created_at),
      variant: classifyActivity(log.action),
      protocol: log.user?.username || log.target || 'SYSTEM',
    }));
  }, [auditLogs]);

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper isLoading={isLoading} isError={userError} onRetry={() => refetchUsers()}>
        <AdminPageHeader
          badge="管理总览 / 实时数据"
          title="管理总览"
          description="总览页已切换到真实统计接口。这里只展示真实用户、服务器、审核、工单和审计事件。"
          statusLabel={t('admin.status.operational')}
          rightSlot={(
            <>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs">
                <div className="flex items-center gap-3">
                  <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-200" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic break-words">{t('admin.dash.flux')}</div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-5xl font-black font-mono italic tracking-tighter break-words">{auditStats?.todayEvents?.toLocaleString() ?? '—'}<span className="text-xs text-zinc-300 ml-2">事件</span></div>
              </div>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs">
                <div className="flex items-center gap-3">
                  <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-200" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">{t('admin.dash.uptime')}</div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-5xl font-black font-mono text-green-600 tracking-tighter italic break-words">{globalStats?.onlineServers ?? 0}<span className="text-xs text-zinc-300 ml-2">在线</span></div>
              </div>
            </>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {metrics.map((stat, idx) => (
            <AdminStatCard
              key={stat.tag}
              tag={stat.tag}
              value={stat.value}
              label={t(stat.labelKey)}
              variant={stat.variant}
              colorClassName={stat.color}
              trend={stat.trend}
              delay={idx * 0.1}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <section className="lg:col-span-8 space-y-12">
            <div className="flex items-center justify-between border-b border-zinc-50 pb-6">
              <h3 className="text-[12px] font-black font-mono uppercase tracking-[0.5em] text-zinc-300 flex items-center gap-4 italic">
                <div className="w-3 h-3 rounded-full bg-accent animate-pulse shadow-accent/20" />
                {t('admin.dash.telemetry')}
              </h3>
              <div className="flex items-center gap-6">
                <span className="text-[9px] font-black text-zinc-200 uppercase tracking-widest italic">7 天事件：{auditStats?.totalEvents ?? 0}</span>
                <button type="button" className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] hover:text-accent transition-all flex items-center gap-3 italic">
                  查看统计 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="border border-zinc-50 rounded-[4rem] overflow-hidden bg-white divide-y divide-zinc-50 shadow-xs group hover:border-accent transition-all duration-1000">
              {displayActivities.length === 0 ? (
                <div className="px-12 py-20 text-center text-sm font-bold text-zinc-400">暂无真实审计事件</div>
              ) : displayActivities.map((activity) => (
                <div key={activity.id} className="px-12 py-10 flex items-center justify-between group/row hover:bg-zinc-50/50 transition-all duration-500 cursor-default">
                  <div className="flex items-center gap-10">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-zinc-50 flex items-center justify-center shadow-sm">
                      <GeometricLantern variant={activity.variant} className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[15px] font-black text-zinc-500 group-hover/row:text-accent transition-colors uppercase italic tracking-tight leading-tight">{activity.msg}</span>
                      <div className="flex items-center gap-4">
                        <div className="px-2 py-0.5 bg-zinc-100 rounded-sm text-[8px] font-black text-zinc-400 uppercase tracking-widest italic">{activity.protocol}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black font-mono text-zinc-200 group-hover/row:text-accent transition-colors italic tracking-widest">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="w-full py-12 border-2 border-zinc-50 border-dashed rounded-[4rem] text-[12px] font-black uppercase tracking-[0.5em] text-zinc-300 hover:text-accent hover:border-accent hover:bg-accent-subtle transition-all group flex items-center justify-center gap-6 italic bg-white shadow-xs">
              {t('admin.dash.inspect_logs')} <ChevronRight className="w-5 h-5 group-hover:translate-x-4 transition-transform" />
            </button>
          </section>

          <aside className="lg:col-span-4 space-y-12">
            <div className="p-12 border border-zinc-50 rounded-[4rem] bg-zinc-50/20 space-y-12 group hover:border-accent hover:bg-white hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-6">
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">{t('admin.dash.security_snap')}</h4>
                <GeometricLantern variant="security" className="w-5 h-5 text-zinc-200 group-hover:text-accent transition-colors" />
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center px-4 py-6 bg-white rounded-[2rem] shadow-xs border border-zinc-100/50">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">{t('admin.dash.firewall')}</span>
                  <span className="text-[10px] font-black font-mono text-green-500 italic">{t('admin.status.enforced')}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-6 bg-white rounded-[2rem] shadow-xs border border-zinc-100/50">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">{t('admin.dash.encryption')}</span>
                  <span className="text-[10px] font-black font-mono text-zinc-400 italic">已启用</span>
                </div>
                <div className="flex justify-between items-center px-4 py-6 bg-white rounded-[2rem] shadow-xs border border-zinc-100/50">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">{t('admin.dash.threat')}</span>
                  <span className="text-[10px] font-black font-mono text-blue-500 italic">{globalStats?.onlineServers === globalStats?.totalServers ? t('admin.status.minimal') : '监控中'}</span>
                </div>
              </div>
              <button type="button" className="w-full py-8 btn-accent rounded-[3rem] text-[10px] font-black uppercase tracking-[0.4em] italic shadow-2xl shadow-accent/20 transition-all duration-500 active:scale-95">
                {t('admin.dash.run_scan')}
              </button>
            </div>

            <div className="p-12 border border-zinc-50 rounded-[4rem] bg-accent text-white space-y-12 relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 opacity-10 group-hover:rotate-45 transition-transform duration-1000"><GeometricLantern variant="spark" className="w-48 h-48" /></div>
              <div className="space-y-4 relative z-10">
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] italic text-white/50">{t('admin.dash.maintenance')}</h4>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter leading-none break-words">{t('admin.dash.sync_msg').replace('{time}', `${tickets.length} tickets / ${reviewStats?.totalPending ?? 0} reviews`)}</div>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative z-10">
                <motion.div initial={{ width: 0 }} animate={{ width: globalStats?.totalServers ? `${Math.min(100, Math.round(((globalStats.onlineServers || 0) / globalStats.totalServers) * 100))}%` : '0%' }} transition={{ duration: 1.2, delay: 0.2 }} className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest italic text-white/40 leading-relaxed relative z-10 break-words">
                在线服务器 {globalStats?.onlineServers ?? 0} / 总服务器 {globalStats?.totalServers ?? 0} / 在线玩家 {globalStats?.totalPlayers ?? 0}
              </p>
            </div>
          </aside>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminDashboard;
