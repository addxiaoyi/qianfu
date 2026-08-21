import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText } from '@/utils/clipboard';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Clock3,
  ExternalLink,
  Gift,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldQuestion,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import {
  parsePromoRewardPolicy,
  promotionApi,
  type PromoBinding,
  type PromoClaim,
  type PromoRewardTier,
  type PromoTask,
} from '@/api/promotionApi';
import CustomSelect from '@/components/ui/CustomSelect';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { toast } from '@/hooks/use-toast';
import {
  PROMO_PLATFORMS,
  getPromoPlatform,
  getPromoPlatformLabel,
  validatePromoPlatformUserId,
  type PromoPlatformId,
} from '@/lib/promoPlatforms';

const money = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

const CLAIM_STATUS_LABELS: Record<string, string> = {
  PENDING: '审核中',
  APPROVED: '已通过',
  VERIFIED: '已校验',
  REWARDED: '已结算',
  REJECTED: '已驳回',
  FAILED: '处理失败',
};

const REWARD_STATUS_LABELS: Record<string, string> = {
  PENDING: '待结算',
  REWARDING: '结算中',
  REWARDED: '已结算',
  FAILED: '结算失败',
};

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  AWAITING_REVIEW: '待审核',
  MONITORING: '数据监测中',
  COMPLETED: '最高档已完成',
};

const TIER_THRESHOLD_LABELS: Array<[keyof PromoRewardTier, string]> = [
  ['minViews', '播放'],
  ['minLikes', '点赞'],
  ['minComments', '评论'],
  ['minShares', '分享'],
  ['minFavorites', '收藏'],
  ['minCoins', '投币'],
];

const formatTierThresholds = (tier: PromoRewardTier): string => (
  TIER_THRESHOLD_LABELS.flatMap(([key, label]) => {
    const value = tier[key];
    return typeof value === 'number' ? [`${label} ≥ ${value.toLocaleString()}`] : [];
  }).join(' · ')
);

const getClaimPaidAmount = (claim: PromoClaim): number => {
  if (claim.total_rewarded_amount > 0) return claim.total_rewarded_amount;
  const policy = parsePromoRewardPolicy(claim.task?.rule_config, claim.task?.reward_amount ?? 0);
  return claim.reward_status === 'REWARDED' && policy.mode === 'LEGACY_FIXED'
    ? policy.rewardAmount
    : 0;
};

const getSafeTaskTargetUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
};

const getBindingStatus = (binding: PromoBinding) => {
  if (binding.binding_status === 'VERIFIED' && binding.verified_at) {
    return {
      label: '已验证',
      description: '服务器已从公开页面检测到验证码，可用于领取对应平台任务。',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: ShieldCheck,
    };
  }
  if (binding.binding_status === 'REJECTED') {
    return {
      label: '验证失败',
      description: '账号标识已保存，但所有权验证未通过，请重新检查公开页面。',
      className: 'border-red-200 bg-red-50 text-red-700',
      icon: AlertCircle,
    };
  }
  return {
    label: '待验证',
    description: '仅保存账号标识不代表拥有该账号，完成公开验证码检测后才会生效。',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: ShieldQuestion,
  };
};

