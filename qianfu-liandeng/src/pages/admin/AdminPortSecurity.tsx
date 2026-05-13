import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import { motion } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

interface PortSecurityStats {
  riskScore?: number;
  firewallStatus?: string;
  encryption?: string;
  activeConnections?: number;
  blockedAttempts?: number;
  recentEvents?: Array<{
    id: string;
    type: string;
    source: string;
    ip: string;
    time: string;
  }>;
  policies?: Array<{
    id: string;
    name: string;
    status: 'enabled' | 'disabled';
  }>;
}

const adminShellClass = 'space-y-16 pb-32 bg-white selection:bg-accent selection:text-white';
const adminHeaderTagClass = 'px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic';

const AdminPortSecurity: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-port-security'],
    queryFn: () => api.get<PortSecurityStats>('/port5555/stats'),
  });

  const stats = data || {};
  const recentEvents = stats.recentEvents || [];
  const policies = stats.policies || [];

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-16">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic">
                Port Security / 5555
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)] animate-pulse" />
                <span className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-zinc-300 italic">Live Intrusion Monitor</span>
              </div>
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.85] italic text-accent break-words">
              Firewall.
            </h1>
            <p className="text-zinc-400 font-bold text-lg max-w-xl italic border-l-2 border-zinc-100 pl-8">
              端口 5555 安全态势总览，实时监控连接、拦截与加密状态，帮助管理团队快速识别异常访问。
            </p>
          </div>

          <div className="flex gap-6">
            <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-[3rem] flex items-center gap-8 shadow-xs group hover:bg-white hover:border-zinc-200 transition-all duration-700">
              <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center shadow-xs border border-zinc-100 group-hover:bg-accent group-hover:text-white transition-all duration-700">
                <GeometricLantern variant="security" className="w-8 h-8 text-zinc-300 group-hover:text-white" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 italic">Risk Score</div>
                <div className="text-4xl font-black font-mono tracking-tighter italic">{stats.riskScore ?? 12}%</div>
              </div>
            </div>
            <button className="group px-12 py-6 btn-accent rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all duration-500 flex items-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98]">
              <GeometricLantern variant="spark" className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
              DEPLOY_POLICY
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10 pt-12 border-t border-zinc-50">
          {[
            { label: 'Firewall', value: stats.firewallStatus || 'ENFORCED', variant: 'security' as const },
            { label: 'Encryption', value: stats.encryption || 'AES-256', variant: 'data' as const },
            { label: 'Connections', value: String(stats.activeConnections ?? 0), variant: 'network' as const },
            { label: 'Blocked', value: String(stats.blockedAttempts ?? 0), variant: 'alert' as const },
          ].map((item) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-12 border border-zinc-50 rounded-[4rem] bg-white space-y-8 hover:border-zinc-200 hover:shadow-2xl hover:shadow-black/5 transition-all duration-700 shadow-xs relative overflow-hidden group"
            >
              <div className="w-20 h-20 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white transition-all duration-700 shadow-xs">
                <GeometricLantern variant={item.variant} className="w-8 h-8 group-hover:text-white transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic group-hover:text-zinc-500 transition-colors leading-none">{item.label}</div>
                <div className="text-4xl font-black font-mono tracking-tighter italic leading-none break-words">{item.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 pt-12">
          <section className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between border-b border-zinc-50 pb-6">
              <h3 className="text-[12px] font-black font-mono uppercase tracking-[0.5em] text-zinc-300 flex items-center gap-4 italic">
                <div className="w-3 h-3 rounded-full bg-accent animate-pulse shadow-accent/20" />
                Recent Events
              </h3>
              <span className="text-[9px] font-black text-zinc-200 uppercase tracking-widest italic">PORT_5555_STREAM</span>
            </div>

            <div className="border border-zinc-50 rounded-[4rem] overflow-hidden bg-white divide-y divide-zinc-50 shadow-xs group hover:border-accent transition-all duration-1000">
              {recentEvents.length === 0 ? (
                <div className="py-24 text-center text-zinc-300 italic font-black uppercase tracking-[0.4em] text-[11px]">
                  No suspicious events detected.
                </div>
              ) : (
                recentEvents.map((event) => (
                  <div key={event.id} className="px-12 py-10 flex items-center justify-between gap-6 hover:bg-zinc-50/50 transition-all duration-500">
                    <div className="flex items-center gap-6 min-w-0">
                      <div className="w-14 h-14 rounded-[1.5rem] bg-zinc-50 flex items-center justify-center border border-zinc-100 shadow-xs">
                        <GeometricLantern variant="network" className="w-6 h-6 text-zinc-300" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400 italic truncate">{event.type}</div>
                        <div className="text-lg font-black italic text-accent truncate">{event.source}</div>
                      </div>
                    </div>
                    <div className="text-right space-y-1 shrink-0">
                      <div className="text-[10px] font-black font-mono uppercase tracking-widest text-zinc-300 italic">{event.ip}</div>
                      <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-200 italic">{event.time}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <aside className="lg:col-span-4 space-y-8">
            <div className="p-12 border border-zinc-50 rounded-[4rem] bg-zinc-50/20 space-y-8 group hover:border-accent hover:bg-white transition-all duration-700 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-6">
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">Policies</h4>
                <GeometricLantern variant="security" className="w-5 h-5 text-zinc-200 group-hover:text-accent transition-colors" />
              </div>
              <div className="space-y-4">
                {policies.length === 0 ? (
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">No active policies</p>
                ) : (
                  policies.map((policy) => (
                    <div key={policy.id} className="flex justify-between items-center px-4 py-5 bg-white rounded-[2rem] shadow-xs border border-zinc-100">
                      <span className="text-[10px] font-black uppercase tracking-widest italic">{policy.name}</span>
                      <span className={`text-[10px] font-black font-mono uppercase tracking-widest italic ${policy.status === 'enabled' ? 'text-green-500' : 'text-zinc-400'}`}>
                        {policy.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-12 border border-zinc-50 rounded-[4rem] bg-accent text-white space-y-8 relative overflow-hidden group">
              <div className="absolute -right-8 -top-8 opacity-10 group-hover:rotate-45 transition-transform duration-1000">
                <GeometricLantern variant="spark" className="w-48 h-48" />
              </div>
              <div className="space-y-4 relative z-10">
                <h4 className="text-[11px] font-black uppercase tracking-[0.4em] italic text-white/50">Risk Overview</h4>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase italic tracking-tighter leading-none break-words">
                  {stats.riskScore ?? 12}% Secure
                </div>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden relative z-10">
                <motion.div initial={{ width: 0 }} animate={{ width: `${100 - (stats.riskScore ?? 12)}%` }} transition={{ duration: 2, delay: 0.5 }} className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest italic text-white/40 leading-relaxed relative z-10 break-words">
                The current port posture is within acceptable thresholds.
              </p>
            </div>
          </aside>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminPortSecurity;
