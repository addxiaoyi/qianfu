import { CheckCircle2, CircleAlert, LockKeyhole } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import AdminPageHeader from '@/components/ui/AdminPageHeader';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { api } from '@/api/request';

type AiProvider = { name: string; configured: boolean; model: string; endpoint: string; keySource: string };
export type AiAdminConfig = {
  enabled: boolean;
  providers: AiProvider[];
  moderation: { enabled: boolean; model: string; provider: string };
  capabilities: { customerService: boolean; streaming: boolean; contentModeration: boolean };
  secretPolicy: string;
  editable?: {
    openAiBaseUrl: string;
    openAiModel: string;
    openAiKeyConfigured: boolean;
    zhipuBaseUrl: string;
    zhipuModel: string;
    zhipuKeyConfigured: boolean;
    nvidiaBaseUrl: string;
    nvidiaModel: string;
    nvidiaKeyConfigured: boolean;
    moderationEnabled: boolean;
    moderationModel: string;
    aiEnabled: boolean;
    customerServiceEnabled: boolean;
    streamingEnabled: boolean;
  };
};

const Status = ({ enabled }: { enabled: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-amber-700'}`}>
    {enabled ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
    {enabled ? '已启用' : '未启用'}
  </span>
);

export default function AdminAiConfig() {
  const query = useQuery({ queryKey: ['admin-ai-config'], queryFn: () => api.get<AiAdminConfig>('/ai/admin/config'), retry: false });
  const [form, setForm] = useState({ openAiBaseUrl: '', openAiModel: '', openAiKey: '', zhipuBaseUrl: '', zhipuModel: '', zhipuKey: '', nvidiaBaseUrl: '', nvidiaModel: '', nvidiaKey: '', aiEnabled: true, customerServiceEnabled: true, streamingEnabled: true, moderationEnabled: false, moderationModel: '' });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const editable = query.data?.editable;
    if (!editable) return;
    setForm((current) => ({ ...current, openAiBaseUrl: editable.openAiBaseUrl, openAiModel: editable.openAiModel, zhipuBaseUrl: editable.zhipuBaseUrl, zhipuModel: editable.zhipuModel, nvidiaBaseUrl: editable.nvidiaBaseUrl, nvidiaModel: editable.nvidiaModel, aiEnabled: editable.aiEnabled, customerServiceEnabled: editable.customerServiceEnabled, streamingEnabled: editable.streamingEnabled, moderationEnabled: editable.moderationEnabled, moderationModel: editable.moderationModel }));
  }, [query.data?.editable]);

  const updateField = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const saveConfig = async () => {
    setSaving(true); setSaveMessage('');
    try {
      await api.put('/ai/admin/config', form);
      setSaveMessage('配置已保存，后续请求将使用新配置。');
      await query.refetch();
      setForm((current) => ({ ...current, openAiKey: '', zhipuKey: '', nvidiaKey: '' }));
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : '保存失败，请检查字段和服务端日志。'); }
    finally { setSaving(false); }
  };

  return (
    <StatusWrapper isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()}>
      {query.data ? <div className="space-y-6">
        <AdminPageHeader badge="系统设置 / AI" title="AI 配置" description="查看服务端 AI 的实际生效配置与能力状态。密钥只保留在服务端，不会在此展示。" statusLabel={query.data.enabled ? '已启用' : '未启用'} />

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-5 py-4"><h2 className="text-sm font-bold text-zinc-950">服务提供商</h2><p className="mt-1 text-xs text-zinc-500">接口地址、模型和密钥来源均为脱敏后的运行信息。</p></div>
          <div className="divide-y divide-zinc-100">
            {query.data.providers.map((provider) => <div key={provider.name} className="grid gap-3 px-5 py-4 md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center">
              <div><p className="text-sm font-semibold text-zinc-950">{provider.name}</p><p className="mt-1 text-xs text-zinc-500">模型：{provider.model}</p></div>
              <div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">接口地址</p><p className="mt-1 truncate text-xs text-zinc-700" title={provider.endpoint}>{provider.endpoint}</p></div>
              <div><p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">密钥来源</p><p className="mt-1 text-xs text-zinc-700">{provider.keySource}</p></div>
              <Status enabled={provider.configured} />
            </div>)}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-sm font-bold text-zinc-950">编辑运行配置</h2><p className="mt-1 text-xs text-zinc-500">密钥不会回显；密钥输入框留空表示保持当前密钥不变。</p></div><button type="button" onClick={saveConfig} disabled={saving} className="rounded-lg bg-black px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? '保存中…' : '保存配置'}</button></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-zinc-600">OpenAI 兼容接口地址<input value={form.openAiBaseUrl} onChange={(event) => updateField('openAiBaseUrl', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" placeholder="https://api.openai.com/v1" /></label>
            <label className="text-xs font-semibold text-zinc-600">OpenAI 模型<input value={form.openAiModel} onChange={(event) => updateField('openAiModel', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" /></label>
            <label className="text-xs font-semibold text-zinc-600">OpenAI API 密钥<input type="password" value={form.openAiKey} onChange={(event) => updateField('openAiKey', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" placeholder="留空保持原密钥" autoComplete="new-password" /></label>
            <label className="text-xs font-semibold text-zinc-600">智谱 GLM 模型<input value={form.zhipuModel} onChange={(event) => updateField('zhipuModel', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" /></label>
            <label className="text-xs font-semibold text-zinc-600">智谱接口地址<input value={form.zhipuBaseUrl} onChange={(event) => updateField('zhipuBaseUrl', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" placeholder="https://open.bigmodel.cn/api/paas/v4" /></label>
            <label className="text-xs font-semibold text-zinc-600">智谱 API 密钥<input type="password" value={form.zhipuKey} onChange={(event) => updateField('zhipuKey', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" placeholder="留空保持原密钥" autoComplete="new-password" /></label>
            <label className="text-xs font-semibold text-zinc-600">NVIDIA NIM 接口地址<input value={form.nvidiaBaseUrl} onChange={(event) => updateField('nvidiaBaseUrl', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" placeholder="https://integrate.api.nvidia.com/v1" /></label>
            <label className="text-xs font-semibold text-zinc-600">NVIDIA 模型<input value={form.nvidiaModel} onChange={(event) => updateField('nvidiaModel', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" placeholder="meta/llama-3.1-70b-instruct" /></label>
            <label className="text-xs font-semibold text-zinc-600">NVIDIA API 密钥<input type="password" value={form.nvidiaKey} onChange={(event) => updateField('nvidiaKey', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" placeholder="留空保持原密钥" autoComplete="new-password" /></label>
            <label className="text-xs font-semibold text-zinc-600">内容审核模型<input value={form.moderationModel} onChange={(event) => updateField('moderationModel', event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-normal text-zinc-900" /></label>
          </div>
          <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm font-semibold text-zinc-700"><input type="checkbox" checked={form.aiEnabled} onChange={(event) => updateField('aiEnabled', event.target.checked)} className="h-4 w-4 rounded border-zinc-300" />启用 AI 总开关</label>
            <label className="flex items-center gap-3 text-sm font-semibold text-zinc-700"><input type="checkbox" checked={form.customerServiceEnabled} onChange={(event) => updateField('customerServiceEnabled', event.target.checked)} className="h-4 w-4 rounded border-zinc-300" />启用 AI 客服</label>
            <label className="flex items-center gap-3 text-sm font-semibold text-zinc-700"><input type="checkbox" checked={form.streamingEnabled} onChange={(event) => updateField('streamingEnabled', event.target.checked)} className="h-4 w-4 rounded border-zinc-300" />启用流式输出</label>
            <label className="flex items-center gap-3 text-sm font-semibold text-zinc-700"><input type="checkbox" checked={form.moderationEnabled} onChange={(event) => updateField('moderationEnabled', event.target.checked)} className="h-4 w-4 rounded border-zinc-300" />启用内容审核</label>
          </div>
          {saveMessage ? <p className="mt-4 text-sm text-zinc-600" role="status">{saveMessage}</p> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="text-sm font-bold text-zinc-950">内容审核</h2><div className="mt-4 flex items-center justify-between"><span className="text-sm text-zinc-600">审核开关</span><Status enabled={query.data.moderation.enabled} /></div><dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between gap-4"><dt className="text-zinc-500">生效提供商</dt><dd className="text-right text-zinc-800">{query.data.moderation.provider}</dd></div><div className="flex justify-between gap-4"><dt className="text-zinc-500">生效模型</dt><dd className="text-right text-zinc-800">{query.data.moderation.model}</dd></div></dl></article>
          <article className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="text-sm font-bold text-zinc-950">平台能力</h2><div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs"><div><Status enabled={query.data.capabilities.customerService} /><p className="mt-2 text-zinc-500">客服回答</p></div><div><Status enabled={query.data.capabilities.streaming} /><p className="mt-2 text-zinc-500">流式输出</p></div><div><Status enabled={query.data.capabilities.contentModeration} /><p className="mt-2 text-zinc-500">内容审核</p></div></div></article>
        </section>

        <section className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /><p>{query.data.secretPolicy}</p></section>
      </div> : null}
    </StatusWrapper>
  );
}
