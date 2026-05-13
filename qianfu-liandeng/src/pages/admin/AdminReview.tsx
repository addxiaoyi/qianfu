import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import { toast } from '@/hooks/use-toast';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import GeometricLantern from '@/components/icons/GeometricLantern';

interface ServerAudit {
  id: number;
  name: string;
  owner: string;
  ip: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
  version: string;
  tags: string[];
  description?: string;
  region?: string;
}

const reviewBadge = 'MODERATION_NODE / DELTA-0';

const AdminReview: React.FC = () => {
  const [selectedAudit, setSelectedAudit] = useState<ServerAudit | null>(null);
  const [notes, setNotes] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState<'approve' | 'reject' | null>(null);
  const { data: audits = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-review'],
    queryFn: () => api.get<ServerAudit[]>('/admin/servers/pending'),
  });

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!selectedAudit) return;
    try {
      await api.post(`/admin/servers/${selectedAudit.id}/${status === 'approved' ? 'approve' : 'reject'}`, { notes });
      refetch();
      toast({ 
        title: status === 'approved' ? 'ACCESS_GRANTED' : 'PROPOSAL_REJECTED', 
        description: `Entity ${selectedAudit.name} protocol has been updated.` 
      });
      setIsDialogOpen(null);
      setNotes('');
    } catch (err) {
      console.error('[AdminReview] Failed to action audit:', err);
      toast({
        title: 'ACTION_FAILED',
        description: 'Unable to process this request. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-16 pb-32 bg-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      <AdminPageHeader
        badge={reviewBadge}
        title="Review."
        description="审阅新提交的服务器索引请求。执行多维安全审计、内容合规性检查及网络拓扑验证。所有决策均映射至审计日志。"
        statusLabel={`${audits.length} PENDING_VERIFICATIONS`}
        statusTone="warning"
        rightSlot={(
          <>
            <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs group hover:bg-white hover:border-zinc-200 transition-all duration-700">
               <div className="flex items-center gap-3">
                  <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic group-hover:text-accent transition-colors">Avg Resolution</div>
               </div>
               <div className="text-5xl font-black font-mono italic tracking-tighter">2.4<span className="text-xs text-zinc-300 ml-2">h</span></div>
            </div>
            <div className="p-10 border border-zinc-50 rounded-[3rem] bg-zinc-50/30 flex flex-col items-start justify-center min-w-[200px] space-y-2 shadow-xs group hover:bg-white hover:border-zinc-200 transition-all duration-700">
               <div className="flex items-center gap-3">
                  <GeometricLantern variant="security" className="w-4 h-4 text-zinc-200 group-hover:text-green-500 transition-colors" />
                  <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic group-hover:text-accent transition-colors">Integrity</div>
               </div>
               <div className="text-5xl font-black font-mono text-green-600 tracking-tighter italic">98.4%</div>
            </div>
          </>
        )}
      />

      {/* Audit List Interface */}
      <div className="space-y-12">
        <AnimatePresence mode="popLayout">
          {audits.map((audit, idx) => (
            <motion.div 
              key={audit.id}
              layout
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.8, ease: "circOut" }}
              className="p-16 border border-zinc-50 rounded-[5rem] bg-white group hover:border-zinc-200 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-3 h-full bg-zinc-50 group-hover:bg-accent transition-colors duration-700" />
              
              <div className="flex flex-col 3xl:flex-row gap-20">
                 <div className="flex flex-col xl:flex-row gap-16 flex-grow">
                    <div className="w-48 h-48 bg-zinc-50 rounded-[4rem] flex items-center justify-center text-zinc-100 border border-transparent group-hover:bg-accent group-hover:text-white group-hover:rotate-6 transition-all duration-1000 shadow-xs relative overflow-hidden shrink-0">
                       <GeometricLantern variant="terminal" className="w-20 h-20 relative z-10" />
                       <div className="absolute inset-0 opacity-10 group-hover:opacity-30">
                          <GeometricLantern variant="network" className="w-48 h-48 -rotate-12 translate-x-8 translate-y-8" />
                       </div>
                    </div>
                    
                    <div className="space-y-8 flex-grow">
                       <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-6">
                             <h3 className="text-6xl font-black tracking-tighter uppercase italic leading-none text-accent group-hover:translate-x-2 transition-transform duration-700">{audit.name}</h3>
                             <div className="flex items-center gap-3 px-4 py-1.5 bg-accent text-white rounded-sm text-[11px] font-black font-mono shadow-2xl shadow-accent/20 italic">
                                <GeometricLantern variant="terminal" className="w-4 h-4" /> NODE_{audit.id}
                             </div>
                             <div className="px-4 py-1.5 border border-zinc-100 text-zinc-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] italic bg-zinc-50/50 group-hover:bg-white group-hover:text-accent group-hover:border-accent transition-all">
                                PROTOCOL_V{audit.version}
                             </div>
                          </div>
                          <p className="text-xl font-bold text-zinc-400 max-w-3xl leading-relaxed italic border-l-2 border-zinc-50 pl-8 group-hover:text-zinc-500 transition-colors">{audit.description}</p>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                          <div className="flex items-center gap-6 p-6 bg-zinc-50/30 rounded-[2.5rem] border border-transparent group-hover:border-zinc-100 group-hover:bg-white transition-all duration-700 shadow-xs">
                             <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:bg-accent group-hover:text-white transition-all duration-700">
                                <GeometricLantern variant="user" className="w-6 h-6" />
                             </div>
                             <div className="space-y-0.5">
                                <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">Principal Identity</div>
                                <div className="text-lg font-black uppercase italic tracking-tight">{audit.owner}</div>
                             </div>
                          </div>
                          <div className="flex items-center gap-6 p-6 bg-zinc-50/30 rounded-[2.5rem] border border-transparent group-hover:border-zinc-100 group-hover:bg-white transition-all duration-700 shadow-xs">
                             <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:bg-accent group-hover:text-white transition-all duration-700">
                                <GeometricLantern variant="network" className="w-6 h-6" />
                             </div>
                             <div className="space-y-0.5">
                                <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">Address Vector</div>
                                <div className="text-lg font-black font-mono italic tracking-tighter">{audit.ip}</div>
                             </div>
                          </div>
                          <div className="flex items-center gap-6 p-6 bg-zinc-50/30 rounded-[2.5rem] border border-transparent group-hover:border-zinc-100 group-hover:bg-white transition-all duration-700 shadow-xs">
                             <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm group-hover:bg-accent group-hover:text-white transition-all duration-700">
                                <GeometricLantern variant="terminal" className="w-6 h-6" />
                             </div>
                             <div className="space-y-0.5">
                                <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">Grid Sector</div>
                                <div className="text-lg font-black uppercase italic tracking-tight">{audit.region}</div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row 3xl:flex-col justify-center gap-6 min-w-[320px]">
                    <button 
                      onClick={() => { setSelectedAudit(audit); setIsDialogOpen('approve'); }}
                      className="group/btn px-12 py-8 btn-accent rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center justify-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98]"
                    >
                       <GeometricLantern variant="spark" className="w-6 h-6 group-hover/btn:rotate-12 transition-transform duration-500" /> AUTHORIZE_NODE
                    </button>
                    <button 
                      onClick={() => { setSelectedAudit(audit); setIsDialogOpen('reject'); }}
                      className="group/btn px-12 py-8 border border-zinc-50 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center gap-6 italic active:scale-[0.98] shadow-xs hover:shadow-2xl hover:shadow-red-500/20"
                    >
                       <GeometricLantern variant="alert" className="w-6 h-6 group-hover/btn:-rotate-12 transition-transform duration-500" /> REJECT_REQUEST
                    </button>
                 </div>
              </div>

              <div className="mt-20 pt-16 border-t border-zinc-50 border-dashed grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-16 opacity-30 group-hover:opacity-100 transition-all duration-1000">
                 <div className="space-y-3">
                    <div className="flex items-center gap-4 text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">
                       <GeometricLantern variant="terminal" className="w-5 h-5 text-zinc-100 group-hover:text-accent transition-colors" /> EPOCH_TIMESTAMP
                    </div>
                    <p className="text-lg font-black font-mono italic tracking-tighter text-zinc-400 group-hover:text-accent transition-colors">{audit.submitted_at}</p>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-4 text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">
                       <GeometricLantern variant="activity" className="w-5 h-5 text-zinc-100 group-hover:text-green-500 transition-colors" /> LATENCY_PROBE
                    </div>
                    <p className="text-lg font-black font-mono italic tracking-tighter text-zinc-400 group-hover:text-green-500 transition-colors">8.42<span className="text-zinc-200">MS</span> / OPTIMAL</p>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-4 text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">
                       <GeometricLantern variant="security" className="w-5 h-5 text-zinc-100 group-hover:text-blue-500 transition-colors" /> INTEGRITY_SCAN
                    </div>
                    <p className="text-lg font-black font-mono italic tracking-tighter text-zinc-400 group-hover:text-blue-500 transition-colors">100% SECURE / STABLE</p>
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-4 text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">
                       <GeometricLantern variant="terminal" className="w-5 h-5 text-zinc-100 group-hover:text-orange-500 transition-colors" /> HARDWARE_HASH
                    </div>
                    <p className="text-lg font-black font-mono italic tracking-tighter text-zinc-400 group-hover:text-orange-500 transition-colors truncate">SH-NOC-CORE-009-X</p>
                 </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {audits.length === 0 && (
          <div className="py-64 text-center border border-zinc-50 rounded-[5rem] space-y-12 group hover:border-zinc-100 transition-all duration-1000 bg-white shadow-xs">
             <div className="relative inline-block">
                <div className="w-40 h-40 bg-zinc-50 rounded-[4rem] flex items-center justify-center mx-auto text-zinc-100 group-hover:bg-accent group-hover:text-white transition-all duration-1000 shadow-xs relative overflow-hidden">
                   <GeometricLantern variant="data" className="w-20 h-20 relative z-10" />
                   <motion.div initial={{ rotate: 0 }} animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute inset-0 opacity-10">
                      <GeometricLantern variant="network" className="w-40 h-40" />
                   </motion.div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-green-500 rounded-full border-[6px] border-white shadow-xl animate-pulse" />
             </div>
             <div className="space-y-4">
                <h3 className="text-5xl font-black uppercase tracking-tighter italic leading-none text-accent">Operational. All Clear.</h3>
                <p className="text-[12px] font-black text-zinc-300 uppercase tracking-[0.5em] italic leading-none">The verification queue is currently empty across all nodes.</p>
             </div>
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <AnimatePresence>
        {isDialogOpen && selectedAudit && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/90 backdrop-blur-xl" 
               onClick={() => setIsDialogOpen(null)} 
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 40 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 40 }}
               transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
               className="relative w-full max-w-2xl bg-white rounded-[5rem] shadow-[0_64px_128px_rgba(0,0,0,0.5)] p-20 space-y-20"
             >
                <button 
                   onClick={() => setIsDialogOpen(null)}
                   className="absolute top-12 right-12 p-4 text-zinc-200 hover:text-black transition-colors"
                >
                   <GeometricLantern variant="alert" className="w-8 h-8" />
                </button>

                <div className="flex items-center gap-10">
                   <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-2xl transition-all duration-700 ${isDialogOpen === 'approve' ? 'bg-accent text-white shadow-accent/20' : 'bg-red-500 text-white shadow-red-500/20'}`}>
                      <GeometricLantern variant={isDialogOpen === 'approve' ? 'security' : 'alert'} className="w-16 h-16 fill-current" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-6xl font-black tracking-tighter uppercase italic leading-none">{isDialogOpen === 'approve' ? 'Authorize.' : 'Reject.'}</h3>
                      <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic leading-none">Verification payload: <span className="text-accent">{selectedAudit.name}</span></p>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="flex items-center justify-between px-4">
                      <label className="text-[12px] font-black font-mono uppercase tracking-[0.5em] text-zinc-300 italic">{isDialogOpen === 'approve' ? 'TRANSMISSION_METADATA' : 'REASON_FOR_DENIAL'}</label>
                      <GeometricLantern variant="terminal" className="w-5 h-5 text-zinc-100" />
                   </div>
                   <textarea 
                     value={notes}
                     onChange={(e) => setNotes(e.target.value)}
                     className="w-full h-56 px-10 py-10 bg-zinc-50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] transition-all duration-700 outline-hidden font-black text-lg italic tracking-tight shadow-xs placeholder:text-zinc-200"
                     placeholder={isDialogOpen === 'approve' ? 'Optional: Add internal deployment commentary...' : 'REQUIRED: Explicit technical reason for denial...'}
                   />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8">
                   <button 
                     onClick={() => setIsDialogOpen(null)}
                     className="py-10 border border-zinc-50 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.6em] hover:bg-zinc-50 transition-all italic shadow-xs active:scale-[0.98] text-zinc-300 hover:text-black"
                   >
                      ABORT_ACTION
                   </button>
                   <button 
                     onClick={() => handleAction(isDialogOpen === 'approve' ? 'approved' : 'rejected')}
                     className={`py-10 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.6em] transition-all shadow-accent italic active:scale-[0.98] flex items-center justify-center gap-6 ${
                       isDialogOpen === 'approve' ? 'bg-accent text-white hover:bg-accent-medium shadow-accent/20' : 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                     }`}
                   >
                      CONFIRM_{isDialogOpen === 'approve' ? 'AUTH' : 'DENY'} <GeometricLantern variant={isDialogOpen === 'approve' ? 'spark' : 'alert'} className="w-5 h-5" />
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
      </StatusWrapper>
    </div>
  );
};

export default AdminReview;
