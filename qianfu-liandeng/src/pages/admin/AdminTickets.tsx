import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';

const ticketsBadge = 'SUPPORT_GRID / NODE_0';

const AdminTickets: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved' | 'all'>('pending');
  const { data: tickets, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => api.get<any[]>('/admin/tickets'),
  });

  const filtered = tickets?.filter(t => {
     if (activeTab === 'all') return true;
     return t.status.toLowerCase() === activeTab;
  });

  return (
    <div className="space-y-16 pb-32 bg-white">
      <AdminPageHeader
        badge={ticketsBadge}
        title="Nexus."
        description="全量工单处理中心，响应每一份用户诉求。系统实时监控平均响应时长与解决率。"
        statusLabel="Response Load: OPTIMAL"
        rightSlot={(
          <div className="p-10 bg-accent text-white rounded-[3rem] flex items-center gap-10 shadow-2xl shadow-accent/20 transition-all duration-700 group cursor-default">
           <div className="w-20 h-20 bg-accent-medium/30 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-inner group-hover:rotate-12 transition-transform duration-700">
              <GeometricLantern variant="activity" className="w-10 h-10 text-green-500 animate-pulse" />
           </div>
           <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500 italic">Live Load</div>
              <div className="text-4xl font-black font-mono tracking-tighter uppercase italic leading-none">OPTIMAL</div>
           </div>
          </div>
        )}
      />

      {/* Tab Nav & Search */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
         <div className="flex gap-16 overflow-x-auto no-scrollbar w-full xl:w-auto">
           {[
             { id: 'pending', label: 'Processing', tag: 'NX_01' },
             { id: 'resolved', label: 'Archived', tag: 'NX_02' },
             { id: 'all', label: 'Universal', tag: 'NX_ALL' },
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-start gap-3 pb-10 transition-all relative group ${activeTab === tab.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
               <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">{tab.label}</span>
               <span className="text-[9px] font-black font-mono tracking-widest text-zinc-400">/ {tab.tag}</span>
               {activeTab === tab.id && <motion.div layoutId="ticket-tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent" />}
             </button>
           ))}
         </div>
         <div className="relative w-full xl:w-[36rem] group">
            <GeometricLantern variant="terminal" className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-200 group-focus-within:text-accent transition-colors duration-500" />
            <input type="text" placeholder="SEARCH BY ID OR SUBJECT_VECTOR..." className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] outline-hidden text-lg font-black italic transition-all duration-500 shadow-xs" />
         </div>
      </div>

      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <div className="grid grid-cols-1 gap-8">
           <AnimatePresence mode="popLayout">
              {filtered?.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-48 border border-zinc-50 rounded-[5rem] bg-zinc-50/20 text-center border-dashed space-y-10 group/empty">
                   <div className="relative inline-block">
                      <GeometricLantern variant="alert" className="w-24 h-24 text-zinc-100 mx-auto transition-all duration-1000 group-hover/empty:text-accent group-hover/empty:scale-110" />
                      <GeometricLantern variant="activity" className="absolute inset-0 w-24 h-24 text-zinc-100 opacity-20 animate-ping" />
                   </div>
                   <div className="space-y-4">
                      <p className="text-[12px] font-black text-zinc-300 uppercase tracking-[0.6em] italic">Operational Vacuum: 0 Messages</p>
                      <p className="text-[9px] font-black text-zinc-100 uppercase tracking-widest italic">All support channels clear / No active transmissions</p>
                   </div>
                </motion.div>
              ) : (
                filtered?.map((ticket: any, idx: number) => (
                  <motion.div key={ticket.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05, duration: 0.5 }}>
                    <Link to={`/dashboard/tickets/${ticket.id}`} className="flex flex-col xl:flex-row xl:items-center justify-between p-16 border border-zinc-50 rounded-[5rem] bg-white hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 group shadow-xs relative overflow-hidden">
                      <div className={`absolute left-0 top-0 w-2 h-full rounded-l-[5rem] ${ticket.status === 'PENDING' ? 'bg-orange-400' : 'bg-zinc-100'}`} />
                      <div className="flex items-start gap-12 pl-6">
                         <div className={`w-20 h-20 rounded-[2.5rem] shrink-0 flex items-center justify-center transition-all duration-700 shadow-xs ${ticket.status === 'PENDING' ? 'bg-orange-50 border border-orange-100 text-orange-500' : 'bg-zinc-50 border border-zinc-100 text-zinc-300 group-hover:bg-accent group-hover:text-white group-hover:border-accent'}`}>
                            <GeometricLantern variant="terminal" className="w-10 h-10" />
                         </div>
                         <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-6">
                               <h3 className="text-3xl font-black tracking-tighter uppercase italic text-accent group-hover:translate-x-2 transition-transform duration-700">{ticket.subject}</h3>
                               <div className={`text-[10px] font-black font-mono px-5 py-2 rounded-sm uppercase tracking-[0.3em] italic border shadow-xs ${ticket.status === 'PENDING' ? 'bg-accent text-white border-accent shadow-accent/20' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                                  {ticket.status}
                               </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-10 text-[10px] font-black font-mono text-zinc-300 uppercase tracking-[0.3em] italic">
                               <div className="flex items-center gap-3"><GeometricLantern variant="user" className="w-4 h-4" /> AGENT: {ticket.user?.username}</div>
                               <div className="flex items-center gap-3"><GeometricLantern variant="terminal" className="w-4 h-4" /> STAMP: {new Date(ticket.createdAt).toLocaleString()}</div>
                               <div>#ID: {ticket.id?.slice(-8)}</div>
                            </div>
                         </div>
                      </div>
                      <div className="mt-10 xl:mt-0 flex items-center gap-6 ml-auto shrink-0">
                         <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 group-hover:text-accent transition-colors duration-500 italic">Access Transmission</span>
                         <div className="w-16 h-16 rounded-[2rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-all duration-700 shadow-xs">
                            <ChevronRight className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
                         </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
           </AnimatePresence>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminTickets;
