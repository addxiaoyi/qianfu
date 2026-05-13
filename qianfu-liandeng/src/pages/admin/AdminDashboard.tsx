import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import { ChevronRight } from 'lucide-react';
import AdminStatCard from '@/components/AdminStatCard';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';

const dashboardBadge = 'ADMIN_CORE / OMNIVIEW';

interface DashboardStats {
  totalUsers: number;
  activeServers: number;
  pendingReviews: number;
  openTickets: number;
  throughput: number;
  uptime: number;
  totalUsersChange?: number;
  newServers?: number;
  avgResponseTime?: number;
}

interface RecentActivity {
  type: string;
  msg: string;
  time: string;
  variant: 'user' | 'server' | 'payment' | 'security' | 'alert' | 'data';
  protocol: string;
}

const PLACEHOLDER_METRICS = [
  { labelKey: 'admin.dash.metrics.users' as TranslationKey, value: '—', variant: 'user', color: 'text-blue-500', trend: '', tag: 'DAT_01' },
  { labelKey: 'admin.dash.metrics.servers' as TranslationKey, value: '—', variant: 'network', color: 'text-green-500', trend: '', tag: 'DAT_02' },
  { labelKey: 'admin.dash.metrics.review' as TranslationKey, value: '—', variant: 'security', color: 'text-orange-500', trend: '', tag: 'DAT_03' },
  { labelKey: 'admin.dash.metrics.tickets' as TranslationKey, value: '—', variant: 'activity', color: 'text-accent', trend: '', tag: 'DAT_04' }
];

const PLACEHOLDER_ACTIVITIES: RecentActivity[] = [];

