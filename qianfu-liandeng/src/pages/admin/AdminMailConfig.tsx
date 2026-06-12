import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Mail, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import { toast } from '@/hooks/use-toast';
import AdminPageHeader from '@/components/AdminPageHeader';
import StatusWrapper from '@/components/StatusWrapper';

type BroadcastMode = 'product' | 'maintenance' | 'custom';

type MailAdminConfig = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpAllowInvalidCert: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  contactEmail: string;
  contactPhone: string;
  emailBaseUrl: string;
  clearSmtpPass?: boolean;
};

type MailConfigPayload = {
  config: MailAdminConfig;
  maskedSecrets: {
    smtpPass?: string;
  };
  effective: {
    source: string;
    configured: boolean;
    enabled: boolean;
    meta: {
      contactEmail: string;
      contactPhone: string;
      emailBaseUrl: string;
    };
    diagnostics: {
      usingSystemConfig: boolean;
      usingEnvFallback: boolean;
      hasSecret: boolean;
    };
  };
};

type MailTemplateRecord = {
  key: string;
  name: string;
  mode: BroadcastMode;
  subject: string;
  message: string;
  ctaLabel?: string;
  ctaLink?: string;
  updatedAt?: string;
};

type MailRecipientGroupRecord = {
  key: string;
  name: string;
  description?: string;
  recipients: string[];
  updatedAt?: string;
};

type MailHistoryRecord = {
  id: string;
  kind: 'test' | 'broadcast';
  mode?: BroadcastMode;
  subject: string;
  messagePreview: string;
  recipients: string[];
  totalRecipients: number;
  source: string;
  operator?: string;
  createdAt: string;
};

type MailScheduleRecord = {
  key: string;
  name: string;
  enabled: boolean;
  mode: BroadcastMode;
  scheduleType: 'once' | 'daily';
  onceAt?: string;
  dailyTime?: string;
  timezone?: string;
  recipients: string[];
  recipientGroupKeys?: string[];
  subject: string;
  message: string;
  ctaLabel?: string;
  ctaLink?: string;
  lastRunAt?: string;
  updatedAt?: string;
};

type MailLibraryPayload = {
  templates: MailTemplateRecord[];
  recipientGroups: MailRecipientGroupRecord[];
  history: MailHistoryRecord[];
  schedules: MailScheduleRecord[];
};

const EMPTY_CONFIG: MailAdminConfig = {
  enabled: false,
  smtpHost: '',
  smtpPort: 25,
  smtpSecure: false,
  smtpAllowInvalidCert: false,
  smtpUser: '',
  smtpPass: '',
  emailFrom: '',
  contactEmail: '',
  contactPhone: '',
  emailBaseUrl: '',
  clearSmtpPass: false,
};

const EMPTY_TEMPLATE: MailTemplateRecord = {
  key: '',
  name: '',
  mode: 'product',
  subject: '',
  message: '',
  ctaLabel: '',
  ctaLink: '',
};

const EMPTY_GROUP: MailRecipientGroupRecord = {
  key: '',
  name: '',
  description: '',
  recipients: [],
};

const EMPTY_SCHEDULE: MailScheduleRecord = {
  key: '',
  name: '',
  enabled: true,
  mode: 'maintenance',
  scheduleType: 'daily',
  dailyTime: '22:00',
  timezone: 'Asia/Shanghai',
  recipients: [],
  recipientGroupKeys: [],
  subject: '',
  message: '',
  ctaLabel: '',
  ctaLink: '',
};

const cardClassName = 'rounded-[3rem] border border-zinc-100 bg-white p-8 shadow-xs space-y-6';

const FieldRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <label className="space-y-3">
    <div className="space-y-1">
      <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">{label}</div>
      {description ? <div className="text-xs leading-5 text-zinc-400">{description}</div> : null}
    </div>
    {children}
  </label>
);

function parseRecipientText(text: string): string[] {
  return Array.from(new Set(text.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)));
}

