import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import AdminPageHeader from '@/components/AdminPageHeader';
import { toast } from '@/hooks/use-toast';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { isUrlSafe, isImageUrlSafe } from '@/utils/urlValidator';

const defaultRule = { actions: { like: true, coin: true, favorite: true, follow: false, share: false }, condition: 'all_required' };
const emptyForm = { title: 'B站三连奖励', description: '点赞、投币、收藏后自动发放余额奖励。', platform: 'bilibili', targetType: 'video', targetId: 'BV1demo000001', targetUrl: 'https://www.bilibili.com/video/BV1demo000001', coverUrl: 'https://picsum.photos/seed/promo-task/1200/800', rewardAmount: 5, rewardType: 'BALANCE', claimLimitPerUser: 1, totalLimit: '', dailyLimit: '', needAudit: false, autoVerify: true, startAt: '', endAt: '', ruleConfig: JSON.stringify(defaultRule, null, 2) };

const AdminPromoCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const isEditing = Boolean(taskId);
  const [form, setForm] = useState(emptyForm);

  const { data: existingTask } = useQuery({ queryKey: ['admin-promo-edit', taskId], queryFn: () => api.get<any>(`/promo/tasks/${taskId}`), enabled: isEditing });
  useEffect(() => { const task = existingTask?.data ?? existingTask ?? null; if (!task) return; setForm({ title: task.title ?? emptyForm.title, description: task.description ?? '', platform: task.platform ?? 'bilibili', targetType: task.target_type ?? 'video', targetId: task.target_id ?? '', targetUrl: task.target_url ?? '', coverUrl: task.cover_url ?? '', rewardAmount: task.reward_amount ?? 0, rewardType: task.reward_type ?? 'BALANCE', claimLimitPerUser: task.claim_limit_per_user ?? 1, totalLimit: task.total_limit ?? '', dailyLimit: task.daily_limit ?? '', needAudit: Boolean(task.need_audit), autoVerify: Boolean(task.auto_verify), startAt: task.start_at ?? '', endAt: task.end_at ?? '', ruleConfig: typeof task.rule_config === 'string' ? task.rule_config : JSON.stringify(task.rule_config ?? defaultRule, null, 2) }); }, [existingTask]);

  const submitMutation = useMutation({ mutationFn: () => { const payload = { ...form, ruleConfig: JSON.parse(form.ruleConfig), rewardAmount: Number(form.rewardAmount), claimLimitPerUser: Number(form.claimLimitPerUser), totalLimit: form.totalLimit ? Number(form.totalLimit) : undefined, dailyLimit: form.dailyLimit ? Number(form.dailyLimit) : undefined }; return isEditing ? api.patch(`/promo/tasks/${taskId}`, payload) : api.post('/promo/tasks', payload); }, onSuccess: () => { toast({ title: isEditing ? 'TASK_UPDATED' : 'TASK_CREATED', description: isEditing ? 'Promo task updated successfully.' : 'Promo task created successfully.' }); navigate('/admin-promo/tasks'); }, onError: () => toast({ variant: 'destructive', title: isEditing ? 'UPDATE_FAILED' : 'CREATE_FAILED', description: 'Unable to save promo task.' }) });
  const resetDraftMutation = useMutation({ mutationFn: () => api.patch(`/promo/tasks/${taskId}`, { status: 'DRAFT' }), onSuccess: () => { toast({ title: 'RESET_TO_DRAFT', description: 'Task status has been reset to draft.' }); navigate(`/admin-promo/tasks/${taskId}`); } });
  const saveDraftMutation = useMutation({ mutationFn: () => api.post('/promo/tasks', { ...form, ruleConfig: JSON.parse(form.ruleConfig), rewardAmount: Number(form.rewardAmount), claimLimitPerUser: Number(form.claimLimitPerUser), totalLimit: form.totalLimit ? Number(form.totalLimit) : undefined, dailyLimit: form.dailyLimit ? Number(form.dailyLimit) : undefined, status: 'DRAFT' }), onSuccess: () => toast({ title: 'DRAFT_SAVED', description: 'Draft has been saved.' }) });

  const update = (key: keyof typeof form, value: string | number | boolean) => {
    // URL 输入实时校验
    if (key === 'targetUrl' && value && !isUrlSafe(String(value))) {
      toast({ variant: 'destructive', title: 'INVALID_URL', description: '目标链接格式无效，仅支持 http/https 协议。' });
      return;
    }
    if (key === 'coverUrl' && value && !isImageUrlSafe(String(value))) {
      toast({ variant: 'destructive', title: 'INVALID_IMAGE', description: '封面图片链接格式无效，仅支持 https 协议的图片链接。' });
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const title = useMemo(() => (isEditing ? '编辑任务' : '创建任务'), [isEditing]);

  return (
    <div className="space-y-16 pb-32 bg-white selection:bg-accent selection:text-white">
      <StatusWrapper isLoading={isEditing && !existingTask} isError={false} onRetry={() => undefined}>
        <AdminPageHeader badge="PROMO_TASKS / AUTHORING" title={title} description="快速创建一个推广激励任务。你可以先使用默认的三连规则，再按需调整奖励、有效期与审核方式。" statusLabel="Draft Builder: READY" rightSlot={(
          <div className="flex gap-4">
            {isEditing && <button onClick={() => resetDraftMutation.mutate()} className="group px-12 py-8 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 bg-white border border-zinc-100 hover:border-amber-300 italic active:scale-[0.98]"><GeometricLantern variant="settings" className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500" />RESET_DRAFT</button>}
            {!isEditing && <button onClick={() => saveDraftMutation.mutate()} className="group px-12 py-8 rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 bg-white border border-zinc-100 hover:border-accent italic active:scale-[0.98]"><GeometricLantern variant="settings" className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500" />SAVE_DRAFT</button>}
            <button onClick={() => submitMutation.mutate()} className="group px-12 py-8 btn-accent rounded-[3rem] text-[12px] font-black uppercase tracking-[0.5em] transition-all flex items-center gap-6 shadow-2xl shadow-accent/20 italic active:scale-[0.98]"><GeometricLantern variant="spark" className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500" />{isEditing ? 'UPDATE_TASK' : 'PUBLISH_TASK'}</button>
          </div>
        )} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          <div className="xl:col-span-8 space-y-10">
            <div className="p-10 border border-zinc-50 rounded-[4rem] bg-white shadow-xs space-y-6">
              <div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">基础信息</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[['title', '任务标题'], ['platform', '平台'], ['targetType', '目标类型'], ['targetId', '目标 ID'], ['targetUrl', '目标链接'], ['coverUrl', '封面链接']].map(([key, label]) => (<label key={key} className="space-y-2"><div className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">{label}</div><input value={(form as any)[key]} onChange={(e) => update(key as keyof typeof form, e.target.value)} className="w-full px-6 py-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 outline-none focus:border-accent" /></label>))}</div>
              <label className="space-y-2 block"><div className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">任务描述</div><textarea value={form.description} onChange={(e) => update('description', e.target.value)} className="w-full min-h-40 px-6 py-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 outline-none focus:border-accent" /></label>
            </div>
            <div className="p-10 border border-zinc-50 rounded-[4rem] bg-white shadow-xs space-y-6"><div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">奖励与限制</div><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[['rewardAmount', '奖励金额'], ['rewardType', '奖励类型'], ['claimLimitPerUser', '每人领取次数'], ['totalLimit', '总领取上限'], ['dailyLimit', '每日上限'], ['startAt', '开始时间'], ['endAt', '结束时间']].map(([key, label]) => (<label key={key} className="space-y-2"><div className="text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-300">{label}</div><input type={key.includes('At') ? 'datetime-local' : 'text'} value={(form as any)[key]} onChange={(e) => update(key as keyof typeof form, key.includes('Amount') || key.includes('Limit') ? Number(e.target.value || 0) : e.target.value)} className="w-full px-6 py-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 outline-none focus:border-accent" /></label>))}</div></div>
            <div className="p-10 border border-zinc-50 rounded-[4rem] bg-white shadow-xs space-y-6"><div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">规则 JSON</div><textarea value={form.ruleConfig} onChange={(e) => update('ruleConfig', e.target.value)} className="w-full min-h-80 px-6 py-4 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 outline-none focus:border-accent font-mono text-sm" /></div>
          </div>
          <aside className="xl:col-span-4 space-y-10"><div className="p-10 border border-zinc-50 rounded-[4rem] bg-zinc-50/20 space-y-6"><div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-zinc-400">开关设置</div><label className="flex items-center justify-between gap-4 px-5 py-4 bg-white rounded-[1.5rem] border border-zinc-100"><span className="text-[10px] font-black uppercase tracking-[0.4em] italic">需要审核</span><input type="checkbox" checked={form.needAudit} onChange={(e) => update('needAudit', e.target.checked)} /></label><label className="flex items-center justify-between gap-4 px-5 py-4 bg-white rounded-[1.5rem] border border-zinc-100"><span className="text-[10px] font-black uppercase tracking-[0.4em] italic">自动校验</span><input type="checkbox" checked={form.autoVerify} onChange={(e) => update('autoVerify', e.target.checked)} /></label><div className="pt-4 grid grid-cols-1 gap-4 text-[11px] font-medium text-zinc-500 leading-7"><div className="p-5 bg-white rounded-[1.5rem] border border-zinc-100">建议先使用默认三连规则，发布后可在任务列表中继续调整。</div><div className="p-5 bg-white rounded-[1.5rem] border border-zinc-100">需要人工审核时，系统会先记录领取再等待管理员批准。</div></div></div><div className="p-10 border border-accent/10 rounded-[4rem] bg-accent/5 space-y-6"><div className="text-[11px] font-black uppercase tracking-[0.4em] italic text-accent">预览</div><div className="text-2xl font-black uppercase italic leading-none text-zinc-900">{form.title}</div><div className="text-[11px] font-medium text-zinc-500 leading-7">{form.description}</div><div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] italic text-zinc-400"><GeometricLantern variant="payment" className="w-4 h-4 text-accent" /> ¥ {form.rewardAmount}</div></div></aside>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminPromoCreate;