const AdminDashboard: React.FC = () => {
  const t = useT();

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<DashboardStats>('/admin/stats'),
  });

  const { data: activities = PLACEHOLDER_ACTIVITIES, isLoading: activitiesLoading } = useQuery({
    queryKey: ['admin-activities'],
    queryFn: () => api.get<RecentActivity[]>('/admin/activities?limit=5'),
  });

  const isLoading = statsLoading || activitiesLoading;

  const metrics = (() => {
    if (!stats) return PLACEHOLDER_METRICS;
    const vals = [
      { ...PLACEHOLDER_METRICS[0], value: stats.totalUsers?.toLocaleString() ?? '0', trend: stats.totalUsersChange ? `+${stats.totalUsersChange} this week` : '' },
      { ...PLACEHOLDER_METRICS[1], value: (stats.activeServers ?? 0).toLocaleString(), trend: stats.newServers ? `${stats.newServers} new nodes` : '' },
      { ...PLACEHOLDER_METRICS[2], value: (stats.pendingReviews ?? 0).toString(), trend: stats.pendingReviews && stats.pendingReviews > 10 ? 'High Priority' : '' },
      { ...PLACEHOLDER_METRICS[3], value: (stats.openTickets ?? 0).toString(), trend: stats.avgResponseTime ? `Response time: ${stats.avgResponseTime}m` : '' },
    ];
    return vals;
  })();

  const displayActivities = activities.length > 0 ? activities : PLACEHOLDER_ACTIVITIES;

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper isLoading={isLoading} isError={statsError} onRetry={() => refetchStats()}>
        <AdminPageHeader
          badge="指挥矩阵 / Alpha 区域"
          title="OmniView."
          description={t('admin.dash.subtitle')}
          statusLabel={t('admin.status.operational')}
          rightSlot={(
            <>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs group hover:bg-white hover:border-accent transition-all duration-700">
                <div className="flex items-center gap-3">
                   <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors" />
                   <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic group-hover:text-accent transition-colors break-words">{t('admin.dash.flux')}</div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-5xl font-black font-mono italic tracking-tighter break-words">{stats?.throughput?.toLocaleString() ?? '—'}<span className="text-xs text-zinc-300 ml-2">r/s</span></div>
              </div>
              <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs group hover:bg-white hover:border-accent transition-all duration-700">
                <div className="flex items-center gap-3">
                   <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors" />
                   <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic group-hover:text-accent transition-colors">{t('admin.dash.uptime')}</div>
                </div>
                <div className="text-2xl sm:text-3xl lg:text-5xl font-black font-mono text-green-600 tracking-tighter italic break-words">{stats?.uptime ? `${stats.uptime}%` : '—'}</div>
              </div>
            </>
          )}
        />

        {/* --- Primary Metrics --- */}
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
            {/* Live Telemetry Packets */}
            <section className="lg:col-span-8 space-y-12">
               <div className="flex items-center justify-between border-b border-zinc-50 pb-6">
                  <h3 className="text-[12px] font-black font-mono uppercase tracking-[0.5em] text-zinc-300 flex items-center gap-4 italic">
                     <div className="w-3 h-3 rounded-full bg-accent animate-pulse shadow-accent/20" />
                     {t('admin.dash.telemetry')}
                  </h3>
                  <div className="flex items-center gap-6">
                     <span className="text-[9px] font-black text-zinc-200 uppercase tracking-widest italic">缓冲区：4.2 MB</span>
                     <button className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] hover:text-accent transition-all flex items-center gap-3 italic">
                        分析中心 <ChevronRight className="w-4 h-4" />
                     </button>
                  </div>
               </div>
               
               <div className="border border-zinc-50 rounded-[4rem] overflow-hidden bg-white divide-y divide-zinc-50 shadow-xs group hover:border-accent transition-all duration-1000">
                  {displayActivities.map((activity, i) => (
                    <div key={i} className="px-12 py-10 flex items-center justify-between group/row hover:bg-zinc-50/50 transition-all duration-500 cursor-default">
                       <div className="flex items-center gap-10">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-zinc-50 flex items-center justify-center transition-all duration-700 shadow-sm group-hover/row:bg-white transition-all">
                             <GeometricLantern variant={activity.variant} className="w-7 h-7" />
                          </div>
                          <div className="space-y-2">
                             <span className="text-[15px] font-black text-zinc-500 group-hover/row:text-accent transition-colors uppercase italic tracking-tight leading-tight">{activity.msg}</span>
                             <div className="flex items-center gap-4">
                                <div className="px-2 py-0.5 bg-zinc-100 rounded-sm text-[8px] font-black text-zinc-400 uppercase tracking-widest italic group-hover/row:bg-white group-hover/row:text-zinc-600 transition-all">{activity.protocol}</div>
                                <div className="w-1 h-1 rounded-full bg-zinc-200" />
                                <span className="text-[9px] font-black text-zinc-200 uppercase tracking-widest italic">节点：Core-03</span>
                             </div>
                          </div>
                       </div>
                       <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-black font-mono text-zinc-200 group-hover/row:text-accent transition-colors italic tracking-widest">{activity.time}</span>
                          <GeometricLantern variant="network" className="w-4 h-4 text-zinc-100 group-hover/row:text-accent transition-colors -translate-x-4 opacity-0 group-hover/row:translate-x-0 group-hover/row:opacity-100 duration-500" />
                       </div>
                    </div>
                  ))}
               </div>
               
               <button className="w-full py-12 border-2 border-zinc-50 border-dashed rounded-[4rem] text-[12px] font-black uppercase tracking-[0.5em] text-zinc-300 hover:text-accent hover:border-accent hover:bg-accent-subtle transition-all group flex items-center justify-center gap-6 italic bg-white shadow-xs">
                  {t('admin.dash.inspect_logs')} <ChevronRight className="w-5 h-5 group-hover:translate-x-4 transition-transform" />
               </button>
            </section>

            {/* Quick Access Grid */}
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
                         <span className="text-[10px] font-black font-mono text-zinc-400 italic">AES-256</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-6 bg-white rounded-[2rem] shadow-xs border border-zinc-100/50">
                         <span className="text-[10px] font-black uppercase tracking-widest italic">{t('admin.dash.threat')}</span>
                         <span className="text-[10px] font-black font-mono text-blue-500 italic">{t('admin.status.minimal')}</span>
                      </div>
                   </div>
                   <button className="w-full py-8 btn-accent rounded-[3rem] text-[10px] font-black uppercase tracking-[0.4em] italic shadow-2xl shadow-accent/20 transition-all duration-500 active:scale-95">
                      {t('admin.dash.run_scan')}
                   </button>
                </div>

                <div className="p-12 border border-zinc-50 rounded-[4rem] bg-accent text-white space-y-12 relative overflow-hidden group">
                   <div className="absolute -right-8 -top-8 opacity-10 group-hover:rotate-45 transition-transform duration-1000"><GeometricLantern variant="spark" className="w-48 h-48" /></div>
                   <div className="space-y-4 relative z-10">
                      <h4 className="text-[11px] font-black uppercase tracking-[0.4em] italic text-white/50">{t('admin.dash.maintenance')}</h4>
                      <div className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter leading-none break-words">{t('admin.dash.sync_msg').replace('{time}', '4h 12m')}</div>
                   </div>
                   <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative z-10">
                      <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} transition={{ duration: 2, delay: 0.5 }} className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-widest italic text-white/40 leading-relaxed relative z-10 break-words">
                      {t('admin.dash.sync_desc')}
                   </p>
                </div>
            </aside>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminDashboard;
