import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminStatCard from '@/components/AdminStatCard';
import GeometricLantern from '@/components/icons/GeometricLantern';

const adminShellClass = 'space-y-16 pb-32 bg-white';
const adminHeaderTagClass = 'px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic';

const AdminAuditStats: React.FC = () => {
  const chartData = [40, 70, 45, 90, 65, 80, 50, 85, 30, 60, 75, 55, 40, 65, 85, 50, 40, 60, 30, 45, 70, 90, 55, 65];

  return (
    <div className={adminShellClass}>
      <AdminPageHeader
        badge="Analytics Node / Omega-7"
        title="Insight."
        description="全站行为分析与多维审计统计。执行实时流量拓扑映射、用户画像建模及异常访问预测。"
        statusLabel="Spectral Engine Active"
        statusTone="success"
        rightSlot={(
          <div className="flex gap-6">
            <button className="group px-10 py-6 border border-zinc-50 rounded-[2.5rem] bg-zinc-50/30 text-[11px] font-black uppercase tracking-[0.4em] flex items-center gap-4 hover:bg-white hover:border-zinc-200 transition-all duration-500 shadow-xs italic active:scale-[0.98]">
              <GeometricLantern variant="data" className="w-5 h-5 group-hover:rotate-12 transition-transform duration-500" /> EXPORT_RAW_JSON
            </button>
            <button className="group px-12 py-6 btn-accent rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.5em] flex items-center gap-6 transition-all duration-500 shadow-2xl shadow-accent/20 italic active:scale-[0.98]">
              GENERATE_REPORT <ChevronRight className="w-5 h-5 group-hover:translate-x-4 transition-transform duration-500" />
            </button>
          </div>
        )}
      />

      {/* Industrial Stats Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10">
         {[
           { label: 'Active Sessions', value: '2,940', trend: '+12.4%', up: true, variant: 'user' as const, color: 'text-blue-500', tag: 'AN_01' },
           { label: 'Payload Requests', value: '84.1K', trend: '+5.2%', up: true, variant: 'network' as const, color: 'text-green-500', tag: 'AN_02' },
           { label: 'Response Latency', value: '18.4ms', trend: '-2.1ms', up: true, variant: 'terminal' as const, color: 'text-orange-500', tag: 'AN_03' },
           { label: 'System Saturation', value: '42.8%', trend: '+8.1%', up: false, variant: 'activity' as const, color: 'text-zinc-400', tag: 'AN_04' },
         ].map((s, idx) => (
           <AdminStatCard
             key={s.label}
             tag={s.tag}
             value={s.value}
             label={s.label}
             variant={s.variant}
             colorClassName={s.color}
             trend={s.trend}
             delay={idx * 0.1}
             up={s.up}
           />
         ))}
      </div>

      {/* Main Analytical Interface */}
      <section className="p-16 border border-zinc-50 rounded-[5rem] bg-white space-y-20 group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden">
         <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none transition-all duration-1000 group-hover:scale-110 group-hover:opacity-10">
            <GeometricLantern variant="data" className="w-96 h-96 rotate-12" />
         </div>
         
         <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10 relative z-10">
            <div className="space-y-4">
               <div className="flex items-center gap-6">
                  <div className="w-3 h-3 bg-accent rounded-full shadow-accent/20 animate-pulse" />
                  <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none text-accent">Temporal Flux Distribution.</h3>
               </div>
               <p className="text-[11px] font-black font-mono text-zinc-300 uppercase tracking-[0.5em] italic border-l-2 border-zinc-50 pl-10">Spectral Density across 24-hour cycle / Node-Omega</p>
            </div>
            <div className="flex gap-4">
               <div className="px-6 py-3 bg-zinc-50 border border-zinc-100 rounded-sm text-[11px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic group-hover:text-black group-hover:border-black transition-all duration-500 flex items-center gap-4">
                  <GeometricLantern variant="terminal" className="w-4 h-4 opacity-50" /> INTERVAL_SYNC: 1H
               </div>
            </div>
         </div>

         <div className="h-[400px] flex items-end gap-2 md:gap-4 px-4 relative z-10 pt-10">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
               {[...Array(10)].map((_, i) => (
                  <div key={i} className="w-full h-px bg-black" />
               ))}
            </div>
            {chartData.map((val, i) => (
              <div key={i} className="flex-grow flex flex-col items-center gap-6 group/bar">
                 <div className="flex-grow w-full flex flex-col justify-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${val}%` }}
                      transition={{ delay: i * 0.02, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      className="w-full bg-zinc-50 group-hover/bar:bg-accent transition-all duration-700 rounded-sm relative shadow-xs group-hover/bar:shadow-2xl group-hover/bar:shadow-accent/20"
                    >
                       <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent text-white text-[10px] font-black font-mono rounded shadow-2xl opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 italic">
                          {val * 120}
                       </div>
                    </motion.div>
                 </div>
                 <span className="text-[9px] font-black font-mono text-zinc-200 uppercase tracking-widest group-hover/bar:text-black group-hover/bar:font-black transition-all italic h-4">
                    {i}:00
                 </span>
              </div>
            ))}
         </div>
      </section>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
         <section className="lg:col-span-7 p-16 border border-zinc-50 rounded-[4rem] bg-white space-y-16 group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden">
            <div className="flex items-center gap-8">
               <div className="w-20 h-20 bg-zinc-50 rounded-[2.5rem] flex items-center justify-center text-zinc-100 group-hover:bg-accent group-hover:text-white group-hover:rotate-12 transition-all duration-700 shadow-xs">
                  <GeometricLantern variant="network" className="w-10 h-10" />
               </div>
               <div className="space-y-1">
                  <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Geospatial Matrix.</h3>
                  <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em] italic">Node Integrity Distribution</p>
               </div>
            </div>
            <div className="space-y-12">
               {[
                 { region: 'CHINA NORTHERN NODE', val: 40, trend: '+4%', color: 'bg-blue-500' },
                 { region: 'CHINA SOUTHERN NODE', val: 75, trend: '+18%', color: 'bg-green-500' },
                 { region: 'GLOBAL EXTERNAL EDGE', val: 15, trend: '-2%', color: 'bg-orange-500' },
                 { region: 'VIRTUAL MAPPING GATE', val: 5, trend: 'STABLE', color: 'bg-zinc-300' },
               ].map((r, idx) => (
                 <div key={r.region} className="space-y-4 group/row">
                    <div className="flex justify-between items-end">
                       <div className="flex items-center gap-4">
                          <GeometricLantern variant="spark" className="w-4 h-4 text-zinc-100 group-hover/row:text-black transition-colors" />
                          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-300 group-hover/row:text-accent transition-colors italic">{r.region}</span>
                       </div>
                       <div className="flex items-center gap-6">
                          <span className="text-[10px] font-black font-mono italic text-zinc-200 group-hover/row:text-zinc-400 transition-colors tracking-widest">{r.trend}</span>
                          <span className="text-2xl font-black font-mono italic text-black group-hover/row:translate-x-2 transition-transform duration-500">{r.val}%</span>
                       </div>
                    </div>
                    <div className="w-full h-3 bg-zinc-50 rounded-full overflow-hidden shadow-xs border border-zinc-100/50">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${r.val}%` }}
                         transition={{ delay: 0.5 + (idx * 0.1), duration: 2, ease: [0.22, 1, 0.36, 1] }}
                         className={`h-full ${r.color} shadow-2xl relative overflow-hidden`}
                       >
                          <motion.div 
                            animate={{ x: ['-100%', '100%'] }} 
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-1/2"
                          />
                       </motion.div>
                    </div>
                 </div>
               ))}
            </div>
         </section>

         <section className="lg:col-span-5 p-20 bg-accent text-white rounded-[5rem] flex flex-col justify-between shadow-accent relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 opacity-5 group-hover:opacity-15 transition-all duration-1000 rotate-12 scale-125">
               <GeometricLantern variant="security" className="w-96 h-96" />
            </div>
            
            <div className="space-y-12 relative z-10">
               <div className="flex items-center justify-between">
                  <div className="w-24 h-24 bg-zinc-900 border border-zinc-800 rounded-[3rem] flex items-center justify-center shadow-2xl shadow-black group-hover:rotate-[360deg] transition-all duration-1000">
                     <GeometricLantern variant="alert" className="w-10 h-10 text-blue-500" />
                  </div>
                  <div className="px-6 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-500">
                     SYSTEM_ADVISORY
                  </div>
               </div>
               <div className="space-y-6">
                  <h3 className="text-6xl font-black tracking-tighter uppercase italic leading-[0.9] text-white">Executive<br />Protocol.</h3>
                  <p className="text-zinc-400 text-lg font-bold leading-relaxed italic max-w-sm group-hover:text-zinc-100 transition-colors">
                     本月整体流量较上月增长 18.2%，主要集中在 18:00 - 22:00 黄金时段。
                     系统检测到华南节点负载压力，建议在此时间段开启弹性扩容策略以维持 100% 链路完整性。
                  </p>
               </div>
            </div>

            <div className="pt-16 relative z-10">
               <button className="group/btn w-full py-10 bg-white text-black rounded-[3rem] text-[12px] font-black uppercase tracking-[0.6em] hover:bg-zinc-200 transition-all shadow-2xl shadow-white/5 flex items-center justify-center gap-6 italic active:scale-[0.98]">
                  GENERATE_FULL_AUDIT_LEDGER <ChevronRight className="w-6 h-6 group-hover/btn:translate-x-4 transition-transform duration-500" />
               </button>
               <div className="mt-8 flex items-center justify-center gap-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">
                  <GeometricLantern variant="settings" className="w-3.5 h-3.5" /> SECURE_COMPLIANCE_V5.0
               </div>
            </div>
         </section>
      </div>
    </div>
  );
};

export default AdminAuditStats;
