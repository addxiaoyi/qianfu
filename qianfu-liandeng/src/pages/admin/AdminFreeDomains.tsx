import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ExternalLink, Link2Off, Plus, RefreshCcw, Save } from 'lucide-react';
import { api } from '@/api/request';
import AdminPageHeader from '@/components/ui/AdminPageHeader';
import StatusWrapper from '@/components/ui/StatusWrapper';

type Provider = 'CLOUDFLARE' | 'ALIYUN';

type Suffix = {
  id: number;
  suffix: string;
  provider: Provider;
  enabled: boolean;
  prefix_pattern: string;
  ttl: number;
  quota_per_user: number;
  reserved_words: string[];
  credentialConfigured: boolean;
  oauthConfigured?: boolean;
};

type PolicyDraft = Pick<Suffix, 'suffix' | 'provider' | 'enabled' | 'prefix_pattern' | 'ttl' | 'quota_per_user' | 'reserved_words'>;

type CredentialDraft = {
  cloudflare_api_token?: string;
  cloudflare_zone_id?: string;
  aliyun_access_key_id?: string;
  aliyun_access_key_secret?: string;
  aliyun_region_id?: string;
};

type DnsTask = {
  id: number;
  action: string;
  status: string;
  attempts: number;
  last_error?: string | null;
  server_domain: { domain: string; target: string; dns_status: string };
};

const DEFAULT_PREFIX_PATTERN = '^[a-z][a-z0-9-]{2,15}$';
const DEFAULT_TTL = 300;
const DEFAULT_QUOTA = 1;
const DEFAULT_RESERVED_WORDS = [
  'admin', 'api', 'www', 'mail', 'ftp', 'ns1', 'ns2', 'root', 'owner', 'support',
  'help', 'status', 'dashboard', 'login', 'register', 'auth', 'oauth', 'cloudflare',
  'alidns', 'dns', 'minecraft', 'mc', 'play', 'server', 'servers', 'store', 'shop',
  'blog', 'test', 'demo',
];

const emptyPolicy = (): PolicyDraft => ({
  suffix: '',
  provider: 'CLOUDFLARE',
  enabled: true,
  prefix_pattern: DEFAULT_PREFIX_PATTERN,
  ttl: DEFAULT_TTL,
  quota_per_user: DEFAULT_QUOTA,
  reserved_words: DEFAULT_RESERVED_WORDS,
});

const policyFromSuffix = (item: Suffix): PolicyDraft => ({
  suffix: item.suffix,
  provider: item.provider,
  enabled: item.enabled,
  prefix_pattern: item.prefix_pattern,
  ttl: item.ttl,
  quota_per_user: item.quota_per_user,
  reserved_words: item.reserved_words ?? [],
});

const providerOptions: Array<{ value: Provider; label: string; hint: string }> = [
  { value: 'CLOUDFLARE', label: 'Cloudflare', hint: 'Token + Zone ID' },
  { value: 'ALIYUN', label: '阿里云 DNS', hint: 'AccessKey + Region' },
];

const ProviderMenu = ({ value, onChange }: { value: Provider; onChange: (provider: Provider) => void }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = providerOptions.find((option) => option.value === value) ?? providerOptions[0];

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selectProvider = (provider: Provider) => {
    onChange(provider);
    setOpen(false);
  };

  return <div ref={menuRef} className="relative mt-1">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }} className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200">
      <span><span className="block font-semibold">{selected.label}</span><span className="block text-xs text-zinc-400">{selected.hint}</span></span><ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="listbox" aria-label="DNS 服务商选项" className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-xl">
      {providerOptions.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => selectProvider(option.value)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-50">
        <span><span className="block font-semibold text-zinc-900">{option.label}</span><span className="block text-xs text-zinc-400">{option.hint}</span></span>{option.value === value && <Check className="h-4 w-4 text-emerald-600" />}
      </button>)}
    </div>}
  </div>;
};

const credentialFields = (provider: Provider, draft: CredentialDraft, update: (field: keyof CredentialDraft, value: string) => void, configured: boolean) => provider === 'CLOUDFLARE' ? <>
  <label className="text-xs font-bold text-zinc-500">Cloudflare API Token<input type="password" autoComplete="new-password" value={draft.cloudflare_api_token ?? ''} onChange={(event) => update('cloudflare_api_token', event.target.value)} placeholder={configured ? '已配置，留空保持不变' : '输入 Token'} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
  <label className="text-xs font-bold text-zinc-500">Cloudflare Zone ID<input value={draft.cloudflare_zone_id ?? ''} onChange={(event) => update('cloudflare_zone_id', event.target.value)} placeholder={configured ? '已配置，留空保持不变' : '输入 Zone ID'} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
