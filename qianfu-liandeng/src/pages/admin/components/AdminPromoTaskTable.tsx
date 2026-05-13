import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { promoActionLabels } from '../promoActionLabels';
import { promoUi } from '../promoUi';

interface Props {
  tasks: any[];
  onPublish: (id: number) => void;
  onPause: (task: any) => void;
  onDisable: (task: any) => void;
}

const AdminPromoTaskTable: React.FC<Props> = ({ tasks, onPublish, onPause, onDisable }) => {
  return (
    <div className={`${promoUi.sectionCard} overflow-hidden group/table hover:border-zinc-100 transition-all duration-1000`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50/50 border-b border-zinc-100">
              <th className={promoUi.headingKicker + ' px-16 py-10'}>Task</th>
              <th className={promoUi.headingKicker + ' px-16 py-10'}>Target</th>
              <th className={promoUi.headingKicker + ' px-16 py-10'}>Reward</th>
              <th className={promoUi.headingKicker + ' px-16 py-10'}>Rule</th>
              <th className={promoUi.headingKicker + ' px-16 py-10 text-right'}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {tasks.length === 0 ? (
              <tr><td colSpan={5} className="py-32 text-center text-zinc-300 font-black uppercase tracking-[0.5em] italic">No promo tasks found.</td></tr>
            ) : tasks.map((task: any, idx: number) => {
              const status = String(task.status).toLowerCase();
              const isDraft = status === 'draft';
              return (
                <motion.tr key={task.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className={`group transition-all duration-500 ${isDraft ? 'bg-amber-50/70 hover:bg-amber-100/70 ring-1 ring-amber-100' : 'hover:bg-zinc-50/50'}`}>
                  <td className="px-16 py-12"><div className="space-y-2"><Link to={`/admin-promo/tasks/${task.id}`} className="font-black text-2xl uppercase tracking-tighter italic leading-none group-hover:translate-x-2 transition-transform duration-500 inline-block">{task.title}</Link><div className="flex items-center gap-3"><GeometricLantern variant="terminal" className="w-3.5 h-3.5 text-zinc-100 group-hover:text-accent transition-colors" /><span className="text-[10px] text-zinc-300 font-black font-mono uppercase tracking-[0.2em] group-hover:text-zinc-500 transition-colors italic">{task.platform}</span>{isDraft && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-[0.3em] italic border border-amber-200">Draft</span>}</div></div></td>
                  <td className="px-16 py-12"><div className="space-y-3"><div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">{task.target_type}</div><div className="font-mono text-[10px] text-zinc-500 break-all">{task.target_id}</div></div></td>
                  <td className="px-16 py-12"><div className="space-y-2"><div className="text-2xl font-black font-mono italic leading-none">¥ {task.reward_amount}</div><div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">{task.reward_type}</div></div></td>
                  <td className="px-16 py-12"><div className="space-y-2 text-[10px] font-black uppercase tracking-[0.3em] italic text-zinc-400"><div>限领：{task.claim_limit_per_user} 次</div><div>{task.need_audit ? '人工审核' : '自动发放'}</div><div>{task.auto_verify ? '自动校验' : '手动校验'}</div></div></td>
                  <td className="px-16 py-12 text-right"><div className="flex items-center justify-end gap-3 flex-wrap"><span className={`px-4 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] italic border shadow-xs ${status === 'enabled' ? 'bg-accent text-white border-accent shadow-accent/20' : status === 'paused' ? 'bg-amber-100 text-amber-700 border-amber-200' : status === 'draft' ? 'bg-white text-amber-700 border-amber-200 ring-1 ring-amber-100' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>{task.status}</span>{isDraft && <span className={promoUi.chip + ' bg-amber-50 text-amber-700 border-amber-200'}>Draft Only</span>}<Link to={`/admin-promo/create?taskId=${task.id}`} className={promoUi.actionBtn}>Edit</Link><button onClick={() => onPublish(task.id)} className={promoUi.actionBtn}>Publish</button><button onClick={() => onPause(task)} className={promoUi.actionBtn}>Pause</button><button onClick={() => onDisable(task)} className={promoUi.actionBtn}>Disable</button><Link to={`/admin-promo/tasks/${task.id}`} className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-all duration-700 shadow-xs"><ChevronRight className="w-5 h-5" /></Link></div></td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPromoTaskTable;