function formatTimestamp(value?: string) {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildNextRunPreview(schedule: MailScheduleRecord) {
  if (!schedule.enabled) return 'disabled';
  if (schedule.scheduleType === 'once') {
    return schedule.lastRunAt ? `completed at ${formatTimestamp(schedule.lastRunAt)}` : `once at ${schedule.onceAt || 'missing onceAt'}`;
  }
  return `daily ${schedule.dailyTime || '00:00'} (${schedule.timezone || 'Asia/Shanghai'})`;
}

function formatChartDayLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const AdminMailConfig: React.FC = () => {
  const [draft, setDraft] = useState<MailAdminConfig>(EMPTY_CONFIG);
  const [revealed, setRevealed] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('千服联灯邮件测试');
  const [testMessage, setTestMessage] = useState('这是一封来自千服超管邮件配置中心的测试邮件。');

  const [broadcastMode, setBroadcastMode] = useState<BroadcastMode>('product');
  const [broadcastRecipients, setBroadcastRecipients] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('新产品发布通知');
  const [broadcastMessage, setBroadcastMessage] = useState('你好，我们刚刚上线了新的产品能力与服务方案，欢迎回访体验。');
  const [broadcastCtaLabel, setBroadcastCtaLabel] = useState('立即查看');
  const [broadcastCtaLink, setBroadcastCtaLink] = useState('http://mc-u.top');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');

  const [templateDraft, setTemplateDraft] = useState<MailTemplateRecord>(EMPTY_TEMPLATE);
  const [groupDraft, setGroupDraft] = useState<MailRecipientGroupRecord>(EMPTY_GROUP);
  const [groupRecipientsText, setGroupRecipientsText] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState<MailScheduleRecord>(EMPTY_SCHEDULE);
  const [scheduleRecipientsText, setScheduleRecipientsText] = useState('');
  const [libraryImportText, setLibraryImportText] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-mail-config'],
    queryFn: () => api.get<MailConfigPayload>('/admin/mail-config'),
  });

  const libraryQuery = useQuery({
    queryKey: ['admin-mail-library'],
    queryFn: () => api.get<MailLibraryPayload>('/admin/mail-config/library'),
  });

  useEffect(() => {
    if (!data?.config) return;
    setDraft({
      ...EMPTY_CONFIG,
      ...data.config,
      clearSmtpPass: false,
    });
  }, [data]);

  const dirty = useMemo(() => {
    if (!data?.config) return false;
    return JSON.stringify({ ...data.config, clearSmtpPass: false }) !== JSON.stringify({ ...draft, clearSmtpPass: Boolean(draft.clearSmtpPass) });
  }, [data, draft]);

  const broadcastRecipientsList = useMemo(() => parseRecipientText(broadcastRecipients), [broadcastRecipients]);
  const groupDraftRecipients = useMemo(() => parseRecipientText(groupRecipientsText), [groupRecipientsText]);

  const updateDraft = <K extends keyof MailAdminConfig>(field: K, value: MailAdminConfig[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put<MailConfigPayload>('/admin/mail-config', {
        ...draft,
        smtpPort: Number(draft.smtpPort || 25),
        clearSmtpPass: Boolean(draft.clearSmtpPass),
      }),
    onSuccess: async (payload) => {
      setDraft((current) => ({
        ...current,
        ...payload.config,
        smtpPass: '',
        clearSmtpPass: false,
      }));
      await refetch();
      toast({ title: '邮件配置已保存', description: '新的 SMTP / 发信配置已写入系统配置。' });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.post('/admin/mail-config/test', { to: testTo, subject: testSubject, message: testMessage }),
    onSuccess: () => {
      libraryQuery.refetch();
      toast({ title: '测试邮件已发送', description: `请检查 ${testTo} 的收件箱或垃圾箱。` });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/mail-config/broadcast', {
        mode: broadcastMode,
        recipients: broadcastRecipientsList,
        subject: broadcastSubject,
        message: broadcastMessage,
        ctaLabel: broadcastCtaLabel.trim() || undefined,
        ctaLink: broadcastCtaLink.trim() || undefined,
      }),
    onSuccess: () => {
      libraryQuery.refetch();
      toast({ title: '批量邮件已提交', description: `本次已向 ${broadcastRecipientsList.length} 个收件人发起投递。` });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: () => api.put(`/admin/mail-config/templates/${encodeURIComponent(templateDraft.key)}`, templateDraft),
    onSuccess: async () => {
      await libraryQuery.refetch();
      toast({ title: '模板已保存', description: `模板 ${templateDraft.name || templateDraft.key} 已写入模板库。` });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/admin/mail-config/templates/${encodeURIComponent(key)}`),
    onSuccess: async () => {
      setTemplateDraft(EMPTY_TEMPLATE);
      await libraryQuery.refetch();
      toast({ title: '模板已删除', description: '所选邮件模板已移除。' });
    },
  });

  const saveGroupMutation = useMutation({
    mutationFn: () =>
      api.put(`/admin/mail-config/recipient-groups/${encodeURIComponent(groupDraft.key)}`, {
        ...groupDraft,
        recipients: groupDraftRecipients,
      }),
    onSuccess: async () => {
      await libraryQuery.refetch();
      toast({ title: '收件组已保存', description: `收件组 ${groupDraft.name || groupDraft.key} 已更新。` });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/admin/mail-config/recipient-groups/${encodeURIComponent(key)}`),
    onSuccess: async () => {
      setGroupDraft(EMPTY_GROUP);
      setGroupRecipientsText('');
      await libraryQuery.refetch();
      toast({ title: '收件组已删除', description: '所选收件组已移除。' });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: () =>
      api.put(`/admin/mail-config/schedules/${encodeURIComponent(scheduleDraft.key)}`, {
        ...scheduleDraft,
        recipients: parseRecipientText(scheduleRecipientsText),
      }),
    onSuccess: async () => {
      await libraryQuery.refetch();
      toast({ title: '定时任务已保存', description: `定时任务 ${scheduleDraft.name || scheduleDraft.key} 已更新。` });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/admin/mail-config/schedules/${encodeURIComponent(key)}`),
    onSuccess: async () => {
      setScheduleDraft(EMPTY_SCHEDULE);
      setScheduleRecipientsText('');
      await libraryQuery.refetch();
      toast({ title: '定时任务已删除', description: '所选邮件定时任务已移除。' });
    },
  });

  const importLibraryMutation = useMutation({
    mutationFn: () => api.post('/admin/mail-config/import', JSON.parse(libraryImportText)),
    onSuccess: async () => {
      await libraryQuery.refetch();
      toast({ title: '库内容已导入', description: '模板、收件组与定时任务已写入系统配置。' });
    },
  });

  const applyBroadcastPreset = (mode: BroadcastMode) => {
    setBroadcastMode(mode);
    if (mode === 'product') {
      setBroadcastSubject('新产品发布通知');
      setBroadcastMessage('你好，我们刚刚上线了新的产品能力与服务方案，欢迎回访体验。');
      setBroadcastCtaLabel('立即查看');
      setBroadcastCtaLink('http://mc-u.top');
      return;
    }
    if (mode === 'maintenance') {
      setBroadcastSubject('[重要] 系统维护通知');
      setBroadcastMessage('系统将在今晚 10 点进行维护，预计持续 2 小时。维护期间部分功能可能不可用，请提前做好安排。');
      setBroadcastCtaLabel('查看公告');
      setBroadcastCtaLink('http://mc-u.top');
      return;
    }
    setBroadcastSubject('系统通知');
    setBroadcastMessage('这里填写你要发送给用户的通知正文。');
    setBroadcastCtaLabel('');
    setBroadcastCtaLink('');
  };

  const applyTemplateToBroadcast = (template: MailTemplateRecord) => {
    setBroadcastMode(template.mode);
    setBroadcastSubject(template.subject);
    setBroadcastMessage(template.message);
    setBroadcastCtaLabel(template.ctaLabel || '');
    setBroadcastCtaLink(template.ctaLink || '');
  };

  const applyGroupToBroadcast = (group: MailRecipientGroupRecord) => {
    setBroadcastRecipients(group.recipients.join('\n'));
    setSelectedGroupKey(group.key);
  };

  const exportLibraryJson = useMemo(
    () =>
      JSON.stringify(
        {
          templates: libraryQuery.data?.templates || [],
          recipientGroups: libraryQuery.data?.recipientGroups || [],
          schedules: libraryQuery.data?.schedules || [],
        },
        null,
        2,
      ),
    [libraryQuery.data],
  );

  const mailStats = useMemo(() => {
    const history = libraryQuery.data?.history || [];
    const schedules = libraryQuery.data?.schedules || [];
    const templates = libraryQuery.data?.templates || [];
    const recipientGroups = libraryQuery.data?.recipientGroups || [];

    return {
      totalSent: history.length,
      broadcastSent: history.filter((item) => item.kind === 'broadcast').length,
      activeSchedules: schedules.filter((item) => item.enabled).length,
      templates: templates.length,
      recipientGroups: recipientGroups.length,
    };
  }, [libraryQuery.data]);

  const mailTrend = useMemo(() => {
    const history = libraryQuery.data?.history || [];
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: formatChartDayLabel(date),
        total: 0,
        broadcast: 0,
        test: 0,
      };
    });

    const map = new Map(days.map((item) => [item.key, item]));
    for (const item of history) {
      const dayKey = item.createdAt.slice(0, 10);
      const target = map.get(dayKey);
      if (!target) continue;
      target.total += 1;
      if (item.kind === 'broadcast') target.broadcast += 1;
      if (item.kind === 'test') target.test += 1;
    }

    const max = Math.max(1, ...days.map((item) => item.total));
    return { days, max };
  }, [libraryQuery.data]);

  const renderInput = (field: keyof MailAdminConfig, placeholder?: string, options?: { numeric?: boolean }) => {
    if (field === 'smtpPass') {
      return (
        <div className="space-y-2">
          <div className="relative">
            <input
              type={revealed ? 'text' : 'password'}
              value={draft.smtpPass || ''}
              onChange={(event) => {
                updateDraft('smtpPass', event.target.value);
                if (event.target.value) updateDraft('clearSmtpPass', false);
              }}
              placeholder={placeholder}
              className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 pr-14 text-sm font-mono outline-hidden transition-all focus:border-accent focus:bg-white"
            />
            <button type="button" onClick={() => setRevealed((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-accent">
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {data?.maskedSecrets?.smtpPass && !draft.smtpPass ? (
            <div className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-zinc-100 bg-zinc-50 px-4 py-3">
              <div className="text-xs font-bold text-zinc-500">
                当前已存密码：<span className="font-mono text-zinc-700">{data.maskedSecrets.smtpPass}</span>
              </div>
              <button
                type="button"
                onClick={() => updateDraft('clearSmtpPass', !draft.clearSmtpPass)}
                className={`rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] transition-all ${draft.clearSmtpPass ? 'bg-red-500 text-white' : 'bg-white text-zinc-500 border border-zinc-200'}`}
              >
                {draft.clearSmtpPass ? 'Will Clear' : 'Clear Stored'}
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <input
        type={options?.numeric ? 'number' : 'text'}
        value={(draft[field] as string | number | undefined) ?? ''}
        onChange={(event) =>
          updateDraft(field, (options?.numeric ? Number(event.target.value || 0) : event.target.value) as MailAdminConfig[keyof MailAdminConfig])
        }
        placeholder={placeholder}
        className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
      />
    );
  };

  return (
    <div className="space-y-16 pb-24 bg-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => { refetch(); libraryQuery.refetch(); }}>
        <AdminPageHeader
          badge="邮件配置 / 验证码与通知"
          title="邮件配置"
          description="这里控制邮箱验证码、密码重置、工单通知等发信链路。支持外部 SMTP、模板库、收件组与运营群发。"
          statusLabel={data?.effective?.configured ? `发信来源：${data.effective.source}` : '发信来源：未启用'}
          statusTone={data?.effective?.configured ? 'success' : 'warning'}
          rightSlot={(
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { refetch(); libraryQuery.refetch(); }} className="rounded-[2rem] border border-zinc-100 bg-white px-6 py-4 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 transition-all hover:border-accent hover:text-accent">
                <span className="inline-flex items-center gap-3"><RefreshCw className="h-4 w-4" /> 刷新</span>
              </button>
              <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !dirty} className="rounded-[2rem] btn-accent px-8 py-4 text-[11px] font-black uppercase tracking-[0.35em] text-white shadow-2xl shadow-accent/20 disabled:opacity-50">
                <span className="inline-flex items-center gap-3"><Save className="h-4 w-4" /> {saveMutation.isPending ? '保存中…' : '保存邮件配置'}</span>
              </button>
            </div>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
          {[
            ['模板库', mailStats.templates, '模板库数量'],
            ['收件组', mailStats.recipientGroups, '收件组数量'],
            ['发送记录', mailStats.totalSent, '最近发送记录'],
            ['群发记录', mailStats.broadcastSent, '群发历史条目'],
            ['定时任务', mailStats.activeSchedules, '已启用定时任务'],
          ].map(([label, value, hint]) => (
            <div key={String(label)} className="rounded-[2.2rem] border border-zinc-100 bg-zinc-50/50 px-6 py-6 shadow-xs">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">{label}</div>
              <div className="mt-3 text-4xl font-black tracking-tighter italic text-zinc-900">{value}</div>
              <div className="mt-2 text-xs font-bold text-zinc-400">{hint}</div>
            </div>
          ))}
        </div>

        <section className={cardClassName}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">发送趋势</div>
              <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">发送脉冲</h2>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-300">最近 7 天</div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.5fr] gap-8">
            <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50/60 px-5 py-6">
              <div className="flex items-end gap-3 h-52">
                {mailTrend.days.map((day) => (
                  <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                    <div className="flex h-40 w-full items-end justify-center gap-1">
                      <div
                        className="w-4 rounded-t-full bg-zinc-300/70"
                        style={{ height: `${(day.test / mailTrend.max) * 100}%` }}
                        title={`测试邮件：${day.test}`}
                      />
                      <div
                        className="w-5 rounded-t-[1rem] bg-black"
                        style={{ height: `${(day.broadcast / mailTrend.max) * 100}%` }}
                        title={`群发邮件：${day.broadcast}`}
                      />
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">{day.label}</div>
                    <div className="text-xs font-bold text-zinc-600">{day.total}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {[
                ['broadcast', mailTrend.days.reduce((sum, item) => sum + item.broadcast, 0), '群发总量', 'bg-black'],
                ['test', mailTrend.days.reduce((sum, item) => sum + item.test, 0), '测试总量', 'bg-zinc-300'],
                ['peak', mailTrend.max, '单日峰值', 'bg-zinc-100'],
              ].map(([key, value, hint, tone]) => (
                <div key={String(key)} className="rounded-[1.8rem] border border-zinc-100 bg-white px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${tone}`} />
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-300">{hint}</div>
                  </div>
                  <div className="mt-3 text-3xl font-black tracking-tighter italic text-zinc-900">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
          <section className={`${cardClassName} xl:col-span-2`}>
            <div className="flex items-center justify-between gap-4">
              <div>
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">SMTP 运行配置</div>
                <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">发信总览</h2>
              </div>
              <div className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] ${draft.enabled ? 'bg-green-50 text-green-600' : 'bg-zinc-100 text-zinc-500'}`}>{draft.enabled ? '已启用' : '已停用'}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FieldRow label="runtime enabled" description="关闭后将停止使用数据库中的动态邮件配置。">
                <button type="button" onClick={() => updateDraft('enabled', !draft.enabled)} className={`w-full rounded-[1.6rem] border px-5 py-4 text-left text-sm font-bold transition-all ${draft.enabled ? 'border-green-200 bg-green-50 text-green-700' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500'}`}>
                  {draft.enabled ? '动态邮件配置已启用' : '动态邮件配置已停用'}
                </button>
              </FieldRow>

              <FieldRow label="smtp secure" description="465 常见为 true，25 / 587 常见为 false。当前服务器已实测开放 25 / 465 / 587。">
                <button type="button" onClick={() => updateDraft('smtpSecure', !draft.smtpSecure)} className={`w-full rounded-[1.6rem] border px-5 py-4 text-left text-sm font-bold transition-all ${draft.smtpSecure ? 'border-black bg-black text-white' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500'}`}>
                  {draft.smtpSecure ? '启用加密 SMTP' : '普通 SMTP / STARTTLS'}
                </button>
              </FieldRow>

              <FieldRow label="allow invalid tls cert" description="当 mail.0st.top 使用自签名或当前系统不信任的证书时启用。">
                <button type="button" onClick={() => updateDraft('smtpAllowInvalidCert', !draft.smtpAllowInvalidCert)} className={`w-full rounded-[1.6rem] border px-5 py-4 text-left text-sm font-bold transition-all ${draft.smtpAllowInvalidCert ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500'}`}>
                  {draft.smtpAllowInvalidCert ? '允许自签名证书' : '严格校验证书'}
                </button>
              </FieldRow>

              <FieldRow label="smtp host" description="当前正式链路使用 mail.0st.top。">{renderInput('smtpHost', 'mail.0st.top')}</FieldRow>
              <FieldRow label="smtp port" description="推荐 587 STARTTLS 或 465 SSL。">{renderInput('smtpPort', '587', { numeric: true })}</FieldRow>
              <FieldRow label="smtp user" description="外部 SMTP 登录账号。">{renderInput('smtpUser', 'testuser@0st.top')}</FieldRow>
              <FieldRow label="smtp password" description="留空将保留已存密码。">{renderInput('smtpPass', 'smtp password / app password')}</FieldRow>
              <FieldRow label="email from" description="系统验证码、通知邮件的发件人。">{renderInput('emailFrom', 'testuser@0st.top')}</FieldRow>
              <FieldRow label="contact email" description="邮件模板页脚中的联系邮箱。">{renderInput('contactEmail', 'support@0st.top')}</FieldRow>
              <FieldRow label="contact phone" description="可选，展示在邮件页脚。">{renderInput('contactPhone', '+86 400-100-8888')}</FieldRow>
              <FieldRow label="email base url" description="验证码/重置密码邮件里的跳转基地址。">{renderInput('emailBaseUrl', 'http://mc-u.top')}</FieldRow>
            </div>
          </section>

          <section className={cardClassName}>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">运行状态</div>
              <h2 className="text-3xl font-black tracking-tighter uppercase italic">当前生效配置</h2>
            </div>

            <div className="space-y-3">
              {[
                ['source', data?.effective?.source || 'none'],
                ['configured', data?.effective?.configured ? 'yes' : 'no'],
                ['enabled', data?.effective?.enabled ? 'yes' : 'no'],
                ['system config', data?.effective?.diagnostics?.usingSystemConfig ? 'on' : 'off'],
                ['env fallback', data?.effective?.diagnostics?.usingEnvFallback ? 'on' : 'off'],
                ['support email', data?.effective?.meta?.contactEmail || 'missing'],
                ['templates', libraryQuery.data?.templates?.length ?? 0],
                ['recipient groups', libraryQuery.data?.recipientGroups?.length ?? 0],
                ['schedules', libraryQuery.data?.schedules?.length ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50/70 px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-300">{label}</div>
                  <div className="mt-2 break-all text-sm font-bold text-zinc-700">{value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-[1.8rem] border border-zinc-100 bg-white p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-zinc-900">服务器现状</div>
                  <p className="text-xs font-bold leading-6 text-zinc-500">
                    远端 `103.236.92.10` 当前已实测开启 `25/465/587/993/995`。项目内测试邮件、推广邮件、维护通知均已通过 `mail.0st.top:587` 成功发信。
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className={cardClassName}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">测试发信</div>
              <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">发送探针</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FieldRow label="recipient email">
              <input value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="you@example.com" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
            </FieldRow>
            <FieldRow label="subject">
              <input value={testSubject} onChange={(event) => setTestSubject(event.target.value)} placeholder="QianFu Mail Test" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
            </FieldRow>
            <FieldRow label="message">
              <textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} rows={4} placeholder="输入测试内容" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
            </FieldRow>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => testMutation.mutate()} disabled={testMutation.isPending || !testTo.trim()} className="rounded-[2rem] btn-accent px-8 py-4 text-[11px] font-black uppercase tracking-[0.35em] text-white shadow-2xl shadow-accent/20 disabled:opacity-50">
              <span className="inline-flex items-center gap-3"><Send className="h-4 w-4" /> {testMutation.isPending ? '发送中…' : '发送测试邮件'}</span>
            </button>
          </div>
        </section>

        <section className={cardClassName}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">群发操作</div>
              <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">群发与通知</h2>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-300">当前收件人数 {broadcastRecipientsList.length}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            {([
              ['product', '产品推广'],
              ['maintenance', '维护通知'],
              ['custom', '自定义通知'],
            ] as const).map(([mode, label]) => (
              <button key={mode} type="button" onClick={() => applyBroadcastPreset(mode)} className={`rounded-full px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] transition-all ${broadcastMode === mode ? 'bg-black text-white' : 'border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900'}`}>
                {label}
              </button>
            ))}
          </div>

          {libraryQuery.data?.recipientGroups?.length ? (
            <div className="rounded-[1.8rem] border border-zinc-100 bg-zinc-50/60 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-300">快速套用收件组</div>
              <div className="mt-3 flex flex-wrap gap-3">
                {libraryQuery.data.recipientGroups.map((group) => (
                  <button key={group.key} type="button" onClick={() => applyGroupToBroadcast(group)} className={`rounded-full px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] transition-all ${selectedGroupKey === group.key ? 'bg-black text-white' : 'border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900'}`}>
                    {group.name} / {group.recipients.length}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <FieldRow label="recipients" description="支持换行、逗号、分号分隔。单次最多 200 个，系统会自动去重并分批 BCC 发送。">
              <textarea value={broadcastRecipients} onChange={(event) => setBroadcastRecipients(event.target.value)} rows={7} placeholder={'customer1@example.com\ncustomer2@example.com'} className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm font-mono outline-hidden transition-all focus:border-accent focus:bg-white" />
            </FieldRow>

            <div className="space-y-8">
              <FieldRow label="subject">
                <input value={broadcastSubject} onChange={(event) => setBroadcastSubject(event.target.value)} placeholder="新产品发布通知" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
              </FieldRow>
              <FieldRow label="cta label" description="可选，通知按钮文案。">
                <input value={broadcastCtaLabel} onChange={(event) => setBroadcastCtaLabel(event.target.value)} placeholder="立即查看" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
              </FieldRow>
              <FieldRow label="cta link">
                <input value={broadcastCtaLink} onChange={(event) => setBroadcastCtaLink(event.target.value)} placeholder="http://mc-u.top" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
              </FieldRow>
            </div>
          </div>

          <FieldRow label="message body" description="纯文本输入即可，系统会自动转换换行并套用标准邮件模板。">
            <textarea value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value)} rows={8} placeholder="输入通知正文" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
          </FieldRow>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => broadcastMutation.mutate()}
              disabled={broadcastMutation.isPending || !broadcastRecipientsList.length || !broadcastSubject.trim() || !broadcastMessage.trim()}
              className="rounded-[2rem] btn-accent px-8 py-4 text-[11px] font-black uppercase tracking-[0.35em] text-white shadow-2xl shadow-accent/20 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-3"><Send className="h-4 w-4" /> {broadcastMutation.isPending ? '发送中…' : '发送群发'}</span>
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          <section className={cardClassName}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">模板库</div>
                <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">模板列表</h2>
              </div>
              <button type="button" onClick={() => setTemplateDraft(EMPTY_TEMPLATE)} className="rounded-full border border-zinc-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-900">
                新建
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
              <div className="space-y-3">
                {(libraryQuery.data?.templates || []).map((template) => (
                  <button key={template.key} type="button" onClick={() => setTemplateDraft(template)} className={`w-full rounded-[1.6rem] border px-4 py-4 text-left transition-all ${templateDraft.key === template.key ? 'border-black bg-black text-white' : 'border-zinc-100 bg-zinc-50/70 text-zinc-600 hover:border-zinc-200 hover:bg-white'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black uppercase tracking-[0.18em]">{template.name}</div>
                      <div className={`text-[9px] font-black uppercase tracking-[0.24em] ${templateDraft.key === template.key ? 'text-white/50' : 'text-zinc-300'}`}>{template.mode}</div>
                    </div>
                    <p className={`mt-2 text-xs font-bold leading-5 ${templateDraft.key === template.key ? 'text-white/70' : 'text-zinc-400'}`}>{template.subject}</p>
                  </button>
                ))}
                {!libraryQuery.data?.templates?.length ? (
                  <div className="rounded-[1.6rem] border border-dashed border-zinc-200 bg-zinc-50/40 px-4 py-6 text-sm font-bold text-zinc-400">
                    还没有邮件模板，先保存一个推广或维护模板。
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <FieldRow label="template key">
                  <input value={templateDraft.key} onChange={(event) => setTemplateDraft((current) => ({ ...current, key: event.target.value }))} placeholder="product_launch" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="template name">
                  <input value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="产品推广模板" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="mode">
                  <select value={templateDraft.mode} onChange={(event) => setTemplateDraft((current) => ({ ...current, mode: event.target.value as BroadcastMode }))} className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white">
                    <option value="product">product</option>
                    <option value="maintenance">maintenance</option>
                    <option value="custom">custom</option>
                  </select>
                </FieldRow>
                <FieldRow label="subject">
                  <input value={templateDraft.subject} onChange={(event) => setTemplateDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="新产品发布通知" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="message">
                  <textarea value={templateDraft.message} onChange={(event) => setTemplateDraft((current) => ({ ...current, message: event.target.value }))} rows={6} placeholder="模板正文" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="cta">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input value={templateDraft.ctaLabel || ''} onChange={(event) => setTemplateDraft((current) => ({ ...current, ctaLabel: event.target.value }))} placeholder="立即查看" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                    <input value={templateDraft.ctaLink || ''} onChange={(event) => setTemplateDraft((current) => ({ ...current, ctaLink: event.target.value }))} placeholder="http://mc-u.top" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                  </div>
                </FieldRow>
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => applyTemplateToBroadcast(templateDraft)} disabled={!templateDraft.subject || !templateDraft.message} className="rounded-[2rem] border border-zinc-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50">应用到群发</button>
                  <button type="button" onClick={() => templateDraft.key && deleteTemplateMutation.mutate(templateDraft.key)} disabled={deleteTemplateMutation.isPending || !templateDraft.key} className="rounded-[2rem] border border-red-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-red-500 disabled:opacity-50">
                    <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" /> 删除模板</span>
                  </button>
                  <button type="button" onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending || !templateDraft.key || !templateDraft.name || !templateDraft.subject || !templateDraft.message} className="rounded-[2rem] btn-accent px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-accent/20 disabled:opacity-50">保存模板</button>
                </div>
              </div>
            </div>
          </section>

          <section className={cardClassName}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">收件组</div>
                <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">收件组列表</h2>
              </div>
              <button type="button" onClick={() => { setGroupDraft(EMPTY_GROUP); setGroupRecipientsText(''); }} className="rounded-full border border-zinc-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-900">
                新建
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
              <div className="space-y-3">
                {(libraryQuery.data?.recipientGroups || []).map((group) => (
                  <button key={group.key} type="button" onClick={() => { setGroupDraft(group); setGroupRecipientsText(group.recipients.join('\n')); }} className={`w-full rounded-[1.6rem] border px-4 py-4 text-left transition-all ${groupDraft.key === group.key ? 'border-black bg-black text-white' : 'border-zinc-100 bg-zinc-50/70 text-zinc-600 hover:border-zinc-200 hover:bg-white'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black uppercase tracking-[0.18em]">{group.name}</div>
                      <div className={`text-[9px] font-black uppercase tracking-[0.24em] ${groupDraft.key === group.key ? 'text-white/50' : 'text-zinc-300'}`}>{group.recipients.length}</div>
                    </div>
                    <p className={`mt-2 text-xs font-bold leading-5 ${groupDraft.key === group.key ? 'text-white/70' : 'text-zinc-400'}`}>{group.description || group.key}</p>
                  </button>
                ))}
                {!libraryQuery.data?.recipientGroups?.length ? (
                  <div className="rounded-[1.6rem] border border-dashed border-zinc-200 bg-zinc-50/40 px-4 py-6 text-sm font-bold text-zinc-400">
                    还没有收件组，可以先保存客户分组或维护通知分组。
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <FieldRow label="group key">
                  <input value={groupDraft.key} onChange={(event) => setGroupDraft((current) => ({ ...current, key: event.target.value }))} placeholder="vip_customers" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="group name">
                  <input value={groupDraft.name} onChange={(event) => setGroupDraft((current) => ({ ...current, name: event.target.value }))} placeholder="VIP 客户" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="description">
                  <input value={groupDraft.description || ''} onChange={(event) => setGroupDraft((current) => ({ ...current, description: event.target.value }))} placeholder="高价值客户批量推送组" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="recipients">
                  <textarea value={groupRecipientsText} onChange={(event) => setGroupRecipientsText(event.target.value)} rows={8} placeholder={'customer1@example.com\ncustomer2@example.com'} className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm font-mono outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.csv,.txt';
                      input.onchange = async () => {
                        const file = input.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        const emails = Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((item) => item.trim().toLowerCase())));
                        setGroupRecipientsText(emails.join('\n'));
                        toast({ title: 'CSV 已导入', description: `已提取 ${emails.length} 个邮箱地址。` });
                      };
                      input.click();
                    }}
                    className="rounded-[2rem] border border-zinc-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                  >
                    CSV 导入
                  </button>
                  <button type="button" onClick={() => applyGroupToBroadcast({ ...groupDraft, recipients: groupDraftRecipients })} disabled={!groupDraftRecipients.length} className="rounded-[2rem] border border-zinc-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50">应用到群发</button>
                  <button type="button" onClick={() => groupDraft.key && deleteGroupMutation.mutate(groupDraft.key)} disabled={deleteGroupMutation.isPending || !groupDraft.key} className="rounded-[2rem] border border-red-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-red-500 disabled:opacity-50">
                    <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" /> 删除收件组</span>
                  </button>
                  <button type="button" onClick={() => saveGroupMutation.mutate()} disabled={saveGroupMutation.isPending || !groupDraft.key || !groupDraft.name || !groupDraftRecipients.length} className="rounded-[2rem] btn-accent px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-accent/20 disabled:opacity-50">保存收件组</button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          <section className={cardClassName}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">定时任务</div>
                <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">任务列表</h2>
              </div>
              <button type="button" onClick={() => { setScheduleDraft(EMPTY_SCHEDULE); setScheduleRecipientsText(''); }} className="rounded-full border border-zinc-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-900">
                新建
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
              <div className="space-y-3">
                {(libraryQuery.data?.schedules || []).map((schedule) => (
                  <button key={schedule.key} type="button" onClick={() => { setScheduleDraft(schedule); setScheduleRecipientsText(schedule.recipients.join('\n')); }} className={`w-full rounded-[1.6rem] border px-4 py-4 text-left transition-all ${scheduleDraft.key === schedule.key ? 'border-black bg-black text-white' : 'border-zinc-100 bg-zinc-50/70 text-zinc-600 hover:border-zinc-200 hover:bg-white'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black uppercase tracking-[0.18em]">{schedule.name}</div>
                      <div className={`text-[9px] font-black uppercase tracking-[0.24em] ${scheduleDraft.key === schedule.key ? 'text-white/50' : 'text-zinc-300'}`}>{schedule.scheduleType}</div>
                    </div>
                    <p className={`mt-2 text-xs font-bold leading-5 ${scheduleDraft.key === schedule.key ? 'text-white/70' : 'text-zinc-400'}`}>
                      {schedule.scheduleType === 'once' ? schedule.onceAt || '缺少执行时间' : `${schedule.dailyTime || '00:00'} / ${schedule.timezone || 'Asia/Shanghai'}`}
                    </p>
                    <p className={`mt-2 text-[11px] font-bold leading-5 ${scheduleDraft.key === schedule.key ? 'text-white/60' : 'text-zinc-300'}`}>
                      下次执行：{buildNextRunPreview(schedule)}
                    </p>
                  </button>
                ))}
                {!libraryQuery.data?.schedules?.length ? (
                  <div className="rounded-[1.6rem] border border-dashed border-zinc-200 bg-zinc-50/40 px-4 py-6 text-sm font-bold text-zinc-400">
                    还没有定时任务。你可以配置每日维护通知，或一次性产品推广任务。
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <FieldRow label="schedule key">
                  <input value={scheduleDraft.key} onChange={(event) => setScheduleDraft((current) => ({ ...current, key: event.target.value }))} placeholder="night_maintenance" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="schedule name">
                  <input value={scheduleDraft.name} onChange={(event) => setScheduleDraft((current) => ({ ...current, name: event.target.value }))} placeholder="夜间维护通知" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldRow label="enabled">
                    <button type="button" onClick={() => setScheduleDraft((current) => ({ ...current, enabled: !current.enabled }))} className={`w-full rounded-[1.6rem] border px-5 py-4 text-left text-sm font-bold transition-all ${scheduleDraft.enabled ? 'border-green-200 bg-green-50 text-green-700' : 'border-zinc-100 bg-zinc-50/70 text-zinc-500'}`}>
                      {scheduleDraft.enabled ? '已启用' : '已停用'}
                    </button>
                  </FieldRow>
                  <FieldRow label="mode">
                    <select value={scheduleDraft.mode} onChange={(event) => setScheduleDraft((current) => ({ ...current, mode: event.target.value as BroadcastMode }))} className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white">
                      <option value="product">product</option>
                      <option value="maintenance">maintenance</option>
                      <option value="custom">custom</option>
                    </select>
                  </FieldRow>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldRow label="schedule type">
                    <select value={scheduleDraft.scheduleType} onChange={(event) => setScheduleDraft((current) => ({ ...current, scheduleType: event.target.value as 'once' | 'daily' }))} className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white">
                      <option value="daily">daily</option>
                      <option value="once">once</option>
                    </select>
                  </FieldRow>
                  <FieldRow label="timezone">
                    <input value={scheduleDraft.timezone || ''} onChange={(event) => setScheduleDraft((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Shanghai" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                  </FieldRow>
                </div>
                {scheduleDraft.scheduleType === 'daily' ? (
                  <FieldRow label="daily time" description="24 小时制，按上面 timezone 解释。">
                    <input value={scheduleDraft.dailyTime || ''} onChange={(event) => setScheduleDraft((current) => ({ ...current, dailyTime: event.target.value }))} placeholder="22:00" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                  </FieldRow>
                ) : (
                  <FieldRow label="once at" description="ISO 时间，例如 2026-05-18T22:00:00+08:00">
                    <input value={scheduleDraft.onceAt || ''} onChange={(event) => setScheduleDraft((current) => ({ ...current, onceAt: event.target.value }))} placeholder="2026-05-18T22:00:00+08:00" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                  </FieldRow>
                )}
                <FieldRow label="recipients" description="直接收件人；也可以只绑定收件组。">
                  <textarea value={scheduleRecipientsText} onChange={(event) => setScheduleRecipientsText(event.target.value)} rows={5} placeholder={'customer1@example.com\ncustomer2@example.com'} className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm font-mono outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="recipient groups" description="输入收件组 key，换行或逗号分隔。">
                  <input value={(scheduleDraft.recipientGroupKeys || []).join(', ')} onChange={(event) => setScheduleDraft((current) => ({ ...current, recipientGroupKeys: event.target.value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean) }))} placeholder="vip_customers, ops_team" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="subject">
                  <input value={scheduleDraft.subject} onChange={(event) => setScheduleDraft((current) => ({ ...current, subject: event.target.value }))} placeholder="系统维护通知" className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <FieldRow label="message">
                  <textarea value={scheduleDraft.message} onChange={(event) => setScheduleDraft((current) => ({ ...current, message: event.target.value }))} rows={5} placeholder="系统将在今晚 10 点进行维护..." className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white" />
                </FieldRow>
                <div className="rounded-[1.6rem] border border-zinc-100 bg-zinc-50/60 px-5 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-300">执行预览</div>
                  <div className="mt-2 text-sm font-bold text-zinc-700">{buildNextRunPreview(scheduleDraft)}</div>
                  {scheduleDraft.lastRunAt ? <div className="mt-2 text-xs font-bold text-zinc-400">上次执行：{formatTimestamp(scheduleDraft.lastRunAt)}</div> : null}
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => scheduleDraft.key && deleteScheduleMutation.mutate(scheduleDraft.key)} disabled={deleteScheduleMutation.isPending || !scheduleDraft.key} className="rounded-[2rem] border border-red-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-red-500 disabled:opacity-50">
                    <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" /> 删除任务</span>
                  </button>
                  <button type="button" onClick={() => saveScheduleMutation.mutate()} disabled={saveScheduleMutation.isPending || !scheduleDraft.key || !scheduleDraft.name || !scheduleDraft.subject || !scheduleDraft.message} className="rounded-[2rem] btn-accent px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-accent/20 disabled:opacity-50">保存任务</button>
                </div>
              </div>
            </div>
          </section>

          <section className={cardClassName}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">导入 / 导出</div>
                <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">模板库 JSON</h2>
              </div>
            </div>

            <FieldRow label="export json" description="当前模板、收件组、定时任务的完整 JSON。可直接复制备份。">
              <textarea value={exportLibraryJson} readOnly rows={12} className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-xs font-mono outline-hidden" />
            </FieldRow>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(exportLibraryJson);
                  toast({ title: '导出 JSON 已复制', description: '当前模板、收件组与定时任务 JSON 已复制到剪贴板。' });
                }}
                className="rounded-[2rem] border border-zinc-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
              >
                复制导出 JSON
              </button>
            </div>

            <FieldRow label="import json" description="粘贴包含 templates / recipientGroups / schedules 的 JSON，导入时会按 key 覆盖同名项。">
              <textarea value={libraryImportText} onChange={(event) => setLibraryImportText(event.target.value)} rows={12} placeholder='{"templates":[],"recipientGroups":[],"schedules":[]}' className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-xs font-mono outline-hidden transition-all focus:border-accent focus:bg-white" />
            </FieldRow>

            <div className="flex justify-end">
              <button type="button" onClick={() => importLibraryMutation.mutate()} disabled={importLibraryMutation.isPending || !libraryImportText.trim()} className="rounded-[2rem] btn-accent px-6 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-2xl shadow-accent/20 disabled:opacity-50">
                {importLibraryMutation.isPending ? '导入中…' : '导入模板库'}
              </button>
            </div>
          </section>
        </div>

        <section className={cardClassName}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">发送历史</div>
              <h2 className="mt-2 text-3xl font-black tracking-tighter uppercase italic">历史记录</h2>
            </div>
            <button type="button" onClick={() => libraryQuery.refetch()} className="rounded-full border border-zinc-200 px-4 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-900">
              刷新
            </button>
          </div>

          <div className="space-y-3">
            {(libraryQuery.data?.history || []).map((item) => (
              <div key={item.id} className="rounded-[1.8rem] border border-zinc-100 bg-zinc-50/70 px-5 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-white px-3 py-2 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500">{item.kind}</span>
                    {item.mode ? <span className="rounded-full bg-white px-3 py-2 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-400">{item.mode}</span> : null}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">{item.totalRecipients} 个收件人</span>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-3 text-sm font-black uppercase tracking-[0.16em] text-zinc-900">{item.subject}</div>
                <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{item.messagePreview}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-bold text-zinc-400">
                  <span>来源：{item.source}</span>
                  <span>操作人：{item.operator || 'admin'}</span>
                </div>
              </div>
            ))}
            {!libraryQuery.data?.history?.length ? (
              <div className="rounded-[1.8rem] border border-dashed border-zinc-200 bg-zinc-50/40 px-5 py-8 text-center text-sm font-bold text-zinc-400">
                还没有发送历史。先发一封测试邮件或批量通知，这里就会出现记录。
              </div>
            ) : null}
          </div>
        </section>
      </StatusWrapper>
    </div>
  );
};

export default AdminMailConfig;