</> : <>
  <label className="text-xs font-bold text-zinc-500">阿里云 AccessKey ID<input value={draft.aliyun_access_key_id ?? ''} onChange={(event) => update('aliyun_access_key_id', event.target.value)} placeholder={configured ? '已配置，留空保持不变' : '输入 AccessKey ID'} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
  <label className="text-xs font-bold text-zinc-500">阿里云 AccessKey Secret<input type="password" autoComplete="new-password" value={draft.aliyun_access_key_secret ?? ''} onChange={(event) => update('aliyun_access_key_secret', event.target.value)} placeholder={configured ? '已配置，留空保持不变' : '输入 AccessKey Secret'} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
  <label className="text-xs font-bold text-zinc-500">阿里云 Region ID<input value={draft.aliyun_region_id ?? ''} onChange={(event) => update('aliyun_region_id', event.target.value)} placeholder={configured ? '已配置，留空保持不变' : '例如 cn-hangzhou'} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
</>;

const AdminFreeDomains: React.FC = () => {
  const client = useQueryClient();
  const [policyDrafts, setPolicyDrafts] = useState<Record<number, PolicyDraft>>({});
  const [credentialDrafts, setCredentialDrafts] = useState<Record<number, CredentialDraft>>({});
  const [newPolicy, setNewPolicy] = useState<PolicyDraft>(emptyPolicy);
  const [newCredentials, setNewCredentials] = useState<CredentialDraft>({});
  const query = useQuery({ queryKey: ['admin-free-domains'], queryFn: () => api.get<Suffix[]>('/admin/free-domain-suffixes') });
  const tasks = useQuery({ queryKey: ['admin-dns-tasks'], queryFn: () => api.get<DnsTask[]>('/admin/dns-tasks') });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('oauth')) return;
    params.delete('oauth');
    window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`);
  }, []);

  const refresh = () => {
    void query.refetch();
    void tasks.refetch();
  };

  const save = useMutation({
    mutationFn: ({ id, policy, credentials }: { id: number; policy: PolicyDraft; credentials: CredentialDraft }) => api.put(`/admin/free-domain-suffixes/${id}`, { ...policy, ...credentials }),
    onSuccess: (_data, variables) => {
      setCredentialDrafts((current) => ({ ...current, [variables.id]: {} }));
      void client.invalidateQueries({ queryKey: ['admin-free-domains'] });
    },
  });

  const create = useMutation({
    mutationFn: () => api.post('/admin/free-domain-suffixes', { ...newPolicy, ...newCredentials }),
    onSuccess: () => {
      setNewPolicy(emptyPolicy());
      setNewCredentials({});
      void client.invalidateQueries({ queryKey: ['admin-free-domains'] });
    },
  });

  const run = useMutation({
    mutationFn: () => api.post('/admin/dns-tasks/run'),
    onSuccess: refresh,
  });

  const revokeOauth = useMutation({
    mutationFn: (id: number) => api.post(`/admin/free-domain-suffixes/${id}/oauth/cloudflare/revoke`),
    onSuccess: refresh,
  });

  const updatePolicy = (id: number, field: keyof PolicyDraft, value: string | number | boolean | string[]) => {
    const suffix = query.data?.find((item) => item.id === id);
    if (!suffix) return;
    setPolicyDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? policyFromSuffix(suffix)), [field]: value },
    }));
  };

  const updateCredential = (id: number, field: keyof CredentialDraft, value: string) => {
    setCredentialDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  };

  const updateNewCredential = (field: keyof CredentialDraft, value: string) => {
    setNewCredentials((current) => ({ ...current, [field]: value }));
  };

  const renderPolicyFields = (policy: PolicyDraft, onChange: (field: keyof PolicyDraft, value: string | number | boolean | string[]) => void, disabledSuffix = false) => <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
    <label className="text-xs font-bold text-zinc-500 md:col-span-2">域名后缀<input value={policy.suffix} disabled={disabledSuffix} onChange={(event) => onChange('suffix', event.target.value)} placeholder="例如 mc.example.com" className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100" /></label>
    <label className="text-xs font-bold text-zinc-500">DNS 服务商<ProviderMenu value={policy.provider} onChange={(provider) => onChange('provider', provider)} /></label>
    <label className="text-xs font-bold text-zinc-500">TTL（秒）<input type="number" min={60} max={86400} value={policy.ttl} onChange={(event) => onChange('ttl', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
    <label className="text-xs font-bold text-zinc-500">用户配额<input type="number" min={1} max={1000} value={policy.quota_per_user} onChange={(event) => onChange('quota_per_user', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
    <label className="text-xs font-bold text-zinc-500 md:col-span-3">前缀规则<input value={policy.prefix_pattern} onChange={(event) => onChange('prefix_pattern', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
    <label className="text-xs font-bold text-zinc-500 md:col-span-2">保留词（逗号分隔）<input value={policy.reserved_words.join(', ')} onChange={(event) => onChange('reserved_words', event.target.value.split(',').map((word) => word.trim()).filter(Boolean))} placeholder="admin, api, www" className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900" /></label>
    <label className="flex items-end gap-2 pb-2 text-xs font-bold text-zinc-500"><input type="checkbox" checked={policy.enabled} onChange={(event) => onChange('enabled', event.target.checked)} className="h-4 w-4 accent-black" />启用后缀</label>
  </div>;

  return <div className="space-y-10 pb-20">
    <StatusWrapper isLoading={query.isLoading || tasks.isLoading} isError={query.isError || tasks.isError} onRetry={refresh}>
      <AdminPageHeader badge="DNS / CONTROL PLANE" title="免费域名 DNS" description="管理可申请的免费域名后缀、前缀规则、TTL、用户配额和 DNS 服务商凭证。解析任务在审核通过后异步执行。" statusLabel={`${query.data?.length ?? 0} 个后缀`} rightSlot={<button type="button" onClick={() => run.mutate()} disabled={run.isPending} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><RefreshCcw className="h-4 w-4" />执行待处理任务</button>} />

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">新增域名后缀</h2><p className="mt-1 text-sm text-zinc-500">先创建后缀，再配置对应 DNS 服务商凭证。密钥不会回显。</p></div><button type="button" onClick={() => create.mutate()} disabled={create.isPending || !newPolicy.suffix.trim()} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" />{create.isPending ? '保存中' : '创建后缀'}</button></div>
        {renderPolicyFields(newPolicy, (field, value) => setNewPolicy((current) => ({ ...current, [field]: value })))}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 md:grid-cols-3">{credentialFields(newPolicy.provider, newCredentials, updateNewCredential, false)}</div>
      </section>

      <div className="grid gap-4">
        {query.data?.map((item) => {
          const policy = policyDrafts[item.id] ?? policyFromSuffix(item);
          const credentials = credentialDrafts[item.id] ?? {};
          return <section key={item.id} className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">{item.suffix}</h2><p className="text-xs text-zinc-500">{policy.provider} · TTL {policy.ttl}s · 每用户 {policy.quota_per_user} 个</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.credentialConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.credentialConfigured ? '服务商已配置' : '尚未配置凭证'}</span><button type="button" onClick={() => save.mutate({ id: item.id, policy, credentials })} disabled={save.isPending} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold disabled:opacity-50"><Save className="h-3 w-3" />保存</button></div></div>
            {renderPolicyFields(policy, (field, value) => updatePolicy(item.id, field, value), true)}
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 md:grid-cols-3">
              {policy.provider === 'CLOUDFLARE' && <div className="flex items-center gap-2 md:col-span-3">
                <button type="button" onClick={() => window.location.assign(`/api/v1/admin/free-domain-suffixes/${item.id}/oauth/cloudflare/start`)} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white"><ExternalLink className="h-3 w-3" />{item.oauthConfigured ? '重新连接 Cloudflare OAuth' : '连接 Cloudflare OAuth'}</button>
                {item.oauthConfigured && <><span className="text-xs font-bold text-emerald-700">OAuth 已连接，解析将优先使用 OAuth</span><button type="button" onClick={() => revokeOauth.mutate(item.id)} disabled={revokeOauth.isPending} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold"><Link2Off className="h-3 w-3" />解除连接</button></>}
              </div>}
              {credentialFields(policy.provider, credentials, (field, value) => updateCredential(item.id, field, value), item.credentialConfigured)}
            </div>
          </section>;
        })}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="text-lg font-black">DNS 下发任务</h2><div className="mt-4 grid gap-2">{tasks.data?.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 py-3 text-sm"><span className="font-bold">{task.server_domain.domain}</span><span className="text-zinc-500">{task.action} · {task.status} · 重试 {task.attempts}</span>{task.last_error && <span className="text-red-600">{task.last_error}</span>}{task.status === 'FAILED' && <button type="button" onClick={() => { void api.post(`/admin/dns-tasks/${task.id}/retry`).then(() => tasks.refetch()); }} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold">重试</button>}</div>)}{!tasks.data?.length && <p className="py-4 text-sm text-zinc-500">暂无 DNS 任务</p>}</div></section>
    </StatusWrapper>
  </div>;
};

export default AdminFreeDomains;
