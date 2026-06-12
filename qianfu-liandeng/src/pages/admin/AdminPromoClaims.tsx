import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import AdminStatCard from '@/components/AdminStatCard';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import AdminPromoClaimDetail from './components/AdminPromoClaimDetail';
import { promoRemarkPresets } from './promoRemarkConfig';

const AdminPromoClaims: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'verified' | 'rewarded' | 'rejected'>('all');
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remark, setRemark] = useState('');
  const [remarkProfile, setRemarkProfile] = useState<'pass' | 'reject'>('pass');

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['admin-promo-claims'], queryFn: () => api.get<any[]>('/promo/claims/me') });
  const claims = useMemo(() => (Array.isArray(data) ? data : ((data as any)?.list ?? [])) as any[], [data]);
  const filtered = useMemo(() => claims.filter((c: any) => activeTab === 'all' || String(c.claim_status || '').toLowerCase() === activeTab), [claims, activeTab]);
  const currentClaim = selectedClaim ?? filtered[selectedIndex];

  useEffect(() => {
    setSelectedIndex(0);
    setSelectedClaim(null);
  }, [activeTab]);

  const approveMutation = useMutation({ mutationFn: ({ id, remark }: { id: number; remark: string }) => api.post(`/promo/claims/${id}/approve`, { remark }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-promo-claims'] }); toast({ title: 'CLAIM_APPROVED', description: 'Promo claim rewarded successfully.' }); } });
  const rejectMutation = useMutation({ mutationFn: ({ id, remark }: { id: number; remark: string }) => api.post(`/promo/claims/${id}/reject`, { remark }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-promo-claims'] }); toast({ title: 'CLAIM_REJECTED', description: 'Promo claim has been rejected.' }); } });
  const detailMutation = useMutation({ mutationFn: (id: number) => api.get<any>(`/promo/claims/${id}/detail`) });

  const stats = [
    { label: '领取总数', value: String(claims.length), variant: 'network' as const, color: 'text-green-500', trend: '任务申领', tag: 'PC_01' },
    { label: '待审核', value: String(claims.filter((c: any) => String(c.claim_status).toLowerCase() === 'pending').length), variant: 'security' as const, color: 'text-orange-500', trend: '人工确认', tag: 'PC_02' },
    { label: '已发放', value: String(claims.filter((c: any) => String(c.reward_status).toLowerCase() === 'rewarded').length), variant: 'spark' as const, color: 'text-blue-500', trend: '钱包到账', tag: 'PC_03' },
    { label: '已拒绝', value: String(claims.filter((c: any) => String(c.claim_status).toLowerCase() === 'rejected').length), variant: 'alert' as const, color: 'text-zinc-400', trend: '驳回记录', tag: 'PC_04' },
  ];

  const openDetail = async (claim: any, index: number) => { setSelectedIndex(index); setRemark(''); setRemarkProfile('pass'); const resp = await detailMutation.mutateAsync(claim.id); setSelectedClaim(resp?.data ?? resp ?? claim); };
  const move = async (delta: number) => { const next = selectedIndex + delta; if (next < 0 || next >= filtered.length) return; await openDetail(filtered[next], next); };
  const submit = (mode: 'approve' | 'reject', id: number) => { if (!remark.trim()) return toast({ variant: 'destructive', title: 'REMARK_REQUIRED', description: '请输入审核备注或选择快捷短语。' }); (mode === 'approve' ? approveMutation : rejectMutation).mutate({ id, remark: remark.trim() }); };

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <AdminPageHeader badge="推广领取 / 审核流转" title="领取审核" description="统一查看领取、校验、发奖与审核流转状态，并对人工审核任务执行通过或拒绝操作。" statusLabel="审核面板已就绪" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10">{stats.map((s, idx) => <AdminStatCard key={s.tag} tag={s.tag} value={s.value} label={s.label} variant={s.variant} colorClassName={s.color} trend={s.trend} delay={idx * 0.08} />)}</div>
        <div className="flex gap-16 overflow-x-auto no-scrollbar w-full pt-12 border-t border-zinc-50">{([{ id: 'all', label: '全部' }, { id: 'pending', label: '待审核' }, { id: 'verified', label: '已校验' }, { id: 'rewarded', label: '已发放' }, { id: 'rejected', label: '已驳回' }] as const).map((item) => <button type="button" key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-start gap-3 pb-10 transition-all relative group ${activeTab === item.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}><span className="text-[12px] font-black uppercase tracking-[0.4em] italic">{item.label}</span><span className="text-[9px] font-black font-mono tracking-widest text-zinc-400">/ {item.id.toUpperCase()}</span>{activeTab === item.id && <motion.div layoutId="promo-claims-tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent" />}</button>)}</div>
        <div className="border border-zinc-50 rounded-[5rem] overflow-hidden bg-white shadow-xs transition-all duration-1000"><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-zinc-50/50 border-b border-zinc-100"><th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">用户</th><th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">任务</th><th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">领取</th><th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic">奖励</th><th className="px-16 py-10 text-[10px] font-black uppercase tracking-[0.5em] text-zinc-300 italic text-right">操作</th></tr></thead><tbody className="divide-y divide-zinc-50">{filtered.length === 0 ? <tr><td colSpan={5} className="py-32 text-center text-zinc-300 font-black uppercase tracking-[0.5em] italic">当前没有领取记录。</td></tr> : filtered.map((claim: any, idx: number) => (<motion.tr key={claim.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="group hover:bg-zinc-50/50 transition-all duration-500"><td className="px-16 py-12"><div className="space-y-2"><div className="font-black text-2xl uppercase tracking-tighter italic leading-none">{claim.user_id}</div><div className="text-[10px] text-zinc-300 font-black font-mono uppercase tracking-[0.2em] italic">UID / {claim.platform_user_id}</div></div></td><td className="px-16 py-12"><div className="space-y-2"><div className="font-black text-xl uppercase tracking-tight italic">{claim.task?.title || `任务 #${claim.task_id}`}</div><div className="font-mono text-[10px] text-zinc-500 break-all">{claim.task?.platform}</div></div></td><td className="px-16 py-12"><div className="space-y-2 text-[10px] font-black uppercase tracking-[0.3em] italic text-zinc-400"><div>状态：{claim.claim_status}</div><div>校验：{claim.verify_result ? '已通过' : '未通过'}</div></div></td><td className="px-16 py-12"><div className="space-y-2"><div className="text-2xl font-black font-mono italic leading-none">¥ {claim.task?.reward_amount ?? 0}</div><div className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">{claim.reward_status}</div></div></td><td className="px-16 py-12 text-right"><div className="flex items-center justify-end gap-3 flex-wrap"><button type="button" onClick={() => openDetail(claim, idx)} className="px-4 py-2 rounded-[1rem] bg-white border border-zinc-100 text-[10px] font-black uppercase tracking-[0.3em] italic hover:border-accent transition-all">详情</button><button type="button" onClick={() => submit('approve', claim.id)} className="px-6 py-3 rounded-[1.5rem] bg-accent text-white text-[10px] font-black uppercase tracking-[0.4em] italic hover:opacity-90 transition-all">通过</button><button type="button" onClick={() => submit('reject', claim.id)} className="px-6 py-3 rounded-[1.5rem] bg-zinc-100 text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em] italic hover:bg-zinc-200 transition-all">驳回</button><div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-300 group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-all duration-700 shadow-xs"><ChevronRight className="w-5 h-5" /></div></div></td></motion.tr>))}</tbody></table></div></div>
        <AnimatePresence>{selectedClaim && currentClaim && (<div className="fixed inset-0 z-[1000] flex items-center justify-center p-8"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setSelectedClaim(null)} /><AdminPromoClaimDetail claim={currentClaim} index={selectedIndex} total={filtered.length} remark={remark} setRemark={setRemark} remarkProfile={remarkProfile} setRemarkProfile={setRemarkProfile} remarkPresets={promoRemarkPresets} onPrevious={() => void move(-1)} onNext={() => void move(1)} onClose={() => setSelectedClaim(null)} onApprove={(id) => submit('approve', id)} onReject={(id) => submit('reject', id)} /></div>)}</AnimatePresence>
      </StatusWrapper>
    </div>
  );
};

export default AdminPromoClaims;
