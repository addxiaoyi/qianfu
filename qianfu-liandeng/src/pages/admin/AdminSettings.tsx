import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { request } from '@/api/request';
import { toast } from '@/hooks/use-toast';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminPageHeader from '@/components/AdminPageHeader';
import GeometricLantern from '@/components/icons/GeometricLantern';

const settingsBadge = 'SYSTEM_CORE / ALPHA-CONFIG';

const adminSectionCardClass = 'bg-white border border-zinc-100 rounded-[3rem] p-12 space-y-12 shadow-xs group hover:border-accent transition-all duration-700';
const adminHeaderTagClass = 'px-2 py-1 bg-accent text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-sm shadow-xl shadow-accent/20';

const AdminSettings: React.FC = () => {
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      siteName: '千服联灯',
      siteDesc: 'Minecraft 服务器宣传平台',
      minWithdraw: 100,
      feeRate: 0.1,
      maintenance: false
    }
  });

  const values = useWatch({ control });

  const onSubmit = async (values: any) => {
    try {
      await request('/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      toast({ title: 'CONFIGURATION SYNCHRONIZED', description: 'System variables updated across all nodes.' });
    } catch { }
  };

  return (
    <div className="space-y-16 pb-24">
      <AdminPageHeader
        badge="System Core / Alpha-Config"
        title="Matrix."
        description="全局参数配置与站点架构管理。调整结算阈值、服务费率及系统运行模式。所有更改均具备原子性。"
        statusLabel="Variables: Mutable"
        statusTone="warning"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-zinc-100 rounded-[3rem] p-12 space-y-12 shadow-xs group hover:border-accent transition-all duration-700"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white transition-all duration-500">
               <GeometricLantern variant="network" className="w-8 h-8" />
            </div>
            <div className="space-y-1">
               <h3 className="text-2xl font-black uppercase tracking-tighter italic">Identity.</h3>
               <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic leading-none">Public Presence and SEO primitives</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
             <div className="space-y-4">
                <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-zinc-400 italic">Site Identifier</label>
                <input 
                  {...register('siteName')}
                  className="w-full px-8 py-5 bg-zinc-50 border border-transparent focus:bg-white focus:border-accent rounded-2xl text-sm font-black italic transition-all outline-hidden shadow-xs"
                />
             </div>
             <div className="space-y-4">
                <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-zinc-400 italic">Core Metadata Description</label>
                <input 
                  {...register('siteDesc')}
                  className="w-full px-8 py-5 bg-zinc-50 border border-transparent focus:bg-white focus:border-accent rounded-2xl text-sm font-black italic transition-all outline-hidden shadow-xs"
                />
             </div>
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-zinc-100 rounded-[3rem] p-12 space-y-12 shadow-xs group hover:border-accent transition-all duration-700"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white transition-all duration-500">
               <GeometricLantern variant="payment" className="w-8 h-8" />
            </div>
            <div className="space-y-1">
               <h3 className="text-2xl font-black uppercase tracking-tighter italic">Financials.</h3>
               <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic leading-none">Settlement thresholds and service tax nodes</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-zinc-400 italic">Min. Withdrawal Threshold (¥)</label>
                   <GeometricLantern variant="data" className="w-4 h-4 text-zinc-200" />
                </div>
                <input 
                  type="number"
                  {...register('minWithdraw')}
                  className="w-full px-8 py-5 bg-zinc-50 border border-transparent focus:bg-white focus:border-accent rounded-2xl text-sm font-black font-mono italic transition-all outline-hidden shadow-xs"
                />
             </div>
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <label className="text-[10px] font-black font-mono uppercase tracking-[0.3em] text-zinc-400 italic">Platform Protocol Fee (0.0-1.0)</label>
                   <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-200" />
                </div>
                <input 
                  type="number"
                  step="0.01"
                  {...register('feeRate')}
                  className="w-full px-8 py-5 bg-zinc-50 border border-transparent focus:bg-white focus:border-accent rounded-2xl text-sm font-black font-mono italic transition-all outline-hidden shadow-xs"
                />
             </div>
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-50/50 border border-zinc-100 rounded-[3rem] p-12 flex flex-col md:flex-row items-center justify-between gap-8 group hover:border-red-100 transition-all duration-700"
        >
          <div className="flex items-center gap-8">
             <div className="w-20 h-20 bg-accent text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-accent/20">
               <GeometricLantern variant="security" className="w-10 h-10" />
             </div>
             <div className="space-y-1">
               <h3 className="text-3xl font-black uppercase tracking-tighter italic leading-none">Hardened Maintenance.</h3>
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest italic leading-none">启用后非管理员用户将无法访问站点，进入安全隔离模式。</p>
             </div>
          </div>
          <div className="flex items-center gap-6">
             <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">{values.maintenance ? 'STATUS: ISOLATED' : 'STATUS: OPERATIONAL'}</span>
             <div className="relative inline-block w-20 h-10">
                <input 
                  type="checkbox" 
                  {...register('maintenance')} 
                  className="peer appearance-none w-full h-full bg-zinc-200 rounded-full cursor-pointer transition-all checked:bg-red-500" 
                />
                <div className="absolute left-2 top-2 w-6 h-6 bg-white rounded-full transition-all peer-checked:left-12 pointer-events-none shadow-sm" />
             </div>
          </div>
        </motion.section>

        <div className="flex justify-end pt-8">
          <button 
            type="submit"
            className="px-16 py-8 btn-accent rounded-[2rem] text-[11px] font-black uppercase tracking-[0.5em] flex items-center gap-4 transition-all shadow-2xl shadow-accent/20 group"
          >
            <GeometricLantern variant="spark" className="w-6 h-6 group-hover:scale-110 transition-transform" /> Synchronize Matrix <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;
