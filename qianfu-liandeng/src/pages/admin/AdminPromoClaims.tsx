import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, ExternalLink } from 'lucide-react';

import { promotionApi, type PromoMetrics } from '@/api/promotionApi';
import { api } from '@/api/request';
import AdminPageHeader from '@/components/ui/AdminPageHeader';
import AdminStatCard from '@/components/ui/AdminStatCard';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { toast } from '@/hooks/use-toast';
import AdminPromoClaimDetail from './components/AdminPromoClaimDetail';
import { promoRemarkPresets } from './promoRemarkConfig';

const money = (fen: number) => `¥${(Number(fen || 0) / 100).toFixed(2)}`;

const getSafeUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
};

const AdminPromoClaims: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'verified' | 'rewarded' | 'rejected'>('all');
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remark, setRemark] = useState('');
  const [remarkProfile, setRemarkProfile] = useState<'pass' | 'reject'>('pass');

  const claimsQuery = useQuery({
    queryKey: ['admin-promo-claims'],
    queryFn: () => api.get<{ data: any[] }>('/promo/admin/claims'),
  });
  const claims = useMemo(
    () => (Array.isArray(claimsQuery.data?.data) ? claimsQuery.data.data : []) as unknown[],
    [claimsQuery.data],
  );
  const filtered = useMemo(
    () => claims.filter((claim) => activeTab === 'all' || String(claim.claim_status || '').toLowerCase() === activeTab),
    [activeTab, claims],
  );
  const currentClaim = selectedClaim ?? filtered[selectedIndex];

  useEffect(() => {
    setSelectedIndex(0);
    setSelectedClaim(null);
  }, [activeTab]);

  const loadDetail = async (claimId: number) => {
    const response = await api.get<any>(`/promo/claims/${claimId}/detail`);
    return response?.data ?? response;
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, remark: value }: { id: number; remark: string }) => (
      api.post(`/promo/claims/${id}/approve`, { remark: value })
    ),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-promo-claims'] });
      setSelectedClaim(await loadDetail(variables.id));
      toast({ title: '审核完成', description: '固定任务已发放奖励；热门视频已进入数据监测。' });
    },
    onError: () => toast({ variant: 'destructive', title: '审核失败', description: '投稿审核未能通过，请稍后重试。' }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, remark: value }: { id: number; remark: string }) => (
      api.post(`/promo/claims/${id}/reject`, { remark: value })
    ),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-promo-claims'] });
      setSelectedClaim(await loadDetail(variables.id));
      toast({ title: '投稿已驳回', description: '驳回原因已记录。' });
    },
    onError: () => toast({ variant: 'destructive', title: '驳回失败', description: '投稿记录未能驳回，请稍后重试。' }),
  });

  const metricMutation = useMutation({
    mutationFn: ({ id, metrics }: { id: number; metrics: Partial<PromoMetrics> & { rawSummary?: string } }) => (
      promotionApi.recordMetrics(id, { ...metrics, source: 'MANUAL' })
    ),
    onSuccess: async (result: any, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-promo-claims'] });
      setSelectedClaim(await loadDetail(variables.id));
      const paidAmount = Number(result?.paidAmount ?? result?.data?.paidAmount ?? 0);
      toast({
        title: paidAmount > 0 ? '指标已保存并完成差额结算' : '指标快照已保存',
        description: paidAmount > 0 ? `本次补发 ${money(paidAmount)}。` : '当前数据未产生新的档位差额。',
      });
    },
    onError: (error: unknown) => toast({
      variant: 'destructive',
      title: '指标保存失败',
      description: error instanceof Error ? error.message : '请检查投稿状态和指标数据。',
    }),
  });

  const stats = [
    { label: '投稿总数', value: String(claims.length), variant: 'network' as const, color: 'text-green-500', trend: '视频与固定任务', tag: 'PC_01' },
    { label: '待审核', value: String(claims.filter((claim) => claim.claim_status === 'PENDING').length), variant: 'security' as const, color: 'text-orange-500', trend: '人工确认', tag: 'PC_02' },
    { label: '监测中', value: String(claims.filter((claim) => claim.settlement_status === 'MONITORING').length), variant: 'spark' as const, color: 'text-blue-500', trend: '等待更高档位', tag: 'PC_03' },
    { label: '累计结算', value: money(claims.reduce((sum, claim) => sum + Number(claim.total_rewarded_amount || 0), 0)), variant: 'payment' as const, color: 'text-emerald-500', trend: '档位差额', tag: 'PC_04' },
  ];

  const openDetail = async (claim: any, index: number) => {
    setSelectedIndex(index);
    setRemark('');
    setRemarkProfile('pass');
    try {
      setSelectedClaim(await loadDetail(claim.id));
    } catch {
      toast({ variant: 'destructive', title: '详情加载失败', description: '暂时无法读取投稿详情，请稍后重试。' });
    }
  };

  const move = async (delta: number) => {
    const next = selectedIndex + delta;
    if (next < 0 || next >= filtered.length) return;
    await openDetail(filtered[next], next);
  };

  const submitReview = (mode: 'approve' | 'reject', id: number) => {
    if (!remark.trim()) {
      toast({ variant: 'destructive', title: '请填写审核备注', description: '请输入审核备注或选择快捷短语。' });
      return;
    }
    (mode === 'approve' ? approveMutation : rejectMutation).mutate({ id, remark: remark.trim() });
  };

  return (
    <div className="space-y-16 bg-white pb-32 selection:bg-accent selection:text-white">
      <StatusWrapper isLoading={claimsQuery.isLoading} isError={claimsQuery.isError} onRetry={() => claimsQuery.refetch()}>
        <AdminPageHeader
          badge="推广投稿 / 审核与结算"
          title="投稿审核"
          description="审核内容与作者，录入公开视频数据，并按达到的最高档位自动补发差额。"
          statusLabel="审核结算面板已就绪"
        />

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <AdminStatCard key={stat.tag} tag={stat.tag} value={stat.value} label={stat.label} variant={stat.variant} colorClassName={stat.color} trend={stat.trend} delay={index * 0.08} />
          ))}
        </div>

        <div className="flex w-full gap-16 overflow-x-auto border-t border-zinc-50 pt-12 no-scrollbar">
          {([
            { id: 'all', label: '全部' },
            { id: 'pending', label: '待审核' },
            { id: 'verified', label: '已校验' },
            { id: 'rewarded', label: '已结算' },
            { id: 'rejected', label: '已驳回' },
          ] as const).map((item) => (
            <button type="button" key={item.id} onClick={() => setActiveTab(item.id)} className={`group relative flex flex-col items-start gap-3 pb-10 transition-all ${activeTab === item.id ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
              <span className="text-[12px] font-black uppercase italic tracking-[0.4em]">{item.label}</span>
              <span className="font-mono text-[9px] font-black tracking-widest text-zinc-400">/ {item.id.toUpperCase()}</span>
              {activeTab === item.id ? <motion.div layoutId="promo-claims-tab" className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent" /> : null}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[5rem] border border-zinc-50 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  {['用户', '任务与视频', '审核 / 监测', '已结算 / 上限', '操作'].map((label) => (
                    <th key={label} className="px-12 py-8 text-[10px] font-black uppercase italic tracking-[0.4em] text-zinc-300">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-32 text-center font-black uppercase italic tracking-[0.5em] text-zinc-300">当前没有投稿记录。</td></tr>
                ) : filtered.map((claim, index) => {
                  const videoUrl = getSafeUrl(claim.video_url);
                  const latestMetrics = claim.metric_snapshots?.[0];
                  return (
                    <motion.tr key={claim.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="group hover:bg-zinc-50/50">
                      <td className="px-12 py-10"><div className="font-black">UID {claim.user_id}</div><div className="mt-1 font-mono text-[10px] text-zinc-400">{claim.platform_user_id}</div></td>
                      <td className="px-12 py-10"><div className="font-black">{claim.task?.title || `任务 #${claim.task_id}`}</div><div className="mt-1 text-xs text-zinc-500">{claim.task?.platform}</div>{videoUrl ? <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent">查看视频 <ExternalLink className="h-3 w-3" /></a> : null}</td>
                      <td className="px-12 py-10"><div className="text-xs font-black">{claim.claim_status} / {claim.settlement_status}</div><div className="mt-2 text-xs text-zinc-400">{latestMetrics ? `播放 ${Number(latestMetrics.views).toLocaleString()} · 点赞 ${Number(latestMetrics.likes).toLocaleString()}` : '暂无指标快照'}</div></td>
                      <td className="px-12 py-10"><div className="font-mono text-xl font-black">{money(claim.total_rewarded_amount)}</div><div className="mt-1 text-xs text-zinc-400">最高 {money(claim.task?.reward_amount ?? 0)}</div></td>
                      <td className="px-12 py-10"><button type="button" onClick={() => void openDetail(claim, index)} className="inline-flex items-center gap-2 rounded-[1rem] border border-zinc-100 bg-white px-4 py-2 text-[10px] font-black uppercase italic tracking-[0.3em] hover:border-accent">审核与结算 <ChevronRight className="h-4 w-4" /></button></td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <AnimatePresence>
          {selectedClaim && currentClaim ? (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setSelectedClaim(null)} />
              <AdminPromoClaimDetail
                claim={currentClaim}
                index={selectedIndex}
                total={filtered.length}
                remark={remark}
                setRemark={setRemark}
                remarkProfile={remarkProfile}
                setRemarkProfile={setRemarkProfile}
                remarkPresets={promoRemarkPresets}
                onPrevious={() => void move(-1)}
                onNext={() => void move(1)}
                onClose={() => setSelectedClaim(null)}
                onApprove={(id) => submitReview('approve', id)}
                onReject={(id) => submitReview('reject', id)}
                onRecordMetrics={(id, metrics) => metricMutation.mutate({ id, metrics })}
                metricsPending={metricMutation.isPending}
                reviewPending={approveMutation.isPending || rejectMutation.isPending}
              />
            </div>
          ) : null}
        </AnimatePresence>
      </StatusWrapper>
    </div>
  );
};

export default AdminPromoClaims;