const PromotionLanding = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'claims' ? 'claims' : 'tasks';
  const setTab = (next: 'tasks' | 'claims') => setSearchParams(next === 'claims' ? { tab: 'claims' } : {}, { replace: true });
  const [binding, setBinding] = useState<{
    platform: PromoPlatformId;
    platformUserId: string;
    platformUsername: string;
  }>({ platform: 'bilibili', platformUserId: '', platformUsername: '' });
  const [verificationUrls, setVerificationUrls] = useState<Record<number, string>>({});
  const [claimTask, setClaimTask] = useState<PromoTask | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [claimKey, setClaimKey] = useState('');
  const [progressClaimId, setProgressClaimId] = useState<number | null>(null);
  const claimDialogRef = useRef<HTMLDivElement>(null);
  const claimTriggerRef = useRef<HTMLElement | null>(null);

  const selectedPlatform = getPromoPlatform(binding.platform);
  const platformOptions = useMemo(() => PROMO_PLATFORMS.map((platform) => ({
    value: platform.value,
    label: platform.label,
    description: platform.description,
  })), []);

  const closeClaim = () => {
    setClaimTask(null);
    requestAnimationFrame(() => claimTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!claimTask) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeClaim();
        return;
      }
      if (event.key !== 'Tab' || !claimDialogRef.current) return;
      const focusable = Array.from(claimDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => claimDialogRef.current?.querySelector<HTMLElement>('input, textarea, button')?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [claimTask]);

  const tasksQuery = useQuery({ queryKey: ['promo-tasks'], queryFn: promotionApi.listTasks });
  const bindingsQuery = useQuery({ queryKey: ['promo-bindings'], queryFn: promotionApi.listBindings });
  const claimsQuery = useQuery({ queryKey: ['promo-claims'], queryFn: promotionApi.listClaims });
  const progressQuery = useQuery({
    queryKey: ['promo-claim-progress', progressClaimId],
    queryFn: () => promotionApi.getClaimProgress(progressClaimId as number),
    enabled: progressClaimId !== null,
  });
  const taskData = tasksQuery.data?.data;
  const bindingData = bindingsQuery.data;
  const claimData = claimsQuery.data;
  const tasks = useMemo(() => taskData ?? [], [taskData]);
  const bindings = useMemo(() => (Array.isArray(bindingData) ? bindingData : []), [bindingData]);
  const claims = useMemo(() => (Array.isArray(claimData) ? claimData : []), [claimData]);

  const summary = useMemo(() => ({
    available: tasks.filter((task) => task.bound && task.reward_status !== 'REWARDED').length,
    pending: claims.filter((claim) => claim.claim_status === 'PENDING').length,
    rewarded: claims.filter((claim) => claim.reward_status === 'REWARDED').length,
    rewards: claims.reduce((sum, claim) => sum + getClaimPaidAmount(claim), 0),
  }), [claims, tasks]);

  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['promo-tasks'] }),
    queryClient.invalidateQueries({ queryKey: ['promo-bindings'] }),
    queryClient.invalidateQueries({ queryKey: ['promo-claims'] }),
  ]);

  const bindMutation = useMutation({
    mutationFn: promotionApi.bind,
    onSuccess: async () => {
      await refresh();
      setBinding((value) => ({ ...value, platformUserId: '', platformUsername: '' }));
      toast({ title: '账号标识已保存', description: '当前仍是待验证状态，请继续完成公开验证码检测。' });
    },
    onError: (error: unknown) => toast({
      variant: 'destructive',
      title: '保存失败',
      description: error instanceof Error ? error.message : '请检查账号信息后重试。',
    }),
  });

  const verifyBindingMutation = useMutation({
    mutationFn: ({ bindingId, publicUrl }: { bindingId: number; publicUrl: string }) => (
      promotionApi.verifyBinding(bindingId, publicUrl)
    ),
    onSuccess: async () => {
      await refresh();
      toast({ title: '账号所有权验证通过', description: '公开页面已检测到验证码，对应平台任务现在可以领取。' });
    },
    onError: (error: unknown) => toast({
      variant: 'destructive',
      title: '未检测到验证码',
      description: error instanceof Error ? error.message : '请确认页面公开且验证码已经保存。',
    }),
  });

  const claimMutation = useMutation({
    mutationFn: ({ task, key }: { task: PromoTask; key: string }) => {
      const policy = parsePromoRewardPolicy(task.rule_config, task.reward_amount);
      return promotionApi.claim({
        taskId: task.id,
        proofData: policy.mode === 'POPULAR_VIDEO_TIERED'
          ? { videoUrl: proofUrl.trim(), note: proofNote.trim() || undefined }
          : { url: proofUrl.trim() || undefined, note: proofNote.trim() || undefined },
      }, key);
    },
    onSuccess: async () => {
      await refresh();
      closeClaim();
      toast({ title: '投稿已提交', description: '热门视频会先审核内容与作者，再根据数据档位按差额结算。' });
    },
    onError: (error: unknown) => toast({
      variant: 'destructive',
      title: '证明提交失败',
      description: error instanceof Error ? error.message : '请稍后重试。',
    }),
  });

  const submitBinding = () => {
    const validationError = validatePromoPlatformUserId(binding.platform, binding.platformUserId);
    if (validationError) {
      toast({ variant: 'destructive', title: '账号标识不正确', description: validationError });
      return;
    }
    bindMutation.mutate({
      platform: binding.platform,
      platformUserId: binding.platformUserId.trim(),
      platformUsername: binding.platformUsername.trim() || undefined,
    });
  };

  const copyChallenge = async (code: string) => {
    try {
      await copyText(code);
      toast({ title: '验证码已复制', description: '请把验证码完整放入平台公开资料中。' });
    } catch {
      toast({ variant: 'destructive', title: '复制失败', description: '请手动选择并复制验证码。' });
    }
  };

  const runBindingVerification = (item: PromoBinding) => {
    const publicUrl = verificationUrls[item.id]?.trim() || '';
    if (!publicUrl) {
      toast({ variant: 'destructive', title: '请填写公开页面链接', description: '链接必须属于当前选择的平台，并且无需登录即可访问。' });
      return;
    }
    verifyBindingMutation.mutate({ bindingId: item.id, publicUrl });
  };

  const openClaim = (task: PromoTask) => {
    claimTriggerRef.current = document.activeElement as HTMLElement | null;
    setClaimTask(task);
    setProofUrl('');
    setProofNote('');
    setClaimKey(crypto.randomUUID());
  };

  const submitClaim = () => {
    if (!claimTask) return;
    const policy = parsePromoRewardPolicy(claimTask.rule_config, claimTask.reward_amount);
    if (policy.mode === 'POPULAR_VIDEO_TIERED' && !proofUrl.trim()) {
      toast({ variant: 'destructive', title: '请填写公开视频链接', description: '链接必须属于任务指定的平台，并且可公开访问。' });
      return;
    }
    if (policy.mode === 'LEGACY_FIXED' && !proofUrl.trim() && !proofNote.trim()) {
      toast({ variant: 'destructive', title: '请填写证明', description: '提供证明链接或简要说明。' });
      return;
    }
    claimMutation.mutate({ task: claimTask, key: claimKey });
  };

  const claimPolicy = claimTask
    ? parsePromoRewardPolicy(claimTask.rule_config, claimTask.reward_amount)
    : null;

  const isLoading = tasksQuery.isLoading || bindingsQuery.isLoading || claimsQuery.isLoading;
  const isError = tasksQuery.isError || bindingsQuery.isError || claimsQuery.isError;
  const summaryCards: Array<{ label: string; value: string | number; Icon: LucideIcon }> = [
    { label: '可领取', value: summary.available, Icon: Gift },
    { label: '审核中', value: summary.pending, Icon: Clock3 },
    { label: '已结算', value: summary.rewarded, Icon: CheckCircle2 },
    { label: '累计奖励', value: money(summary.rewards), Icon: Gift },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 sm:text-3xl">推广任务中心</h1>
            <p className="mt-2 text-sm text-zinc-500">绑定平台账号、完成所有权验证，再提交真实任务证明。</p>
          </div>
          <div role="tablist" aria-label="推广任务视图" className="inline-flex w-fit rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
            <button type="button" role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === 'tasks' ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>可领取任务</button>
            <button type="button" role="tab" aria-selected={tab === 'claims'} onClick={() => setTab('claims')} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === 'claims' ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>领取记录</button>
          </div>
        </header>

        <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => void refresh()}>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {summaryCards.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
                <Icon className="mb-3 h-5 w-5 text-zinc-400" />
                <div className="text-xl font-black sm:text-2xl">{value}</div>
                <div className="mt-1 text-xs text-zinc-500">{label}</div>
              </div>
            ))}
          </section>

          {tab === 'tasks' ? (
            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(360px,420px)_1fr]">
              <aside className="space-y-4">
                <div>
                  <h2 className="text-lg font-black">平台账号绑定</h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">保存账号后仍需验证所有权。未经验证的账号不能领取对应平台任务。</p>
                </div>

                <div className="space-y-4 rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="space-y-2">
                    <label htmlFor="promo-platform" className="text-xs font-bold text-zinc-600">平台</label>
                    <CustomSelect
                      id="promo-platform"
                      name="platform"
                      ariaLabel="选择推广平台"
                      value={binding.platform}
                      options={platformOptions}
                      onChange={(platform) => setBinding((current) => ({ ...current, platform, platformUserId: '' }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="promo-user-id" className="text-xs font-bold text-zinc-600">{selectedPlatform.idLabel}</label>
                    <input
                      id="promo-user-id"
                      name="platformUserId"
                      autoComplete="off"
                      spellCheck={false}
                      value={binding.platformUserId}
                      onChange={(event) => setBinding({ ...binding, platformUserId: event.target.value })}
                      placeholder={selectedPlatform.idPlaceholder}
                      maxLength={128}
                      className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                    />
                    <p className="text-[11px] leading-5 text-zinc-400">{selectedPlatform.description}</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="promo-username" className="text-xs font-bold text-zinc-600">平台展示名称（可选）</label>
                    <input
                      id="promo-username"
                      name="platformUsername"
                      autoComplete="off"
                      spellCheck={false}
                      value={binding.platformUsername}
                      onChange={(event) => setBinding({ ...binding, platformUsername: event.target.value })}
                      placeholder="例如：千服联灯"
                      maxLength={128}
                      className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!binding.platformUserId.trim() || bindMutation.isPending}
                    onClick={submitBinding}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-black text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {bindMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    保存并生成验证码
                  </button>
                </div>

                <div className="space-y-3">
                  {bindings.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-500">
                      尚未保存平台账号。
                    </div>
                  ) : bindings.map((item) => {
                    const status = getBindingStatus(item);
                    const StatusIcon = status.icon;
                    const isVerified = item.binding_status === 'VERIFIED' && Boolean(item.verified_at);
                    const verificationPending = verifyBindingMutation.isPending
                      && verifyBindingMutation.variables?.bindingId === item.id;
                    return (
                      <section key={item.id} className="space-y-4 rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-black text-zinc-950">{getPromoPlatformLabel(item.platform)}</div>
                            <div className="mt-1 truncate text-xs text-zinc-500">
                              {item.platform_username || '未填写展示名称'} · {item.platform_user_id}
                            </div>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${status.className}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {status.label}
                          </span>
                        </div>

                        <p className="text-xs leading-5 text-zinc-500">{status.description}</p>

                        {!isVerified ? (
                          <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">公开验证码</div>
                              <div className="mt-2 flex items-center gap-2">
                                <code className="min-w-0 flex-1 select-all break-all rounded-xl bg-white px-3 py-2 text-xs font-black text-zinc-800 ring-1 ring-zinc-200">
                                  {item.verification_code}
                                </code>
                                <button type="button" aria-label="复制验证码" onClick={() => void copyChallenge(item.verification_code)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-black hover:text-black">
                                  <Clipboard className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <p id={`promo-binding-verification-hint-${item.id}`} className="text-[11px] leading-5 text-zinc-500">{getPromoPlatform(item.platform).verificationHint}</p>
                            <label className="block space-y-2">
                              <span className="text-[11px] font-black text-zinc-600">{getPromoPlatformLabel(item.platform)}公开页面链接</span>
                              <input
                                type="url"
                                inputMode="url"
                                autoComplete="off"
                                value={verificationUrls[item.id] || ''}
                                onChange={(event) => setVerificationUrls((current) => ({ ...current, [item.id]: event.target.value }))}
                                aria-describedby={`promo-binding-verification-hint-${item.id}`}
                                placeholder="粘贴含验证码的公开页面链接"
                                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none transition focus:border-black focus:ring-4 focus:ring-black/5"
                              />
                            </label>
                            <button
                              type="button"
                              disabled={verificationPending}
                              onClick={() => runBindingVerification(item)}
                              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-xs font-black text-white transition hover:bg-black disabled:opacity-50"
                            >
                              {verificationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                              检测公开页面
                            </button>
                            <p className="text-[10px] leading-4 text-zinc-400">部分平台会阻止服务器抓取页面；这种情况下检测会明确失败，不会伪造“已验证”。</p>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                            验证时间：{item.verified_at ? new Date(item.verified_at).toLocaleString() : '已验证'}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </aside>

              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-black">当前任务</h2>
                  <p className="mt-1 text-xs text-zinc-500">任务平台会与已验证绑定自动匹配。</p>
                </div>
                {tasks.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">暂无可见任务</div>
                ) : tasks.map((task) => {
                  const policy = parsePromoRewardPolicy(task.rule_config, task.reward_amount);
                  const tiered = policy.mode === 'POPULAR_VIDEO_TIERED';
                  const safeTargetUrl = getSafeTaskTargetUrl(task.target_url);
                  const claimedLabel = task.claim_status === 'PENDING'
                    ? '审核中'
                    : task.claim_status === 'VERIFIED'
                      ? '数据监测中'
                      : task.reward_status === 'REWARDED'
                        ? '已投稿'
                        : '已提交';
                  return (
                    <article key={task.id} className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-400">
                            <span>{getPromoPlatformLabel(task.platform)}</span>
                            {tiered ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">热门视频分档</span> : null}
                          </div>
                          <h3 className="mt-2 text-lg font-black">{task.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-zinc-500">{task.description || (tiered ? '发布符合要求的公开视频，按真实数据达到的最高档位结算。' : '按任务要求完成操作并提交证明。')}</p>
                          {safeTargetUrl && <a href={safeTargetUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-zinc-700 hover:text-black">
                            查看任务要求 <ExternalLink className="h-3 w-3" />
                          </a>}
                          {tiered ? (
                            <div className="mt-4 space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                              <div className="text-xs font-black text-zinc-700">数据观察期 {policy.observationHours} 小时 · 达到更高档位仅补发差额</div>
                              {policy.tiers.map((tier) => (
                                <div key={tier.key} className="flex flex-col gap-1 rounded-xl bg-white px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                                  <span className="font-black text-zinc-800">{tier.name} · {money(tier.rewardAmount)}</span>
                                  <span className="text-zinc-500">{formatTierThresholds(tier)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
                          <div className="text-right">
                            <div className="text-xl font-black">{money(task.reward_amount)}</div>
                            <div className="text-xs text-zinc-400">{tiered ? '最高可得' : '单次奖励'}</div>
                          </div>
                          <button
                            type="button"
                            disabled={!task.bound || task.claimed}
                            onClick={() => openClaim(task)}
                            className="h-11 rounded-xl bg-black px-4 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                          >
                            {!task.bound ? '先完成账号验证' : task.claimed ? claimedLabel : tiered ? '投稿视频' : '提交证明'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            </div>
          ) : (
            <section className="mt-6 space-y-3">
              {claims.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">暂无领取记录</div>
              ) : claims.map((claim) => {
                const expanded = progressClaimId === claim.id;
                const progress = expanded ? progressQuery.data : undefined;
                const videoUrl = getSafeTaskTargetUrl(claim.video_url);
                return (
                  <article key={claim.id} className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-black">{claim.task?.title || `任务 #${claim.task_id}`} · 第 {claim.claim_no} 次</div>
                        <div className="mt-1 text-xs text-zinc-500">{new Date(claim.claim_at).toLocaleString()}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{CLAIM_STATUS_LABELS[claim.claim_status] || claim.claim_status}</span>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{SETTLEMENT_STATUS_LABELS[claim.settlement_status] || REWARD_STATUS_LABELS[claim.reward_status] || claim.reward_status}</span>
                          {claim.highest_rewarded_tier ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">当前档位：{claim.highest_rewarded_tier}</span> : null}
                        </div>
                        {(claim.audit_note || claim.failed_reason) ? <p className="mt-2 text-sm text-red-600">{claim.audit_note || claim.failed_reason}</p> : null}
                        {videoUrl ? <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-zinc-600 hover:text-black">查看投稿视频 <ExternalLink className="h-3 w-3" /></a> : null}
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                        <div className="text-right">
                          <div className="text-xl font-black">{money(getClaimPaidAmount(claim))}</div>
                          <div className="text-xs text-zinc-400">累计已结算</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProgressClaimId(expanded ? null : claim.id)}
                          className="h-10 rounded-xl border border-zinc-200 px-3 text-xs font-black text-zinc-700 hover:border-black"
                        >
                          {expanded ? '收起进度' : '查看进度'}
                        </button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-5 border-t border-zinc-100 pt-5">
                        {progressQuery.isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />正在加载数据快照…</div>
                        ) : progressQuery.isError || !progress ? (
                          <div className="text-sm text-red-600">收益进度加载失败，请稍后重试。</div>
                        ) : (
                          <div className="space-y-4">
                            {progress.latestMetrics ? (
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                                {[
                                  ['播放', progress.latestMetrics.views],
                                  ['点赞', progress.latestMetrics.likes],
                                  ['评论', progress.latestMetrics.comments],
                                  ['分享', progress.latestMetrics.shares],
                                  ['收藏', progress.latestMetrics.favorites],
                                  ['投币', progress.latestMetrics.coins],
                                ].map(([label, value]) => (
                                  <div key={String(label)} className="rounded-xl bg-zinc-50 px-3 py-2 text-center">
                                    <div className="font-black">{Number(value).toLocaleString()}</div>
                                    <div className="text-[10px] text-zinc-400">{label}</div>
                                  </div>
                                ))}
                              </div>
                            ) : <div className="text-sm text-zinc-500">尚未录入公开视频数据。</div>}

                            {progress.policy.mode === 'POPULAR_VIDEO_TIERED' ? (
                              <div className="space-y-2">
                                <div className="text-xs font-black text-zinc-700">
                                  {progress.evaluation?.qualifiedTier ? `已达到：${progress.evaluation.qualifiedTier.name}` : '尚未达到首档'}
                                  {progress.evaluation?.nextTier ? ` · 下一档：${progress.evaluation.nextTier.name}` : ' · 已到最高档'}
                                </div>
                                {progress.policy.tiers.map((tier) => (
                                  <div key={tier.key} className={`rounded-xl border px-3 py-2 text-xs ${claim.highest_rewarded_tier === tier.key ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-100 bg-white'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-black">{tier.name}</span>
                                      <span className="font-black">{money(tier.rewardAmount)}</span>
                                    </div>
                                    <div className="mt-1 text-zinc-500">{formatTierThresholds(tier)}</div>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {progress.claim.reward_settlements.length > 0 ? (
                              <div className="space-y-2">
                                <div className="text-xs font-black text-zinc-700">结算记录</div>
                                {progress.claim.reward_settlements.map((settlement) => (
                                  <div key={settlement.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs">
                                    <span>{settlement.tier_name}</span>
                                    <span className="font-black">本次到账 {money(settlement.paid_amount)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>
          )}
        </StatusWrapper>
      </div>

      {claimTask ? (
        <div role="dialog" aria-modal="true" aria-labelledby="claim-title" className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto overscroll-contain bg-black/50 p-0 sm:items-center sm:p-6">
          <div ref={claimDialogRef} className="w-full max-w-lg rounded-t-[1.75rem] bg-white p-6 sm:rounded-[1.75rem]">
            <div className="flex items-center justify-between">
              <h2 id="claim-title" className="text-xl font-black">{claimPolicy?.mode === 'POPULAR_VIDEO_TIERED' ? '投稿公开视频' : '提交任务证明'}</h2>
              <button type="button" onClick={closeClaim} aria-label="关闭" className="rounded-xl p-2 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {claimPolicy?.mode === 'POPULAR_VIDEO_TIERED'
                ? `管理员先核对内容和作者；通过后监测 ${claimPolicy.observationHours} 小时，达到更高档位时只补发差额。`
                : '提交后进入人工审核，审核通过后发放固定奖励。'}
            </p>
            <div className="mt-5 space-y-3">
              <label htmlFor="proof-url" className="text-xs font-bold text-zinc-600">{claimPolicy?.mode === 'POPULAR_VIDEO_TIERED' ? '平台公开视频链接（必填）' : '证明链接（可选）'}</label>
              <input id="proof-url" name="proofUrl" type="url" inputMode="url" autoComplete="off" value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} placeholder={claimPolicy?.mode === 'POPULAR_VIDEO_TIERED' ? '粘贴当前任务平台的视频链接' : 'https://example.com/proof…'} maxLength={2048} className="h-11 w-full rounded-xl border border-zinc-200 px-3 outline-none focus:border-black" />
              <label htmlFor="proof-note" className="text-xs font-bold text-zinc-600">投稿说明（可选）</label>
              <textarea id="proof-note" name="proofNote" value={proofNote} onChange={(event) => setProofNote(event.target.value)} placeholder={claimPolicy?.mode === 'POPULAR_VIDEO_TIERED' ? '可填写发布时间、内容说明或需要审核员注意的信息…' : '简要说明完成情况…'} maxLength={2000} rows={5} className="w-full resize-none rounded-xl border border-zinc-200 p-3 outline-none focus:border-black" />
              <button type="button" disabled={claimMutation.isPending} onClick={submitClaim} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white disabled:opacity-40">
                {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {claimPolicy?.mode === 'POPULAR_VIDEO_TIERED' ? '提交视频审核' : '提交审核'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default PromotionLanding;
