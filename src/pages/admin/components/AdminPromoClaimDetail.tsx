import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';

import type { PromoMetrics } from '@/api/promotionApi';
import { promoActionLabels } from '../promoActionLabels';
import { promoUi } from '../promoUi';

interface Props {
  claim: any;
  index: number;
  total: number;
  remark: string;
  setRemark: (value: string) => void;
  remarkProfile: 'pass' | 'reject';
  setRemarkProfile: (value: 'pass' | 'reject') => void;
  remarkPresets: Record<'pass' | 'reject', readonly string[]>;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onRecordMetrics: (id: number, metrics: Partial<PromoMetrics> & { rawSummary?: string }) => void;
  metricsPending: boolean;
  reviewPending: boolean;
}

const metricFields: Array<[keyof PromoMetrics, string]> = [
  ['views', '播放'],
  ['likes', '点赞'],
  ['comments', '评论'],
  ['shares', '分享'],
  ['favorites', '收藏'],
  ['coins', '投币'],
];

const money = (fen: number) => `¥${(Number(fen || 0) / 100).toFixed(2)}`;

const safeUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
};

const emptyMetrics = (): PromoMetrics => ({
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  favorites: 0,
  coins: 0,
});

const AdminPromoClaimDetail: React.FC<Props> = ({
  claim,
  index,
  total,
  remark,
  setRemark,
  remarkProfile,
  setRemarkProfile,
  remarkPresets,
  onPrevious,
  onNext,
  onClose,
  onApprove,
  onReject,
  onRecordMetrics,
  metricsPending,
  reviewPending,
}) => {
  const [metrics, setMetrics] = useState<PromoMetrics>(emptyMetrics);
  const [rawSummary, setRawSummary] = useState('');
  const latestMetrics = claim.latestMetrics ?? claim.metric_snapshots?.[0] ?? null;
  const isTiered = claim.rewardPolicy?.mode === 'POPULAR_VIDEO_TIERED';
  const canRecordMetrics = isTiered && ['VERIFIED', 'REWARDED'].includes(claim.claim_status);
  const canReview = claim.claim_status === 'PENDING';
  const videoUrl = safeUrl(claim.video_url);

  useEffect(() => {
    setMetrics({
      views: Number(latestMetrics?.views ?? 0),
      likes: Number(latestMetrics?.likes ?? 0),
      comments: Number(latestMetrics?.comments ?? 0),
      shares: Number(latestMetrics?.shares ?? 0),
      favorites: Number(latestMetrics?.favorites ?? 0),
      coins: Number(latestMetrics?.coins ?? 0),
    });
    setRawSummary('');
  }, [
    claim.id,
    latestMetrics?.id,
    latestMetrics?.views,
    latestMetrics?.likes,
    latestMetrics?.comments,
    latestMetrics?.shares,
    latestMetrics?.favorites,
    latestMetrics?.coins,
  ]);

  const canSubmitReview = remark.trim().length > 0 && canReview && !reviewPending;

  const setMetric = (key: keyof PromoMetrics, value: string) => {
    setMetrics((current) => ({
      ...current,
      [key]: Math.max(0, Math.trunc(Number(value) || 0)),
    }));
  };

  return (
    <div className={`relative max-h-[92vh] w-full max-w-6xl overflow-y-auto ${promoUi.sectionCard} p-8 sm:p-12 space-y-8`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className={promoUi.headingKicker}>投稿审核与收益结算</div>
          <h3 className="mt-2 text-3xl font-black uppercase italic tracking-tighter">{claim.task?.title || `任务 #${claim.task_id}`}</h3>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase italic tracking-[0.25em]">
            <span className={`${promoUi.chip} bg-zinc-50 border-zinc-100`}>{index + 1} / {total}</span>
            <span className={`${promoUi.chip} bg-amber-50 border-amber-200 text-amber-700`}>{claim.claim_status}</span>
            <span className={`${promoUi.chip} bg-blue-50 border-blue-100 text-blue-700`}>{claim.settlement_status || claim.reward_status}</span>
            {claim.highest_rewarded_tier ? <span className={`${promoUi.chip} bg-emerald-50 border-emerald-100 text-emerald-700`}>档位 {claim.highest_rewarded_tier}</span> : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-accent">关闭</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${promoUi.softCard} p-6 space-y-3`}>
          <div className={promoUi.headingKicker}>投稿视频</div>
          {videoUrl ? <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 break-all text-sm font-black text-accent">打开平台公开视频 <ExternalLink className="h-4 w-4 shrink-0" /></a> : <div className="text-sm text-zinc-400">固定奖励任务或未提交视频链接</div>}
          <div className="font-mono text-xs text-zinc-500 break-all">视频 ID：{claim.platform_video_id || '--'}</div>
          <div className="font-mono text-xs text-zinc-500 break-all">作者 ID：{claim.platform_author_id || claim.platform_user_id || '--'}</div>
        </section>
        <section className={`${promoUi.softCard} p-6 space-y-2`}>
          <div className={promoUi.headingKicker}>任务规则</div>
          <div className="text-sm font-black">{isTiered ? '热门视频分档收益' : '固定奖励'}</div>
          <div className="text-xs text-zinc-500">最高奖励 {money(claim.task?.reward_amount ?? 0)}</div>
          {isTiered ? <div className="text-xs text-zinc-500">观察期 {claim.rewardPolicy.observationHours} 小时 · 按最高档位补差额</div> : null}
        </section>
        <section className={`${promoUi.softCard} p-6 space-y-2`}>
          <div className={promoUi.headingKicker}>累计结算</div>
          <div className="font-mono text-3xl font-black">{money(claim.total_rewarded_amount)}</div>
          <div className="text-xs text-zinc-500">最后指标时间：{claim.last_metric_at ? new Date(claim.last_metric_at).toLocaleString() : '尚无'}</div>
        </section>
      </div>

      {isTiered ? (
        <section className={`${promoUi.softCard} p-6 space-y-5`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className={promoUi.headingKicker}>公开视频指标快照</div>
              <p className="mt-2 text-xs text-zinc-500">新快照不会让已有指标倒退。达到新档位时，系统仅补发累计奖励差额。</p>
            </div>
            <div className="text-xs font-black text-zinc-600">{canRecordMetrics ? '可录入' : '内容审核通过后可录入'}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {metricFields.map(([key, label]) => (
              <label key={key} className="space-y-2">
                <span className="text-xs font-black text-zinc-500">{label}</span>
                <input type="number" min={0} value={metrics[key]} onChange={(event) => setMetric(key, event.target.value)} disabled={!canRecordMetrics || metricsPending} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono outline-none focus:border-accent disabled:bg-zinc-100" />
              </label>
            ))}
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-black text-zinc-500">数据来源或人工核验说明（可选）</span>
            <textarea value={rawSummary} onChange={(event) => setRawSummary(event.target.value)} disabled={!canRecordMetrics || metricsPending} placeholder="填写数据来源或人工核验说明" maxLength={4000} className="min-h-20 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-accent disabled:bg-zinc-100" />
          </label>
          <button type="button" disabled={!canRecordMetrics || metricsPending} onClick={() => onRecordMetrics(claim.id, { ...metrics, rawSummary: rawSummary.trim() || undefined })} className={`${promoUi.actionBtnPrimary} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}>
            {metricsPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            保存快照并计算差额
          </button>
        </section>
      ) : null}

      {isTiered ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className={`${promoUi.softCard} p-6 space-y-3`}>
            <div className={promoUi.headingKicker}>收益档位</div>
            {(claim.rewardPolicy?.tiers ?? []).map((tier: any) => (
              <div key={tier.key} className={`rounded-xl border p-4 ${claim.highest_rewarded_tier === tier.key ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-100 bg-white'}`}>
                <div className="flex items-center justify-between gap-4"><span className="font-black">{tier.name}</span><span className="font-mono font-black">{money(tier.rewardAmount)}</span></div>
                <div className="mt-2 text-xs leading-5 text-zinc-500">播放 {tier.minViews ?? 0} · 点赞 {tier.minLikes ?? 0} · 评论 {tier.minComments ?? 0} · 分享 {tier.minShares ?? 0} · 收藏 {tier.minFavorites ?? 0} · 投币 {tier.minCoins ?? 0}</div>
              </div>
            ))}
            <div className="text-xs font-black text-zinc-600">{claim.evaluation?.qualifiedTier ? `当前数据达到：${claim.evaluation.qualifiedTier.name}` : '当前数据尚未达到首档'}{claim.evaluation?.nextTier ? ` · 下一档：${claim.evaluation.nextTier.name}` : ''}</div>
          </section>
          <section className={`${promoUi.softCard} p-6 space-y-3`}>
            <div className={promoUi.headingKicker}>差额结算记录</div>
            {(claim.reward_settlements ?? []).length === 0 ? <div className="text-xs text-zinc-400">暂无档位结算</div> : (claim.reward_settlements ?? []).map((settlement: any) => (
              <div key={settlement.id} className="rounded-xl border border-zinc-100 bg-white p-4 text-xs">
                <div className="flex items-center justify-between gap-4"><span className="font-black">{settlement.tier_name}</span><span className="font-mono font-black text-emerald-700">本次 +{money(settlement.paid_amount)}</span></div>
                <div className="mt-1 text-zinc-400">累计目标 {money(settlement.target_amount)} · {new Date(settlement.created_at).toLocaleString()}</div>
              </div>
            ))}
          </section>
        </div>
      ) : null}

      <section className={`${promoUi.softCard} p-6 space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={promoUi.headingKicker}>内容与作者审核备注</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRemarkProfile('pass')} className={`rounded-full border px-3 py-2 text-[10px] font-black ${remarkProfile === 'pass' ? 'border-accent bg-accent text-white' : 'border-zinc-200 bg-white'}`}>通过短语</button>
            <button type="button" onClick={() => setRemarkProfile('reject')} className={`rounded-full border px-3 py-2 text-[10px] font-black ${remarkProfile === 'reject' ? 'border-rose-500 bg-rose-500 text-white' : 'border-zinc-200 bg-white'}`}>驳回短语</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {remarkPresets[remarkProfile].map((preset) => <button type="button" key={preset} onClick={() => setRemark(preset)} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-[10px] font-black hover:border-accent">{preset}</button>)}
        </div>
        <textarea required aria-label="推广领取审核备注" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="请输入审核备注，或点击快捷短语自动填充" className="min-h-28 w-full rounded-[1.25rem] border border-zinc-200 bg-white px-5 py-4 text-sm outline-none focus:border-accent" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${promoUi.softCard} p-6 space-y-3`}>
          <div className={promoUi.headingKicker}>指标快照历史</div>
          {(claim.metric_snapshots ?? []).length === 0 ? <div className="text-xs text-zinc-400">暂无快照</div> : (claim.metric_snapshots ?? []).slice(0, 10).map((snapshot: any) => <div key={snapshot.id} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs"><div className="font-black">播放 {snapshot.views} · 点赞 {snapshot.likes}</div><div className="mt-1 text-zinc-400">{new Date(snapshot.captured_at).toLocaleString()} · {snapshot.source}</div></div>)}
        </section>
        <section className={`${promoUi.softCard} p-6 space-y-3`}>
          <div className={promoUi.headingKicker}>钱包流水</div>
          {(claim.walletTransactions ?? []).length === 0 ? <div className="text-xs text-zinc-400">暂无钱包流水</div> : (claim.walletTransactions ?? []).map((transaction: any) => <div key={transaction.id} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs"><div className="font-black">{transaction.change_type} · +{money(transaction.change_amount)}</div><div className="mt-1 font-mono text-zinc-400">{transaction.before_balance} → {transaction.after_balance}</div></div>)}
        </section>
        <section className={`${promoUi.softCard} p-6 space-y-3`}>
          <div className={promoUi.headingKicker}>审核日志</div>
          {(claim.verifyLogs ?? []).length === 0 ? <div className="text-xs text-zinc-400">暂无审核日志</div> : (claim.verifyLogs ?? []).map((log: any) => <div key={log.id} className="rounded-xl border border-zinc-100 bg-white p-3 text-xs"><div className="font-black">{log.verify_status} · {log.source}</div><div className="mt-1 break-all text-zinc-400">{log.error_message || log.response_data}</div></div>)}
        </section>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onPrevious} className={`${promoUi.actionBtn} flex items-center gap-2`}><ChevronLeft className="h-4 w-4" />上一条</button>
          <button type="button" onClick={onNext} className={`${promoUi.actionBtn} flex items-center gap-2`}>下一条<ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onClose} className={`${promoUi.actionBtn} px-8 py-4`}>关闭</button>
          <button type="button" onClick={() => onApprove(claim.id)} disabled={!canSubmitReview} className={`${promoUi.actionBtnPrimary} disabled:cursor-not-allowed disabled:opacity-40`}>{isTiered ? '审核通过并进入监测' : promoActionLabels.approve}</button>
          <button type="button" onClick={() => onReject(claim.id)} disabled={!canSubmitReview} className="rounded-[1rem] bg-zinc-900 px-5 py-3 text-[10px] font-black uppercase text-white disabled:cursor-not-allowed disabled:opacity-40">{promoActionLabels.reject}</button>
        </div>
      </div>
    </div>
  );
};

export default AdminPromoClaimDetail;
