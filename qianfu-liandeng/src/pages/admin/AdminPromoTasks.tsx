import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/request";
import { promotionApi } from "@/api/promotionApi";
import StatusWrapper from "@/components/ui/StatusWrapper";
import AdminPageHeader from "@/components/ui/AdminPageHeader";
import AdminStatCard from "@/components/ui/AdminStatCard";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Copy, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import GeometricLantern from "@/components/ui/GeometricLantern";
import AdminPromoDraftView from "./components/AdminPromoDraftView";
import AdminPromoTaskTable from "./components/AdminPromoTaskTable";
import { promoQuickSetupTips } from "./promoConfig";

const AdminPromoTasks: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "all" | "enabled" | "draft" | "disabled" | "paused"
  >("all");
  const [showCreateTips, setShowCreateTips] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{
    id: number;
    type: "pause" | "disable";
    title: string;
    confirmText: string;
    input: string;
    countdown: number;
  } | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<number[]>([]);

  const copyText = async (text: string, successTitle: string) => {
    try {
      await copyText(text);
      toast({ title: successTitle });
    } catch {
      toast({ variant: 'destructive', title: '复制失败', description: '请检查浏览器剪贴板权限。' });
    }
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-promo-tasks"],
    queryFn: promotionApi.listTasks,
  });
  const tasks = useMemo(() => data?.data ?? [], [data]);
  const filtered = useMemo(
    () =>
      tasks.filter(
        (task: any) =>
          activeTab === "all" ||
          String(task.status || "").toLowerCase() === activeTab,
      ),
    [tasks, activeTab],
  );
  const draftTasks = useMemo(
    () =>
      tasks.filter(
        (task: any) => String(task.status || "").toLowerCase() === "draft",
      ),
    [tasks],
  );
  const selectedDraftTasks = useMemo(
    () => draftTasks.filter((task: any) => selectedDraftIds.includes(task.id)),
    [draftTasks, selectedDraftIds],
  );

  const publishMutation = useMutation({
    mutationFn: (id: number) => api.post(`/promo/tasks/${id}/publish`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-tasks"] });
      toast({
        title: "TASK_PUBLISHED",
        description: "Task has been published.",
      });
    },
    onError: () => toast({ variant: "destructive", title: "发布失败", description: "推广任务未能发布，请稍后重试。" }),
  });
  const pauseMutation = useMutation({
    mutationFn: ({ id, remark }: { id: number; remark: string }) =>
      api.post(`/promo/tasks/${id}/pause`, { remark }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-tasks"] });
      toast({ title: "TASK_PAUSED", description: "Task has been paused." });
    },
    onError: () => toast({ variant: "destructive", title: "暂停失败", description: "推广任务未能暂停，请稍后重试。" }),
  });
  const disableMutation = useMutation({
    mutationFn: ({ id, remark }: { id: number; remark: string }) =>
      api.post(`/promo/tasks/${id}/disable`, { remark }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-tasks"] });
      toast({ title: "TASK_DISABLED", description: "Task has been disabled." });
    },
    onError: () => toast({ variant: "destructive", title: "停用失败", description: "推广任务未能停用，请稍后重试。" }),
  });
  const batchPublishMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.post("/promo/tasks/batch/publish", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-tasks"] });
      toast({
        title: "BATCH_PUBLISHED",
        description: "Selected drafts have been published.",
      });
      setSelectedDraftIds([]);
    },
    onError: () => toast({ variant: "destructive", title: "批量发布失败", description: "所选草稿未能发布，请稍后重试。" }),
  });
  const batchPauseMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.post("/promo/tasks/batch/pause", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-tasks"] });
      toast({
        title: "BATCH_PAUSED",
        description: "Selected drafts have been paused.",
      });
      setSelectedDraftIds([]);
    },
    onError: () => toast({ variant: "destructive", title: "批量暂停失败", description: "所选任务未能暂停，请稍后重试。" }),
  });
  const batchRestoreMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.post("/promo/tasks/batch/restore", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-promo-tasks"] });
      toast({
        title: "BATCH_RESTORED",
        description: "Selected drafts have been restored.",
      });
      setSelectedDraftIds([]);
    },
    onError: () => toast({ variant: "destructive", title: "批量恢复失败", description: "所选任务未能恢复，请稍后重试。" }),
  });

  const stats = [
    {
      label: "任务总数",
      value: String(tasks.length),
      variant: "network" as const,
      color: "text-green-500",
      trend: "已配置任务",
      tag: "PT_01",
    },
    {
      label: "启用任务",
      value: String(
        tasks.filter((t: any) => String(t.status).toLowerCase() === "enabled")
          .length,
      ),
      variant: "spark" as const,
      color: "text-blue-500",
      trend: "可领取",
      tag: "PT_02",
    },
    {
      label: "草稿任务",
      value: String(draftTasks.length),
      variant: "settings" as const,
      color: "text-zinc-400",
      trend: "待发布",
      tag: "PT_03",
    },
    {
      label: "暂停任务",
      value: String(
        tasks.filter((t: any) => String(t.status).toLowerCase() === "paused")
          .length,
      ),
      variant: "alert" as const,
      color: "text-amber-500",
      trend: "临时停止",
      tag: "PT_04",
    },
  ];

  const performAction = async () => {
    if (!confirmAction) return;
    if (
      confirmAction.countdown > 0 ||
      confirmAction.input !== confirmAction.confirmText
    )
      return;
    const payload = {
      id: confirmAction.id,
      remark: confirmAction.input.trim(),
    };
    if (confirmAction.type === "pause")
      await pauseMutation.mutateAsync(payload);
    if (confirmAction.type === "disable")
      await disableMutation.mutateAsync(payload);
    setConfirmAction(null);
  };
  const openConfirm = (task: any, type: "pause" | "disable") =>
    setConfirmAction({
      id: task.id,
      type,
      title: task.title,
      confirmText: task.title,
      input: "",
      countdown: 2,
    });
  const copyDraftTitles = async () => copyText(
    selectedDraftTasks.map((task) => task.title).join("\n"),
    '已复制所选草稿标题',
  );
  const matchesConfirm = Boolean(
    confirmAction &&
    confirmAction.input === confirmAction.confirmText &&
    confirmAction.countdown === 0,
  );
  React.useEffect(() => {
    if (!confirmAction || confirmAction.countdown <= 0) return;
    const timer = window.setTimeout(
      () =>
        setConfirmAction((prev) =>
          prev ? { ...prev, countdown: prev.countdown - 1 } : prev,
        ),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [confirmAction, confirmAction?.id, confirmAction?.countdown]);

  const visibleTaskTable = (
    <AdminPromoTaskTable
      tasks={filtered}
      onPublish={(id) => publishMutation.mutate(id)}
      onPause={(task) => openConfirm(task, "pause")}
      onDisable={(task) => openConfirm(task, "disable")}
    />
  );

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      >
        <AdminPageHeader
          badge="推广任务 / 规则配置"
          title="任务列表"
          description="管理每个推广任务的规则、奖励、领取限制和发放方式。请使用创建页新增真实任务，不再提供示例任务注入。"
          statusLabel="任务列表已启用"
          rightSlot={
            <Link
              to="/admin-promo/create"
              className="group px-12 py-8 btn-accent rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98]"
            >
              <GeometricLantern
                variant="spark"
                className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500"
              />{" "}
              新建任务
            </Link>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10">
          {stats.map((s, idx) => (
            <AdminStatCard
              key={s.tag}
              tag={s.tag}
              value={s.value}
              label={s.label}
              variant={s.variant}
              colorClassName={s.color}
              trend={s.trend}
              delay={idx * 0.08}
            />
          ))}
        </div>
        <div className="flex flex-col xl:flex-row items-center justify-between gap-10 pt-12 border-t border-zinc-50">
          <div className="flex gap-16 overflow-x-auto no-scrollbar w-full xl:w-auto">
            {[
              { id: "all", label: "全部任务", tag: "ALL" },
              { id: "enabled", label: "已启用", tag: "ON" },
              { id: "draft", label: "草稿", tag: "DRAFT" },
              { id: "paused", label: "已暂停", tag: "HOLD" },
              { id: "disabled", label: "已下线", tag: "OFF" },
            ].map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id as unknown)}
                className={`flex flex-col items-start gap-3 pb-10 transition-all relative group ${activeTab === tab.id ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
              >
                <span className="text-[12px] font-black uppercase tracking-[0.4em] italic">
                  {tab.label}
                </span>
                <span className="text-[9px] font-black font-mono tracking-widest text-zinc-400">
                  / {tab.tag}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="promo-task-tab"
                    className="absolute bottom-0 left-0 right-0 h-1.5 bg-accent"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-4">
            <Link
              to="/admin-promo/create"
              className="px-10 py-6 bg-zinc-50/50 border border-transparent hover:border-accent hover:bg-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-4 transition-all duration-500 italic shadow-xs group"
            >
              <GeometricLantern
                variant="settings"
                className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors"
              />{" "}
              创建页
            </Link>
            <button
              type="button"
              onClick={() => setShowCreateTips((v) => !v)}
              className="px-10 py-6 bg-zinc-50/50 border border-transparent hover:border-accent hover:bg-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-4 transition-all duration-500 italic shadow-xs group"
            >
              <GeometricLantern
                variant="settings"
                className="w-4 h-4 text-zinc-200 group-hover:text-accent transition-colors"
              />{" "}
              显示提示
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showCreateTips && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="p-12 border border-accent/10 rounded-[4rem] bg-accent/5 space-y-6"
            >
              <div className="flex items-center gap-4">
                <GeometricLantern
                  variant="activity"
                  className="w-6 h-6 text-accent"
                />
                <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-accent">
                  快速说明
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-[11px] font-medium text-zinc-500 leading-7">
                {promoQuickSetupTips.map((tip) => (
                  <div
                    key={tip}
                    className="p-8 bg-white rounded-[2rem] border border-zinc-100"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {activeTab === "draft" ? (
          <AdminPromoDraftView
            draftTasks={draftTasks}
            selectedDraftIds={selectedDraftIds}
            setSelectedDraftIds={setSelectedDraftIds}
            onBatchPublish={() => batchPublishMutation.mutate(selectedDraftIds)}
            onBatchPause={() => batchPauseMutation.mutate(selectedDraftIds)}
            onCopyTitles={copyDraftTitles}
            selectedCount={selectedDraftIds.length}
            onBatchRestore={() => batchRestoreMutation.mutate(selectedDraftIds)}
            onPublishNow={(id) => publishMutation.mutate(id)}
            onPause={(task) => openConfirm(task, "pause")}
          />
        ) : (
          visibleTaskTable
        )}
      </StatusWrapper>

      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
              onClick={() => setConfirmAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className={`relative w-full max-w-xl bg-white rounded-[3rem] p-10 shadow-[0_40px_120px_rgba(0,0,0,0.45)] space-y-6 ring-1 ${confirmAction.type === "pause" ? "ring-amber-200" : "ring-rose-200"}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${confirmAction.type === "pause" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div
                    className={`text-[10px] font-black uppercase tracking-[0.5em] italic ${confirmAction.type === "pause" ? "text-amber-600" : "text-rose-600"}`}
                  >
                    {confirmAction.type === "pause" ? "暂停提醒" : "下线提醒"}
                  </div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter mt-2">
                    {confirmAction.type === "pause" ? "暂停任务" : "下线任务"}
                  </h3>
                  <p className="mt-3 text-sm text-zinc-500 leading-7">
                    请输入任务名{" "}
                    <span className="font-black text-zinc-900">
                      {confirmAction.confirmText}
                    </span>{" "}
                    以确认执行{" "}
                    <span className="font-black">
                      {confirmAction.type === "pause" ? "暂停" : "下线"}
                    </span>{" "}
                    操作。
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  aria-label="输入任务名确认操作"
                  value={confirmAction.input}
                  onChange={(e) =>
                    setConfirmAction((prev) =>
                      prev ? { ...prev, input: e.target.value } : prev,
                    )
                  }
                  placeholder={`输入 "${confirmAction.confirmText}"`}
                  className="flex-1 px-5 py-4 rounded-[1.25rem] border border-zinc-200 bg-zinc-50 outline-none focus:border-accent font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => { void copyText(confirmAction.confirmText, '任务名已复制'); }}
                  className="px-4 py-4 rounded-[1.25rem] border border-zinc-200 bg-white text-[10px] font-black uppercase tracking-[0.3em] italic flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" /> 复制任务名
                </button>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.35em] italic text-zinc-400">
                <CheckCircle2
                  className={`w-4 h-4 ${matchesConfirm ? "text-emerald-500" : "text-zinc-300"}`}
                />{" "}
                {confirmAction.countdown > 0
                  ? `${confirmAction.countdown}s 后可确认`
                  : matchesConfirm
                    ? "任务名已匹配，可继续"
                    : "需要完整输入任务名后才能继续"}
              </div>
              <div className="p-4 rounded-[1.5rem] bg-zinc-50 border border-zinc-100 text-[10px] font-black uppercase tracking-[0.35em] italic text-zinc-400 leading-7">
                暂停任务后仍可恢复；下线任务通常用于停止展示或最终清理。
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-6 py-3 rounded-[1.2rem] border border-zinc-200 text-[10px] font-black uppercase tracking-[0.3em] italic"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={performAction}
                  disabled={!matchesConfirm}
                  className={`px-6 py-3 rounded-[1.2rem] text-white text-[10px] font-black uppercase tracking-[0.3em] italic disabled:opacity-40 ${confirmAction.type === "pause" ? "bg-amber-500" : "bg-rose-500"}`}
                >
                  确认
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPromoTasks;
