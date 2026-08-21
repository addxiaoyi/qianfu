import { safeJsonParse } from '@/utils/json';
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/request";
import { parsePromoRewardPolicy, type PromoRewardTier } from "@/api/promotionApi";
import StatusWrapper from "@/components/ui/StatusWrapper";
import AdminPageHeader from "@/components/ui/AdminPageHeader";
import { toast } from "@/hooks/use-toast";
import GeometricLantern from "@/components/ui/GeometricLantern";
import { isUrlSafe, isImageUrlSafe } from "@/utils/urlValidator";

const defaultRule = {
  actions: {
    like: true,
    coin: true,
    favorite: true,
    follow: false,
    share: false,
  },
  condition: "all_required",
};

const defaultTieredRule = {
  mode: "POPULAR_VIDEO_TIERED",
  observationHours: 168,
  settlementMode: "HIGHEST_TIER_DIFF",
  contentRequirements: {
    keywords: [] as string[],
    hashtags: [] as string[],
    disclosureRequired: true,
  },
  tiers: [
    { key: "starter", name: "基础热度", rewardAmount: 500, minViews: 1000 },
    { key: "popular", name: "热门作品", rewardAmount: 1500, minViews: 10000, minLikes: 300 },
    { key: "viral", name: "爆款作品", rewardAmount: 5000, minViews: 100000, minLikes: 3000 },
  ],
};

const tierMetricFields: Array<[keyof PromoRewardTier, string]> = [
  ["minViews", "最低播放"],
  ["minLikes", "最低点赞"],
  ["minComments", "最低评论"],
  ["minShares", "最低分享"],
  ["minFavorites", "最低收藏"],
  ["minCoins", "最低投币"],
];

const parseRuleObject = (value: string): Record<string, any> => {
  try {
    const parsed = (() => { try { return JSON.parse(value); } catch { return null; } })() as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : {};
  } catch {
    return {};
  }
};
const emptyForm = {
  title: "",
  description: "",
  platform: "",
  targetType: "",
  targetId: "",
  targetUrl: "",
  coverUrl: "",
  rewardAmount: 0,
  rewardType: "BALANCE",
  claimLimitPerUser: 0,
  totalLimit: "",
  dailyLimit: "",
  needAudit: false,
  autoVerify: false,
  startAt: "",
  endAt: "",
  ruleConfig: JSON.stringify(defaultRule, null, 2),
};

const AdminPromoCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");
  const isEditing = Boolean(taskId);
  const [form, setForm] = useState(emptyForm);

  const { data: existingTask, isLoading: existingTaskLoading, isError: existingTaskError, refetch: refetchExistingTask } = useQuery({
    queryKey: ["admin-promo-edit", taskId],
    queryFn: () => api.get<any>(`/promo/admin/tasks/${taskId}`),
    enabled: isEditing,
  });
  useEffect(() => {
    const task = existingTask?.data ?? existingTask ?? null;
    if (!task) return;
    setForm({
      title: task.title ?? emptyForm.title,
      description: task.description ?? "",
      platform: task.platform ?? "bilibili",
      targetType: task.target_type ?? "video",
      targetId: task.target_id ?? "",
      targetUrl: task.target_url ?? "",
      coverUrl: task.cover_url ?? "",
      rewardAmount: task.reward_amount ?? 0,
      rewardType: task.reward_type ?? "BALANCE",
      claimLimitPerUser: task.claim_limit_per_user ?? 1,
      totalLimit: task.total_limit ?? "",
      dailyLimit: task.daily_limit ?? "",
      needAudit: Boolean(task.need_audit),
      autoVerify: Boolean(task.auto_verify),
      startAt: task.start_at ?? "",
      endAt: task.end_at ?? "",
      ruleConfig:
        typeof task.rule_config === "string"
          ? task.rule_config
          : JSON.stringify(task.rule_config ?? defaultRule, null, 2),
    });
  }, [existingTask]);

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        ruleConfig: (() => { try { return JSON.parse(form.ruleConfig); } catch { return null; } })(),
        rewardAmount: Number(form.rewardAmount),
        claimLimitPerUser: Number(form.claimLimitPerUser),
        totalLimit: form.totalLimit ? Number(form.totalLimit) : undefined,
        dailyLimit: form.dailyLimit ? Number(form.dailyLimit) : undefined,
      };
      return isEditing
        ? api.patch(`/promo/tasks/${taskId}`, payload)
        : api.post("/promo/tasks", payload);
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "TASK_UPDATED" : "TASK_CREATED",
        description: isEditing
          ? "Promo task updated successfully."
          : "Promo task created successfully.",
      });
      navigate("/admin-promo/tasks");
    },
    onError: () =>
      toast({
        variant: "destructive",
        title: isEditing ? "UPDATE_FAILED" : "CREATE_FAILED",
        description: "Unable to save promo task.",
      }),
  });
  const resetDraftMutation = useMutation({
    mutationFn: () => api.patch(`/promo/tasks/${taskId}`, { status: "DRAFT" }),
    onSuccess: () => {
      toast({
        title: "RESET_TO_DRAFT",
        description: "Task status has been reset to draft.",
      });
      navigate(`/admin-promo/tasks/${taskId}`);
    },
    onError: () => toast({ variant: "destructive", title: "重置失败", description: "任务状态未能重置为草稿，请稍后重试。" }),
  });
  const saveDraftMutation = useMutation({
    mutationFn: () =>
      api.post("/promo/tasks", {
        ...form,
        ruleConfig: safeJsonParse(form.ruleConfig, {}),
        rewardAmount: Number(form.rewardAmount),
        claimLimitPerUser: Number(form.claimLimitPerUser),
        totalLimit: form.totalLimit ? Number(form.totalLimit) : undefined,
        dailyLimit: form.dailyLimit ? Number(form.dailyLimit) : undefined,
        status: "DRAFT",
      }),
    onSuccess: () =>
      toast({ title: "DRAFT_SAVED", description: "Draft has been saved." }),
    onError: () => toast({ variant: "destructive", title: "保存失败", description: "草稿未能保存，请检查内容后重试。" }),
  });

  const writePending = submitMutation.isPending || resetDraftMutation.isPending || saveDraftMutation.isPending;

  const update = (key: keyof typeof form, value: string | number | boolean) => {
    // URL 输入实时校验
    if (key === "targetUrl" && value && !isUrlSafe(String(value))) {
      toast({
        variant: "destructive",
        title: "INVALID_URL",
        description: "目标链接格式无效，仅支持 http/https 协议。",
      });
      return;
    }
    if (key === "coverUrl" && value && !isImageUrlSafe(String(value))) {
      toast({
        variant: "destructive",
        title: "INVALID_IMAGE",
        description: "封面图片链接格式无效，仅支持 https 协议的图片链接。",
      });
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const rewardPolicy = useMemo(
    () => parsePromoRewardPolicy(form.ruleConfig, Number(form.rewardAmount)),
    [form.rewardAmount, form.ruleConfig],
  );
  const isTiered = rewardPolicy.mode === "POPULAR_VIDEO_TIERED";

  const setRuleObject = (rule: Record<string, any>) => {
    const nextRuleConfig = JSON.stringify(rule, null, 2);
    const nextPolicy = parsePromoRewardPolicy(nextRuleConfig, Number(form.rewardAmount));
    setForm((current) => ({
      ...current,
      ruleConfig: nextRuleConfig,
      rewardAmount: nextPolicy.mode === "POPULAR_VIDEO_TIERED"
        ? Math.max(...nextPolicy.tiers.map((tier) => tier.rewardAmount))
        : current.rewardAmount,
      needAudit: nextPolicy.mode === "POPULAR_VIDEO_TIERED" ? true : current.needAudit,
      autoVerify: nextPolicy.mode === "POPULAR_VIDEO_TIERED" ? false : current.autoVerify,
    }));
  };

  const switchRewardMode = (mode: "LEGACY_FIXED" | "POPULAR_VIDEO_TIERED") => {
    setRuleObject(mode === "POPULAR_VIDEO_TIERED" ? defaultTieredRule : defaultRule);
  };

  const updateTier = (index: number, key: keyof PromoRewardTier, value: string | number) => {
    const rule = parseRuleObject(form.ruleConfig);
    const tiers = Array.isArray(rule.tiers) ? [...rule.tiers] : [];
    const tier = { ...(tiers[index] ?? {}) };
    if (key === "key" || key === "name") {
      tier[key] = String(value);
    } else {
      const numeric = Math.max(0, Math.trunc(Number(value) || 0));
      if (numeric === 0 && key !== "rewardAmount") delete tier[key];
      else tier[key] = numeric;
    }
    tiers[index] = tier;
    setRuleObject({ ...rule, tiers });
  };

  const addTier = () => {
    const rule = parseRuleObject(form.ruleConfig);
    const tiers = Array.isArray(rule.tiers) ? [...rule.tiers] : [];
    const number = tiers.length + 1;
    tiers.push({ key: `tier_${number}`, name: `收益档位 ${number}`, rewardAmount: 1000 * number, minViews: 1000 * number });
    setRuleObject({ ...defaultTieredRule, ...rule, tiers });
  };

  const removeTier = (index: number) => {
    const rule = parseRuleObject(form.ruleConfig);
    const tiers = Array.isArray(rule.tiers) ? rule.tiers.filter((_: unknown, tierIndex: number) => tierIndex !== index) : [];
    if (tiers.length === 0) {
      toast({ variant: "destructive", title: "至少保留一个档位", description: "热门视频任务必须设置至少一个收益档位。" });
      return;
    }
    setRuleObject({ ...rule, tiers });
  };

  const updateTieredSetting = (key: "observationHours" | "keywords" | "hashtags", value: string) => {
    const rule = parseRuleObject(form.ruleConfig);
    if (key === "observationHours") {
      setRuleObject({ ...rule, observationHours: Math.max(1, Math.trunc(Number(value) || 1)) });
      return;
    }
    const contentRequirements = { ...(rule.contentRequirements ?? {}) };
    contentRequirements[key] = value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
    setRuleObject({ ...rule, contentRequirements });
  };

  const title = useMemo(
    () => (isEditing ? "编辑任务" : "创建任务"),
    [isEditing],
  );

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper
        isLoading={isEditing && existingTaskLoading}
        isError={isEditing && existingTaskError}
        onRetry={() => refetchExistingTask()}
      >
        <AdminPageHeader
          badge="推广任务 / 创建编辑"
          title={title}
          description="快速创建一个推广激励任务。你可以先使用默认的三连规则，再按需调整奖励、有效期与审核方式。"
          statusLabel="任务编辑器已就绪"
          rightSlot={
            <div className="flex gap-4">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => resetDraftMutation.mutate()}
                  disabled={writePending}
                  aria-busy={resetDraftMutation.isPending}
                  className="group px-12 py-8 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 bg-white border border-zinc-100 hover:border-amber-300 italic active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <GeometricLantern
                    variant="settings"
                    className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500"
                  />
                  {resetDraftMutation.isPending ? "重置中…" : "重置草稿"}
                </button>
              )}
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={writePending}
                  aria-busy={saveDraftMutation.isPending}
                  className="group px-12 py-8 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 bg-white border border-zinc-100 hover:border-accent italic active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <GeometricLantern
                    variant="settings"
                    className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500"
                  />
                  {saveDraftMutation.isPending ? "保存中…" : "保存草稿"}
                </button>
              )}
              <button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={writePending}
                aria-busy={submitMutation.isPending}
                className="group px-12 py-8 btn-accent rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GeometricLantern
                  variant="spark"
                  className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500"
                />
                {submitMutation.isPending ? "提交中…" : isEditing ? "更新任务" : "发布任务"}
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          <div className="xl:col-span-8 space-y-10">
            <div className="p-10 border border-zinc-50 rounded-[4rem] bg-white shadow-xs space-y-6">
              <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">
                基础信息
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  ["title", "任务标题"],
                  ["platform", "平台"],
                  ["targetType", "目标类型"],
                  ["targetId", "目标 ID"],
                  ["targetUrl", "目标链接"],
                  ["coverUrl", "封面链接"],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">
                      {label}
                    </div>
                    <input
                      value={(form as unknown)[key]}
                      onChange={(e) =>
                        update(key as keyof typeof form, e.target.value)
                      }
                      className="w-full px-6 py-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 outline-none focus:border-accent"
                    />
                  </label>
                ))}
              </div>
              <label className="space-y-2 block">
                <div className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">
                  任务描述
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  className="w-full min-h-40 px-6 py-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 outline-none focus:border-accent"
                />
              </label>
            </div>
            <div className="p-10 border border-zinc-50 rounded-[4rem] bg-white shadow-xs space-y-6">
              <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">
                奖励与限制
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  ["rewardAmount", "奖励金额"],
                  ["rewardType", "奖励类型"],
                  ["claimLimitPerUser", "每人领取次数"],
                  ["totalLimit", "总领取上限"],
                  ["dailyLimit", "每日上限"],
                  ["startAt", "开始时间"],
                  ["endAt", "结束时间"],
                ].map(([key, label]) => (
                  <label key={key} className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">
                      {label}
                    </div>
                    <input
                      type={key.includes("At") ? "datetime-local" : "text"}
                      value={(form as unknown)[key]}
                      disabled={key === "rewardAmount" && isTiered}
                      onChange={(e) =>
                        update(
                          key as keyof typeof form,
                          key.includes("Amount") || key.includes("Limit")
                            ? Number(e.target.value || 0)
                            : e.target.value,
                        )
                      }
                      className="w-full px-6 py-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 outline-none focus:border-accent"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="p-10 border border-zinc-50 rounded-[4rem] bg-white shadow-xs space-y-8">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">奖励模型</div>
                <p className="mt-3 text-sm leading-7 text-zinc-500">热门视频模式不会在审核时直接发放最高奖励，而是按公开视频数据达到的最高档位补发差额。</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button type="button" onClick={() => switchRewardMode("LEGACY_FIXED")} className={`rounded-[1.5rem] border px-6 py-5 text-left transition ${!isTiered ? "border-accent bg-accent/5" : "border-zinc-100 bg-zinc-50"}`}>
                  <div className="font-black">固定奖励</div>
                  <div className="mt-1 text-xs text-zinc-500">审核通过后一次性发放任务奖励。</div>
                </button>
                <button type="button" onClick={() => switchRewardMode("POPULAR_VIDEO_TIERED")} className={`rounded-[1.5rem] border px-6 py-5 text-left transition ${isTiered ? "border-accent bg-accent/5" : "border-zinc-100 bg-zinc-50"}`}>
                  <div className="font-black">热门视频分档</div>
                  <div className="mt-1 text-xs text-zinc-500">按播放和互动数据逐档补发差额。</div>
                </button>
              </div>

              {rewardPolicy.mode === "POPULAR_VIDEO_TIERED" ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <label className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">观察期（小时）</div>
                      <input type="number" min={1} value={rewardPolicy.observationHours} onChange={(event) => updateTieredSetting("observationHours", event.target.value)} className="w-full rounded-[1.25rem] border border-zinc-100 bg-zinc-50 px-4 py-3 outline-none focus:border-accent" />
                    </label>
                    <label className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">内容关键词</div>
                      <input value={rewardPolicy.contentRequirements.keywords.join("，")} onChange={(event) => updateTieredSetting("keywords", event.target.value)} placeholder="多个关键词用逗号分隔" className="w-full rounded-[1.25rem] border border-zinc-100 bg-zinc-50 px-4 py-3 outline-none focus:border-accent" />
                    </label>
                    <label className="space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">指定话题</div>
                      <input value={rewardPolicy.contentRequirements.hashtags.join("，")} onChange={(event) => updateTieredSetting("hashtags", event.target.value)} placeholder="#话题，#活动" className="w-full rounded-[1.25rem] border border-zinc-100 bg-zinc-50 px-4 py-3 outline-none focus:border-accent" />
                    </label>
                  </div>

                  <div className="space-y-4">
                    {rewardPolicy.tiers.map((tier, index) => (
                      <section key={`${tier.key}-${index}`} className="rounded-[2rem] border border-zinc-100 bg-zinc-50/50 p-6 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="font-black">档位 {index + 1}</div>
                          <button type="button" onClick={() => removeTier(index)} className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-black text-rose-600">删除档位</button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <label className="space-y-1"><span className="text-xs font-bold text-zinc-500">档位标识</span><input value={tier.key} onChange={(event) => updateTier(index, "key", event.target.value)} className="w-full rounded-xl border border-zinc-100 bg-white px-3 py-2" /></label>
                          <label className="space-y-1"><span className="text-xs font-bold text-zinc-500">档位名称</span><input value={tier.name} onChange={(event) => updateTier(index, "name", event.target.value)} className="w-full rounded-xl border border-zinc-100 bg-white px-3 py-2" /></label>
                          <label className="space-y-1"><span className="text-xs font-bold text-zinc-500">累计奖励（分）</span><input type="number" min={1} value={tier.rewardAmount} onChange={(event) => updateTier(index, "rewardAmount", event.target.value)} className="w-full rounded-xl border border-zinc-100 bg-white px-3 py-2" /></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {tierMetricFields.map(([key, label]) => (
                            <label key={key} className="space-y-1"><span className="text-xs font-bold text-zinc-500">{label}</span><input type="number" min={0} value={typeof tier[key] === "number" ? tier[key] : ""} onChange={(event) => updateTier(index, key, event.target.value)} placeholder="不限制" className="w-full rounded-xl border border-zinc-100 bg-white px-3 py-2" /></label>
                          ))}
                        </div>
                      </section>
                    ))}
                    <button type="button" onClick={addTier} className="w-full rounded-[1.5rem] border border-dashed border-zinc-300 px-5 py-4 text-sm font-black text-zinc-600 hover:border-accent hover:text-accent">新增收益档位</button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-5 text-sm leading-7 text-zinc-500">固定奖励继续使用动作规则；奖励金额由上方“奖励金额”字段决定。</div>
              )}

              <details className="rounded-[1.5rem] border border-zinc-100 bg-white p-5">
                <summary className="cursor-pointer text-sm font-black text-zinc-700">高级：编辑规则 JSON</summary>
                <textarea aria-label="推广任务规则 JSON" value={form.ruleConfig} onChange={(e) => update("ruleConfig", e.target.value)} className="mt-4 w-full min-h-72 px-5 py-4 rounded-[1.25rem] border border-zinc-100 bg-zinc-50 outline-none focus:border-accent font-mono text-sm" />
              </details>
            </div>
          </div>
          <aside className="xl:col-span-4 space-y-10">
            <div className="p-10 border border-zinc-50 rounded-[4rem] bg-zinc-50/20 space-y-6">
              <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">
                开关设置
              </div>
              <label className="flex items-center justify-between gap-4 px-5 py-4 bg-white rounded-[1.5rem] border border-zinc-100">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">
                  需要审核
                </span>
                <input
                  type="checkbox"
                  checked={isTiered || form.needAudit}
                  disabled={isTiered}
                  onChange={(e) => update("needAudit", e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between gap-4 px-5 py-4 bg-white rounded-[1.5rem] border border-zinc-100">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">
                  自动校验
                </span>
                <input
                  type="checkbox"
                  checked={!isTiered && form.autoVerify}
                  disabled={isTiered}
                  onChange={(e) => update("autoVerify", e.target.checked)}
                />
              </label>
              <div className="pt-4 grid grid-cols-1 gap-4 text-[11px] font-medium text-zinc-500 leading-7">
                <div className="p-5 bg-white rounded-[1.5rem] border border-zinc-100">
                  固定奖励适合一次性动作任务；热门视频分档适合按公开视频数据持续监测和补差额。
                </div>
                <div className="p-5 bg-white rounded-[1.5rem] border border-zinc-100">
                  热门视频模式强制人工审核。审核只确认内容与作者，收益由指标快照计算。
                </div>
              </div>
            </div>
            <div className="p-10 border border-accent/10 rounded-[4rem] bg-accent/5 space-y-6">
              <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-accent">
                预览
              </div>
              <div className="text-2xl font-black uppercase italic leading-none text-zinc-900">
                {form.title}
              </div>
              <div className="text-[11px] font-medium text-zinc-500 leading-7">
                {form.description}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-400">
                <GeometricLantern
                  variant="payment"
                  className="w-4 h-4 text-accent"
                />{" "}
                ¥ {form.rewardAmount}
              </div>
            </div>
          </aside>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminPromoCreate;
