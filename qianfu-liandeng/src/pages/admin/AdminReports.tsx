import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

const reportsBadge = 'SANCTIONS_DIVISION / NODE_0';
const adminShellClass = 'space-y-16 pb-32 bg-white';
const adminHeaderTagClass = 'px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic';

const AdminReports: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('pending');

  const { data: reports, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.get<any[]>('/admin/reports'),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: string }) => 
      api.patch(`/admin/reports/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      toast({ title: 'OPERATION SUCCESSFUL', description: 'Sanction status has been updated in the global ledger.' });
    }
  });

  const filtered = reports?.filter(r => r.status.toLowerCase() === activeTab);

  return (
    <div className={adminShellClass}>
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader
          badge={reportsBadge}
          title="Justice."
          description="审阅违规举报，维护社区净土。所有执行的操作都将被永久记录在审计日志中以备溯源。"
          statusLabel="Enforcement Protocol: ACTIVE"
          statusTone="danger"
          rightSlot={(
            <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-[3rem] flex items-center gap-10 shadow-xs hover:bg-white hover:border-zinc-200 transition-all duration-700 group cursor-default">
              <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center border border-zinc-100 shadow-xs group-hover:bg-accent group-hover:text-white transition-all duration-700">
                <GeometricLantern variant="activity" className="w-10 h-10 text-zinc-300 group-hover:text-white" />
              </div>
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 italic">Community Health</div>
                <div className="text-4xl font-black font-mono tracking-tighter italic leading-none">94.2%</div>
              </div>
            </div>
          )}
        />

      {/* Tab Nav & Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
         <div className="flex gap-16 overflow-x-auto no-scrollbar w-full xl:w-auto">
           {[
             { id: 'pending', label: 'Awaiting Judgment', tag: 'JUS_01' },
             { id: 'resolved', label: 'Archived Cases', tag: 'JUS_02' },
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-start gap-3 pb-10 transition-all relative group ${activeTab === tab.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
               <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">{tab.label}</span>
               <span className="text-[9px] font-black font-mono tracking-widest text-zinc-400">/ {tab.tag}</span>
               {activeTab === tab.id && <motion.div layoutId="report-tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent" />}
             </button>
           ))}
         </div>
         <div className="relative w-full xl:w-[36rem] group">
            <GeometricLantern variant="terminal" className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-200 group-focus-within:text-accent transition-colors duration-500" />
            <input type="text" placeholder="SEARCH BY CASE_ID..." className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] outline-hidden text-lg font-black italic transition-all duration-500 shadow-xs" />
         </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
          <AnimatePresence mode="popLayout">
            {filtered?.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-48 border border-zinc-50 rounded-[5rem] bg-zinc-50/20 text-center border-dashed space-y-10 group/empty">
                 <div className="relative inline-block">
                    <GeometricLantern variant="alert" className="w-24 h-24 text-zinc-100 mx-auto transition-all duration-1000 group-hover/empty:text-accent group-hover/empty:scale-110" />
                    <GeometricLantern variant="activity" className="absolute inset-0 w-24 h-24 text-zinc-100 opacity-20 animate-ping" />
                 </div>
                 <div className="space-y-4">
                    <p className="text-[12px] font-black text-zinc-300 uppercase tracking-[0.6em] italic">Perfect Order: 0 Incident Reports</p>
                    <p className="text-[9px] font-black text-zinc-100 uppercase tracking-widest italic">Community enforcement clear / No active sanctions pending</p>
                 </div>
              </motion.div>
            ) : (
              filtered?.map((report: any, idx: number) => (
                <motion.div key={report.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.5 }} className="p-16 border border-zinc-50 rounded-[5rem] bg-white flex flex-col xl:flex-row xl:items-center justify-between gap-16 group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden">
                  <div className="absolute left-0 top-0 w-2 h-full rounded-l-[5rem] bg-red-500 opacity-60" />
                  <div className="space-y-8 flex-grow pl-6">
                     <div className="flex items-center gap-6">
                        <div className={`px-5 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.4em] italic border shadow-xs ${report.targetType === 'server' ? 'bg-accent text-white border-accent shadow-accent/20' : 'bg-zinc-800 text-white border-zinc-700'}`}>
                           {report.targetType}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">
                           CASE_ID: <span className="text-accent not-italic font-black underline underline-offset-4">{report.targetId}</span>
                        </div>
                     </div>
                     <h3 className="text-4xl font-black tracking-tighter uppercase italic leading-none text-accent group-hover:translate-x-2 transition-transform duration-700">{report.reason}</h3>
                     <div className="flex flex-wrap items-center gap-10 text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">
                        <span className="flex items-center gap-3"><GeometricLantern variant="user" className="w-4 h-4" /> AGENT: {report.reporter?.username}</span>
                        <span className="flex items-center gap-3"><GeometricLantern variant="activity" className="w-4 h-4" /> STAMP: {new Date(report.createdAt).toLocaleString()}</span>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                     {report.status === 'PENDING' ? (
                       <>
                         <button onClick={() => resolveMutation.mutate({ id: report.id, status: 'REJECTED' })} className="w-20 h-20 flex items-center justify-center border border-zinc-100 rounded-[2rem] hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all duration-500 group/btn shadow-xs active:scale-[0.95]" title="Dismiss Case">
                            <GeometricLantern variant="alert" className="w-8 h-8 text-zinc-300 group-hover/btn:text-red-500 transition-colors" />
                         </button>
                         <button onClick={() => resolveMutation.mutate({ id: report.id, status: 'RESOLVED' })} className="group/btn px-12 py-6 btn-accent rounded-[2.5rem] transition-all duration-500 shadow-2xl shadow-accent/20 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.4em] italic active:scale-[0.98]">
                            <GeometricLantern variant="security" className="w-5 h-5 group-hover/btn:scale-110 transition-transform" /> EXECUTE_SANCTION
                         </button>
                       </>
                     ) : (
                       <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-green-600 bg-green-50 px-8 py-5 rounded-[2rem] border border-green-100 italic shadow-xs">
                          <GeometricLantern variant="spark" className="w-5 h-5" /> RESOLUTION_LOGGED
                       </div>
                     )}
                     <button className="w-20 h-20 flex items-center justify-center border border-zinc-100 rounded-[2rem] hover:bg-zinc-50 hover:border-zinc-200 transition-all duration-500 group/btn shadow-xs active:scale-[0.95]">
                        <GeometricLantern variant="network" className="w-6 h-6 text-zinc-300 group-hover/btn:text-accent transition-colors" />
                     </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminReports;
