import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import GeometricLantern from '@/components/icons/GeometricLantern';

const moderationBadge = 'CONTENT_SENTINEL / V2.0';
const adminShellClass = 'space-y-16 pb-32 bg-white';
const adminHeaderTagClass = 'px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-sm shadow-2xl shadow-accent/20 italic';

const AdminModeration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'sensitive'>('pending');
  
  const { data: pendingItems = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-moderation', activeTab],
    queryFn: () => api.get<any[]>(activeTab === 'pending' ? '/admin/moderation/pending' : '/admin/moderation/sensitive'),
  });

  return (
    <div className={adminShellClass}>
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader
          badge={moderationBadge}
          title="Guard."
          description="审阅被 AI 标记或举报的敏感内容。系统通过神经网络自动评分，辅助管理团队快速执行决策。"
          statusLabel="AI Analysis Active"
          statusTone="warning"
          rightSlot={(
            <div className="flex gap-6">
              <div className="p-10 bg-zinc-50 border border-zinc-100 rounded-[3rem] flex items-center gap-8 shadow-xs group hover:bg-white hover:border-zinc-200 transition-all duration-700">
                <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center shadow-xs border border-zinc-100 group-hover:bg-accent group-hover:text-white transition-all duration-700"><GeometricLantern variant="activity" className="w-8 h-8 text-zinc-300 group-hover:text-white" /></div>
                <div className="space-y-1">
                   <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400 italic">Neutralized</div>
                   <div className="text-4xl font-black font-mono tracking-tighter italic">2.4k+</div>
                </div>
              </div>
              <button className="group px-12 py-6 btn-accent rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all duration-500 flex items-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98]">
                <GeometricLantern variant="spark" className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" /> BATCH_AUTHORIZE
              </button>
            </div>
          )}
        />

        {/* Tab Nav */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
         <div className="flex gap-16 overflow-x-auto no-scrollbar w-full md:w-auto">
           {[
             { id: 'pending', label: 'Audit Queue', count: 12, tag: 'SEN_01' },
             { id: 'sensitive', label: 'Dictionary', count: 248, tag: 'SEN_02' },
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-start gap-3 pb-10 transition-all relative group ${activeTab === tab.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
               <div className="flex items-center gap-4">
                  <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">{tab.label}</span>
                  <span className="px-4 py-1.5 bg-zinc-100 rounded-sm text-[10px] font-black font-mono italic tracking-[0.3em] group-hover:bg-accent group-hover:text-white transition-colors shadow-xs">{tab.count}</span>
               </div>
               <span className="text-[9px] font-black font-mono tracking-widest text-zinc-400">/ {tab.tag}</span>
               {activeTab === tab.id && <motion.div layoutId="mod-tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent" />}
             </button>
           ))}
         </div>
         {activeTab === 'sensitive' && (
            <div className="relative w-full md:w-[28rem] group">
               <GeometricLantern variant="terminal" className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-200 group-focus-within:text-accent transition-colors duration-500" />
               <input type="text" placeholder="QUERY KEYWORDS..." className="w-full pl-20 pr-8 py-6 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[3rem] outline-hidden text-lg font-black italic transition-all duration-500 shadow-xs" />
            </div>
         )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'pending' && (
          <motion.div key="pending" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 gap-8">
             {pendingItems.map((item, idx) => (
               <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="p-16 border border-zinc-50 rounded-[5rem] bg-white flex flex-col xl:flex-row xl:items-center justify-between gap-16 group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000 shadow-xs relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-2 h-full rounded-l-[5rem] ${item.riskScore > 80 ? 'bg-red-500' : item.riskScore > 60 ? 'bg-orange-500' : 'bg-zinc-200'}`} />
                  <div className="flex-grow space-y-8 pl-8">
                     <div className="flex items-center gap-6">
                        <div className="px-5 py-2 bg-zinc-50 rounded-sm text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 group-hover:bg-accent group-hover:text-white transition-colors duration-500 italic border border-zinc-100 shadow-xs">{item.type}</div>
                        <div className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] italic ${item.riskScore > 80 ? 'text-red-500' : 'text-orange-500'}`}>
                           <div className={`w-2 h-2 rounded-full ${item.riskScore > 80 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'} animate-pulse`} />
                           Risk Score: {item.riskScore}%
                        </div>
                     </div>
                     <p className="text-3xl font-black tracking-tighter uppercase italic leading-none text-accent group-hover:translate-x-2 transition-transform duration-700">{item.content}</p>
                     <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">
                        Author Node: <span className="text-accent not-italic font-black underline underline-offset-4">{item.author}</span> · Vectorized 2h ago
                     </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                     <button className="w-20 h-20 flex items-center justify-center border border-zinc-100 rounded-[2rem] hover:bg-red-500 hover:text-white hover:border-red-400 transition-all duration-500 shadow-xs group/btn active:scale-[0.95]">
                        <GeometricLantern variant="alert" className="w-8 h-8 text-zinc-300 group-hover/btn:text-white transition-colors" />
                     </button>
                     <button className="w-20 h-20 flex items-center justify-center border border-zinc-100 rounded-[2rem] hover:bg-orange-500 hover:text-white hover:border-orange-400 transition-all duration-500 shadow-xs group/btn active:scale-[0.95]">
                        <GeometricLantern variant="alert" className="w-8 h-8 text-zinc-300 group-hover/btn:text-white transition-colors" />
                     </button>
                     <button className="group/btn px-12 py-6 btn-accent rounded-[2.5rem] transition-all duration-500 shadow-2xl shadow-accent/20 flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.4em] italic active:scale-[0.98]">
                        <GeometricLantern variant="spark" className="w-5 h-5 group-hover/btn:scale-110 transition-transform" /> AUTHORIZE
                     </button>
                  </div>
               </motion.div>
             ))}
          </motion.div>
        )}

        {activeTab === 'sensitive' && (
          <motion.div key="sensitive" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="p-20 border border-zinc-50 rounded-[5rem] bg-white space-y-20 shadow-xs group hover:border-zinc-100 hover:shadow-2xl hover:shadow-black/5 transition-all duration-1000">
             <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-2">
                   <h3 className="text-5xl font-black uppercase tracking-tighter italic leading-none">Linguistic Filters.</h3>
                   <p className="text-[11px] font-black text-zinc-300 uppercase tracking-[0.4em] italic border-l-2 border-zinc-100 pl-4">Core dictionary for automated string matching.</p>
                </div>
                <button className="group px-12 py-6 btn-accent rounded-[2.5rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all duration-500 shadow-xl shadow-accent/20 italic active:scale-[0.98]">
                   DEPLOY_KEYWORD
                </button>
             </div>
             <div className="flex flex-wrap gap-4">
                {['暴力', '色情', '诈骗', '辅助', '外挂', '恶意刷屏', '广告位出售', 'DDOS', '私服', '盗号'].map(tag => (
                  <div key={tag} className="group/tag px-8 py-5 bg-zinc-50 border border-zinc-100 rounded-[2rem] flex items-center gap-5 hover:bg-accent hover:text-white hover:border-accent transition-all duration-500 cursor-pointer shadow-xs active:scale-[0.95]">
                     <span className="text-lg font-black uppercase italic tracking-tight">{tag}</span>
                     <GeometricLantern variant="alert" className="w-5 h-5 text-zinc-300 group-hover/tag:text-red-400 transition-colors duration-300" />
                  </div>
                ))}
             </div>
             <div className="pt-16 border-t border-zinc-50 flex flex-col md:flex-row items-center gap-12">
                <div className="w-24 h-24 bg-zinc-50 rounded-[3rem] flex items-center justify-center text-zinc-200 group-hover:bg-accent group-hover:text-white transition-all duration-700 shadow-xs shrink-0"><GeometricLantern variant="security" className="w-12 h-12" /></div>
                <div className="space-y-4 flex-grow">
                   <h4 className="text-[12px] font-black uppercase tracking-[0.5em] italic">Autonomous Interception Logic</h4>
                   <p className="text-lg text-zinc-400 font-bold leading-relaxed italic max-w-2xl">
                      当内容包含以上关键词时，系统将自动标记为 PENDING 并通知管理团队。高置信度 (Confidence &gt; 0.95) 匹配将直接触发自动 REJECT 逻辑并记录 IP 异常。
                   </p>
                </div>
                <div className="w-16 h-16 bg-zinc-50 rounded-[2rem] flex items-center justify-center text-zinc-100 group-hover:bg-accent group-hover:text-white transition-all duration-700 shadow-xs shrink-0"><GeometricLantern variant="data" className="w-8 h-8" /></div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      </StatusWrapper>
    </div>
  );
};

export default AdminModeration;
