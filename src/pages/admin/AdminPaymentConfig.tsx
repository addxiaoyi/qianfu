import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, ImageUp, RefreshCw, Save } from 'lucide-react';
import { api } from '@/api/request';
import CustomSelect from '@/components/ui/CustomSelect';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { toast } from '@/hooks/use-toast';

type UpstreamProvider = 'paypro' | 'xpay' | 'tpay' | 'hupijiao' | 'creem' | 'qiupay' | 'paypal';

type PaymentProjectConfig = {
  key: string;
  displayName: string;
  upstreamProvider: UpstreamProvider;
  downstreamNotifyUrl?: string;
  downstreamNotifySecret?: string;
  bridgeNotifySecret?: string;
  personalQrListenerSecret?: string;
  payProApiUrl?: string;
  payProOpenApiSecret?: string;
  payProNotifyUrl?: string;
  xpayApiUrl?: string;
  xpayToken?: string;
  xpayNotifyUrl?: string;
  xpayGatewayBaseUrl?: string;
  xpayGatewayNotifySecret?: string;
  xpayTenantKey?: string;
  xpayTenantCallbackSecret?: string;
  creemApiBaseUrl?: string;
  creemApiKey?: string;
  creemWebhookSecret?: string;
  creemProductId?: string;
  creemReturnUrl?: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  paypalMode?: string;
  paypalApiBaseUrl?: string;
  paypalReturnUrl?: string;
  paypalCancelUrl?: string;
  paypalExchangeRateCnyPerUsd?: number;
  qiupayBaseUrl?: string;
  qiupayPid?: string;
  qiupayKey?: string;
  qiupayNotifyUrl?: string;
  qiupayReturnUrl?: string;
  tpayGatewayUrl?: string;
  tpayAppId?: string;
  tpayAppSecret?: string;
  tpayQueryUrl?: string;
  hupijiaoGatewayUrl?: string;
  hupijiaoBackupGatewayUrl?: string;
  hupijiaoAppId?: string;
  hupijiaoAppSecret?: string;
  hupijiaoNotifyUrl?: string;
  hupijiaoReturnUrl?: string;
  hupijiaoPlugins?: string;
  hupijiaoVersion?: string;
  maskedSecrets?: Partial<Record<string, string>>;
};

type PaymentProjectStatus = {
  primaryProvider: UpstreamProvider;
  backupProvider: UpstreamProvider | null;
  primaryReady: boolean;
  backupReady: boolean | null;
  downstreamReady: boolean;
  personalBridgeReady: boolean;
  xpayMode: 'tenant-gateway' | 'legacy' | 'none';
  providerReadiness: Record<UpstreamProvider, boolean>;
};

type PaymentProjectRow = {
  key: string;
  config: PaymentProjectConfig | null;
  status: PaymentProjectStatus | null;
  maskedSecrets?: Partial<Record<string, string>>;
  error?: string;
};

type GlobalStatus = {
  supportedProviders: UpstreamProvider[];
  defaults: { projectKey: string; upstreamProvider: string };
};

type PaymentProjectsResponse = { projects: PaymentProjectRow[]; globalStatus: GlobalStatus };

type PaymentProjectDiagnostics = {
  projectKey: string;
  generatedAt: string;
  tests: Array<{ name: string; ok: boolean; detail: string; sample?: string }>;
};

type XpayTenantMethod = { payType?: string; qrImagePath?: string };
type XpayTenantStatus = {
  connected: boolean;
  adminBaseUrl: string;
  tenantKey: string;
  callbackUrl: string;
  paymentMethods: XpayTenantMethod[];
  resolved: {
    xpayMode: 'tenant-gateway' | 'legacy' | 'none';
    gatewayNotifyConfigured: boolean;
    tenantCallbackConfigured: boolean;
  };
};

const MAIN_PROJECT_KEY = 'qianfu';

const PROVIDER_LABELS: Record<UpstreamProvider, string> = {
  paypro: 'PayPro',
  xpay: 'XPay',
  tpay: 'Tpay',
  hupijiao: 'HuPiJiao',
  creem: 'Creem',
  qiupay: 'EPay / 易支付',
  paypal: 'PayPal',
};

const SECRET_FIELDS = new Set<keyof PaymentProjectConfig>([
  'downstreamNotifySecret',
  'bridgeNotifySecret',
  'personalQrListenerSecret',
  'payProOpenApiSecret',
  'xpayToken',
  'xpayGatewayNotifySecret',
  'xpayTenantCallbackSecret',
  'creemApiKey',
  'creemWebhookSecret',
  'paypalClientId',
  'paypalClientSecret',
  'qiupayKey',
  'tpayAppSecret',
  'hupijiaoAppSecret',
]);

const providerOptions = (providers: UpstreamProvider[]) => providers.map((provider) => ({
  value: provider,
  label: PROVIDER_LABELS[provider],
}));

const hasConfiguredValue = (config: PaymentProjectConfig, field: keyof PaymentProjectConfig) =>
  Boolean(config[field] || config.maskedSecrets?.[String(field)]);

const getProviderIssues = (config: PaymentProjectConfig, provider: UpstreamProvider | null | undefined): string[] => {
  if (!provider) return [];
  if (provider === 'paypro') {
    return [!hasConfiguredValue(config, 'payProApiUrl') ? '请填写 PayPro API 地址' : null, !hasConfiguredValue(config, 'payProOpenApiSecret') ? '请填写 PayPro 密钥' : null].filter(Boolean) as string[];
  }
  if (provider === 'xpay') {
    const tenantReady = Boolean(hasConfiguredValue(config, 'xpayGatewayBaseUrl') && hasConfiguredValue(config, 'xpayTenantKey') && hasConfiguredValue(config, 'xpayToken') && hasConfiguredValue(config, 'xpayTenantCallbackSecret'));
    const legacyReady = Boolean(hasConfiguredValue(config, 'xpayApiUrl') && hasConfiguredValue(config, 'xpayToken') && hasConfiguredValue(config, 'xpayNotifyUrl'));
    return tenantReady || legacyReady ? [] : ['XPay 需要填写租户网关四项，或旧版接口三项'];
  }
  if (provider === 'tpay') {
    return [!hasConfiguredValue(config, 'tpayGatewayUrl') ? '请填写 Tpay 网关地址' : null, !hasConfiguredValue(config, 'tpayAppId') ? '请填写 Tpay App ID' : null, !hasConfiguredValue(config, 'tpayAppSecret') ? '请填写 Tpay 密钥' : null].filter(Boolean) as string[];
  }
  if (provider === 'creem') {
    return [!hasConfiguredValue(config, 'creemApiKey') ? '请填写 Creem API Key' : null, !hasConfiguredValue(config, 'creemWebhookSecret') ? '请填写 Webhook 密钥' : null, !hasConfiguredValue(config, 'creemProductId') ? '请填写产品 ID' : null].filter(Boolean) as string[];
  }
  if (provider === 'qiupay') {
    const isVmq = /^https?:\/\/(?:[^/]+\.)?v\.0st\.top(?:\/|$)/i.test(config.qiupayBaseUrl || '');
    return [!hasConfiguredValue(config, 'qiupayBaseUrl') ? '请填写支付网关地址' : null, !isVmq && !hasConfiguredValue(config, 'qiupayPid') ? '易支付模式需要填写商户 ID' : null, !hasConfiguredValue(config, 'qiupayKey') ? '请填写通讯密钥' : null].filter(Boolean) as string[];
  }
  if (provider === 'paypal') {
    return [!hasConfiguredValue(config, 'paypalClientId') ? '请填写 PayPal Client ID' : null, !hasConfiguredValue(config, 'paypalClientSecret') ? '请填写 PayPal Client Secret' : null].filter(Boolean) as string[];
  }
  return [!hasConfiguredValue(config, 'hupijiaoGatewayUrl') ? '请填写 HuPiJiao 网关地址' : null, !hasConfiguredValue(config, 'hupijiaoAppId') ? '请填写 HuPiJiao App ID' : null, !hasConfiguredValue(config, 'hupijiaoAppSecret') ? '请填写 HuPiJiao 密钥' : null].filter(Boolean) as string[];
};

const normalizeConfigForSave = (draft: PaymentProjectConfig): PaymentProjectConfig => {
  const clean = (value: unknown) => {
    const text = String(value || '').trim();
    return text || undefined;
  };
  const cleanDraft = { ...draft };
  delete cleanDraft.maskedSecrets;
  return {
    ...cleanDraft,
    key: MAIN_PROJECT_KEY,
    displayName: draft.displayName.trim() || MAIN_PROJECT_KEY,
    downstreamNotifyUrl: clean(draft.downstreamNotifyUrl),
    downstreamNotifySecret: clean(draft.downstreamNotifySecret),
    bridgeNotifySecret: clean(draft.bridgeNotifySecret),
    personalQrListenerSecret: clean(draft.personalQrListenerSecret),
    payProApiUrl: clean(draft.payProApiUrl),
    payProOpenApiSecret: clean(draft.payProOpenApiSecret),
    payProNotifyUrl: clean(draft.payProNotifyUrl),
    xpayApiUrl: clean(draft.xpayApiUrl),
    xpayToken: clean(draft.xpayToken),
    xpayNotifyUrl: clean(draft.xpayNotifyUrl),
    xpayGatewayBaseUrl: clean(draft.xpayGatewayBaseUrl),
    xpayGatewayNotifySecret: clean(draft.xpayGatewayNotifySecret),
    xpayTenantKey: clean(draft.xpayTenantKey),
    xpayTenantCallbackSecret: clean(draft.xpayTenantCallbackSecret),
    creemApiBaseUrl: clean(draft.creemApiBaseUrl),
    creemApiKey: clean(draft.creemApiKey),
    creemWebhookSecret: clean(draft.creemWebhookSecret),
    creemProductId: clean(draft.creemProductId),
    creemReturnUrl: clean(draft.creemReturnUrl),
    paypalClientId: clean(draft.paypalClientId),
    paypalClientSecret: clean(draft.paypalClientSecret),
    paypalMode: clean(draft.paypalMode),
    paypalApiBaseUrl: clean(draft.paypalApiBaseUrl),
    paypalReturnUrl: clean(draft.paypalReturnUrl),
    paypalCancelUrl: clean(draft.paypalCancelUrl),
    paypalExchangeRateCnyPerUsd: Number(draft.paypalExchangeRateCnyPerUsd) || undefined,
    qiupayBaseUrl: clean(draft.qiupayBaseUrl),
    qiupayPid: clean(draft.qiupayPid),
    qiupayKey: clean(draft.qiupayKey),
    qiupayNotifyUrl: clean(draft.qiupayNotifyUrl),
    qiupayReturnUrl: clean(draft.qiupayReturnUrl),
    tpayGatewayUrl: clean(draft.tpayGatewayUrl),
    tpayAppId: clean(draft.tpayAppId),
    tpayAppSecret: clean(draft.tpayAppSecret),
    tpayQueryUrl: clean(draft.tpayQueryUrl),
    hupijiaoGatewayUrl: clean(draft.hupijiaoGatewayUrl),
    hupijiaoBackupGatewayUrl: clean(draft.hupijiaoBackupGatewayUrl),
    hupijiaoAppId: clean(draft.hupijiaoAppId),
    hupijiaoAppSecret: clean(draft.hupijiaoAppSecret),
    hupijiaoNotifyUrl: clean(draft.hupijiaoNotifyUrl),
    hupijiaoReturnUrl: clean(draft.hupijiaoReturnUrl),
    hupijiaoPlugins: clean(draft.hupijiaoPlugins),
    hupijiaoVersion: clean(draft.hupijiaoVersion),
  };
};

const FieldRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <label className="space-y-2">
    <span className="block text-sm font-black text-zinc-800">{label}</span>
    {description ? <span className="block text-xs leading-5 text-zinc-400">{description}</span> : null}
    {children}
  </label>
);

const SecretInput: React.FC<{ id: string; value?: string; placeholder?: string; revealed: boolean; onChange: (value: string) => void; onToggle: () => void }> = ({ id, value, placeholder, revealed, onChange, onToggle }) => (
  <div className="relative">
    <input
      data-form-control-label-from-parent="true"
      type={revealed ? 'text' : 'password'}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm font-mono outline-none focus:border-accent"
    />
    <button type="button" aria-label={revealed ? `隐藏 ${id}` : `显示 ${id}`} onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-accent">
      {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
);

const AdminPaymentConfig: React.FC = () => {
  const [draft, setDraft] = useState<PaymentProjectConfig | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [diagnostics, setDiagnostics] = useState<PaymentProjectDiagnostics | null>(null);
  const [testPlanId, setTestPlanId] = useState('custom');
  const [testAmount, setTestAmount] = useState('0.10');
  const [testPaymentMethod, setTestPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [testProvider, setTestProvider] = useState('');
  const [testOrder, setTestOrder] = useState<Record<string, any> | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-payment-projects'],
    queryFn: () => api.get<PaymentProjectsResponse>('/admin/payment-projects'),
  });

  const project = data?.projects.find((item) => item.key === MAIN_PROJECT_KEY) || null;

  useEffect(() => {
    if (project?.config) setDraft({ ...project.config, key: MAIN_PROJECT_KEY, maskedSecrets: project.maskedSecrets });
  }, [project]);

  const provider = draft?.upstreamProvider || null;
  const xpayEnabled = draft?.upstreamProvider === 'xpay';
  const xpayTenantQuery = useQuery({
    queryKey: ['admin-payment-project-xpay-tenant', draft?.key, draft?.xpayTenantKey, draft?.xpayToken],
    queryFn: () => api.get<XpayTenantStatus>(`/admin/payment-projects/${MAIN_PROJECT_KEY}/xpay-tenant`),
    enabled: xpayEnabled,
  });

  const dirty = useMemo(() => Boolean(draft && project?.config && JSON.stringify(normalizeConfigForSave(draft)) !== JSON.stringify(normalizeConfigForSave(project.config))), [draft, project]);
  const issues = useMemo(() => getProviderIssues(draft || ({} as PaymentProjectConfig), provider), [draft, provider]);

  const updateDraft = <K extends keyof PaymentProjectConfig>(key: K, value: PaymentProjectConfig[K]) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, [key]: value };
    });
  };

  const renderInput = <K extends keyof PaymentProjectConfig>(field: K, placeholder = '') => {
    if (!draft) return null;
    const id = `${MAIN_PROJECT_KEY}:${String(field)}`;
    if (SECRET_FIELDS.has(field)) {
      const isConfigured = Boolean(draft.maskedSecrets?.[String(field)]);
      return <SecretInput id={id} value={draft[field] as string | undefined} placeholder={isConfigured ? '已配置，留空保持不变' : placeholder} revealed={Boolean(revealed[id])} onChange={(value) => updateDraft(field, value as PaymentProjectConfig[K])} onToggle={() => setRevealed((current) => ({ ...current, [id]: !current[id] }))} />;
    }
    return <input data-form-control-label-from-parent="true" value={String(draft[field] ?? '')} onChange={(event) => updateDraft(field, event.target.value as PaymentProjectConfig[K])} placeholder={placeholder} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-accent" />;
  };

  const openQrUploadDialog = (payType: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) xpayQrUploadMutation.mutate({ payType, file });
    };
    input.click();
  };

  const saveMutation = useMutation({
    mutationFn: (config: PaymentProjectConfig) => api.put(`/admin/payment-projects/${MAIN_PROJECT_KEY}`, normalizeConfigForSave(config)),
    onSuccess: async () => { toast({ title: '已保存', description: 'qianfu 支付配置已更新。' }); await refetch(); },
    onError: (error: Error) => toast({ variant: 'destructive', title: '保存失败', description: error.message }),
  });

  const diagnosticsMutation = useMutation({
    mutationFn: () => api.get<PaymentProjectDiagnostics>(`/admin/payment-projects/${MAIN_PROJECT_KEY}/diagnostics`),
    onSuccess: (result) => setDiagnostics(result),
    onError: (error: Error) => toast({ variant: 'destructive', title: '诊断失败', description: error.message }),
  });

  const testOrderMutation = useMutation({
    mutationFn: () => api.post<Record<string, any>>(`/admin/payment-projects/${MAIN_PROJECT_KEY}/test-order`, { planId: testPlanId, amount: Number(testAmount), paymentMethod: testPaymentMethod, provider: testProvider || undefined }),
    onSuccess: (result) => setTestOrder(result),
    onError: (error: Error) => toast({ variant: 'destructive', title: '测试订单失败', description: error.message }),
  });

  const refreshOrderMutation = useMutation({
    mutationFn: () => api.get<Record<string, any>>(`/admin/payment-projects/${MAIN_PROJECT_KEY}/orders/${testOrder?.orderId}`),
    onSuccess: (result) => setTestOrder((current) => ({ ...current, ...result })),
    onError: (error: Error) => toast({ variant: 'destructive', title: '刷新订单失败', description: error.message }),
  });

  const xpayTenantSyncMutation = useMutation({
    mutationFn: () => api.post<XpayTenantStatus>(`/admin/payment-projects/${MAIN_PROJECT_KEY}/xpay-tenant/sync`, {}),
    onSuccess: async () => { toast({ title: 'XPay 已同步', description: '租户配置已刷新。' }); await Promise.all([refetch(), xpayTenantQuery.refetch()]); },
    onError: (error: Error) => toast({ variant: 'destructive', title: 'XPay 同步失败', description: error.message }),
  });

  const xpayQrUploadMutation = useMutation({
    mutationFn: async ({ payType, file }: { payType: string; file: File }) => { const form = new FormData(); form.append('file', file); return api.post(`/admin/payment-projects/${MAIN_PROJECT_KEY}/xpay-tenant/payment-methods/${payType}/qr`, form); },
    onSuccess: async () => { toast({ title: '二维码已上传', description: 'XPay 收款二维码已更新。' }); await Promise.all([refetch(), xpayTenantQuery.refetch()]); },
    onError: (error: Error) => toast({ variant: 'destructive', title: '二维码上传失败', description: error.message }),
  });

  const renderProviderFields = (selectedProvider: UpstreamProvider | null): React.ReactNode => {
    if (!draft || !selectedProvider) return <div className="rounded-2xl border border-dashed border-zinc-200 px-5 py-6 text-sm font-bold text-zinc-400">请先选择主支付通道。</div>;
    if (selectedProvider === 'qiupay') return <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <FieldRow label="支付网关地址" description="V 免签填 v.0st.top，易支付填商户 API 地址">{renderInput('qiupayBaseUrl', 'https://pay.example.com')}</FieldRow>
      <FieldRow label="商户 ID" description="V 免签可留空，标准易支付必填">{renderInput('qiupayPid', '12082')}</FieldRow>
      <FieldRow label="通讯密钥">{renderInput('qiupayKey', '商户密钥')}</FieldRow>
      <FieldRow label="异步回调地址" description="留空使用本站默认地址">{renderInput('qiupayNotifyUrl', 'https://mc-u.top/api/v1/payment/qiupay/notify')}</FieldRow>
      <FieldRow label="同步返回地址" description="可选">{renderInput('qiupayReturnUrl', 'https://mc-u.top/payment')}</FieldRow>
    </div>;
    if (selectedProvider === 'xpay') return <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FieldRow label="XPay 网关地址">{renderInput('xpayGatewayBaseUrl', 'https://pay.example.com/xpay')}</FieldRow>
        <FieldRow label="租户标识">{renderInput('xpayTenantKey', 'qianfu')}</FieldRow>
        <FieldRow label="访问令牌">{renderInput('xpayToken', 'access token')}</FieldRow>
        <FieldRow label="租户回调密钥">{renderInput('xpayTenantCallbackSecret', 'callback secret')}</FieldRow>
        <FieldRow label="网关回调密钥">{renderInput('xpayGatewayNotifySecret', 'gateway secret')}</FieldRow>
        <FieldRow label="旧版 XPay 地址" description="仅旧版模式填写">{renderInput('xpayApiUrl')}</FieldRow>
        <FieldRow label="旧版回调地址" description="仅旧版模式填写">{renderInput('xpayNotifyUrl')}</FieldRow>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">XPay 收款二维码</div><div className="text-xs text-zinc-400">仅 XPay 租户模式需要配置</div></div><button type="button" onClick={() => xpayTenantSyncMutation.mutate()} disabled={xpayTenantSyncMutation.isPending} className="rounded-full bg-accent px-4 py-2 text-xs font-black text-white disabled:opacity-50">{xpayTenantSyncMutation.isPending ? '同步中' : '同步租户'}</button></div>
        {xpayTenantQuery.isLoading ? <div className="text-sm text-zinc-400">正在读取租户状态…</div> : xpayTenantQuery.isError ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><span>租户状态读取失败，请检查 XPay 地址、租户标识和访问令牌。</span><button type="button" onClick={() => xpayTenantQuery.refetch()} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-black hover:bg-white">重试</button></div> : xpayTenantQuery.data ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{(['alipay', 'wechat'] as const).map((payType) => { const method = xpayTenantQuery.data?.paymentMethods.find((item) => item.payType === payType); return <div key={payType} className="rounded-xl bg-white p-4"><div className="flex items-center justify-between gap-3"><span className="font-bold">{payType === 'alipay' ? '支付宝' : '微信支付'}</span><button type="button" onClick={() => openQrUploadDialog(payType)} disabled={xpayQrUploadMutation.isPending} className="text-xs font-bold text-accent disabled:opacity-50"><ImageUp className="mr-1 inline h-4 w-4" />上传</button></div><div className="mt-3 text-xs text-zinc-400 break-all">{method?.qrImagePath || '未配置'}</div></div>; })}</div> : <div className="text-sm text-zinc-400">同步后显示租户状态。</div>}
      </div>
    </div>;
    if (selectedProvider === 'paypro') return <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FieldRow label="PayPro API 地址">{renderInput('payProApiUrl', 'http://127.0.0.1:8889')}</FieldRow><FieldRow label="PayPro 密钥">{renderInput('payProOpenApiSecret', 'openapi secret')}</FieldRow><FieldRow label="异步回调地址">{renderInput('payProNotifyUrl')}</FieldRow></div>;
    if (selectedProvider === 'creem') return <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FieldRow label="Creem API 地址">{renderInput('creemApiBaseUrl', 'https://api.creem.io')}</FieldRow><FieldRow label="Creem API Key">{renderInput('creemApiKey', 'creem_live_xxx')}</FieldRow><FieldRow label="Webhook 密钥">{renderInput('creemWebhookSecret', 'webhook secret')}</FieldRow><FieldRow label="产品 ID">{renderInput('creemProductId', 'prod_xxx')}</FieldRow><FieldRow label="返回地址">{renderInput('creemReturnUrl')}</FieldRow></div>;
    if (selectedProvider === 'paypal') return <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FieldRow label="Client ID">{renderInput('paypalClientId', 'client id')}</FieldRow><FieldRow label="Client Secret">{renderInput('paypalClientSecret', 'client secret')}</FieldRow><FieldRow label="模式" description="live 或 sandbox">{renderInput('paypalMode', 'live')}</FieldRow><FieldRow label="API 地址" description="留空使用官方地址">{renderInput('paypalApiBaseUrl', 'https://api-m.paypal.com')}</FieldRow><FieldRow label="返回地址">{renderInput('paypalReturnUrl')}</FieldRow><FieldRow label="取消地址">{renderInput('paypalCancelUrl')}</FieldRow><FieldRow label="人民币兑美元汇率">{renderInput('paypalExchangeRateCnyPerUsd', '7')}</FieldRow></div>;
    if (selectedProvider === 'tpay') return <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FieldRow label="Tpay 网关地址">{renderInput('tpayGatewayUrl', 'https://gateway.xddpay.com')}</FieldRow><FieldRow label="App ID">{renderInput('tpayAppId', '10088')}</FieldRow><FieldRow label="App Secret">{renderInput('tpayAppSecret', 'secret')}</FieldRow><FieldRow label="查询地址">{renderInput('tpayQueryUrl', 'https://gateway.xddpay.com/query.ashx')}</FieldRow></div>;
    return <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FieldRow label="HuPiJiao 网关地址">{renderInput('hupijiaoGatewayUrl', 'https://api.xunhupay.com/payment/do.html')}</FieldRow><FieldRow label="备用网关地址">{renderInput('hupijiaoBackupGatewayUrl')}</FieldRow><FieldRow label="App ID">{renderInput('hupijiaoAppId', 'appid')}</FieldRow><FieldRow label="App Secret">{renderInput('hupijiaoAppSecret', 'secret')}</FieldRow><FieldRow label="异步回调地址">{renderInput('hupijiaoNotifyUrl')}</FieldRow><FieldRow label="返回地址">{renderInput('hupijiaoReturnUrl')}</FieldRow><FieldRow label="支付插件">{renderInput('hupijiaoPlugins', 'alipay')}</FieldRow><FieldRow label="接口版本">{renderInput('hupijiaoVersion', '1.1')}</FieldRow></div>;
  };

  const runtimePreview = draft ? { create: '/api/v1/payment/create', qiupayNotify: draft.qiupayNotifyUrl || '/api/v1/payment/qiupay/notify', downstream: draft.downstreamNotifyUrl || '未配置' } : null;

  return <div className="space-y-8 bg-white pb-24">
    <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      <header className="flex flex-col gap-6 rounded-3xl border border-zinc-100 bg-white p-8 md:flex-row md:items-end md:justify-between"><div><div className="text-xs font-black uppercase tracking-[0.3em] text-accent">QianFu / Payment</div><h1 className="mt-3 text-5xl font-black tracking-tight text-zinc-950">支付配置</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">只配置一个主项目。先选主通道，再填写该通道自己的字段；备用通道单独切换，不再同时展示多套重复表单。</p></div><div className="flex gap-3"><button type="button" onClick={() => refetch()} className="rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-black text-zinc-600"><RefreshCw className="mr-2 inline h-4 w-4" />刷新</button><button type="button" onClick={() => draft && saveMutation.mutate(draft)} disabled={!draft || !dirty || saveMutation.isPending} className="rounded-2xl bg-accent px-6 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="mr-2 inline h-4 w-4" />{saveMutation.isPending ? '保存中' : dirty ? '保存配置' : '已保存'}</button></div></header>
      {!project?.config ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-sm font-bold text-amber-800">后端没有返回 qianfu 配置，当前无法编辑。请检查 `/api/v1/admin/payment-projects` 的管理员权限和服务状态。</div> : null}
      {draft ? <div className="space-y-6">
        <section className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">主项目</div><h2 className="mt-2 text-2xl font-black">{draft.displayName || MAIN_PROJECT_KEY}</h2></div><div className={`rounded-full px-4 py-2 text-xs font-black ${dirty ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{dirty ? '有未保存修改' : '配置已同步'}</div></div><div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3"><div className="rounded-2xl bg-zinc-50 p-4"><div className="text-xs text-zinc-400">主通道</div><div className="mt-2 font-black">{PROVIDER_LABELS[draft.upstreamProvider]}</div></div><div className="rounded-2xl bg-zinc-50 p-4"><div className="text-xs text-zinc-400">主通道状态</div><div className="mt-2 font-black">{project.status?.primaryReady ? '已就绪' : '待完善'}</div></div><div className="rounded-2xl bg-zinc-50 p-4"><div className="text-xs text-zinc-400">保存目标</div><div className="mt-2 font-black">qianfu</div></div></div></section>
        <section className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm"><h2 className="text-2xl font-black">基础配置</h2><div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2"><FieldRow label="显示名称">{renderInput('displayName', 'QianFu')}</FieldRow><FieldRow label="主支付通道"><CustomSelect id="primary-provider" name="primaryProvider" ariaLabel="主支付通道" value={draft.upstreamProvider} onChange={(value) => updateDraft('upstreamProvider', value as UpstreamProvider)} options={providerOptions(data?.globalStatus.supportedProviders || [])} /></FieldRow><FieldRow label="业务异步回调地址">{renderInput('downstreamNotifyUrl', '留空使用系统默认地址')}</FieldRow><FieldRow label="业务回调密钥">{renderInput('downstreamNotifySecret', 'callback secret')}</FieldRow></div></section>
        <section className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm"><div><h2 className="text-2xl font-black">当前通道配置</h2><p className="mt-2 text-sm text-zinc-500">这里只编辑主支付通道，所有字段围绕当前主通道展开。</p></div><div className="mt-6 rounded-2xl bg-zinc-50 p-6"><div className="mb-5 flex items-center justify-between gap-3"><span className="font-black">{provider ? PROVIDER_LABELS[provider] : '未选择通道'}</span>{issues.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">还有 {issues.length} 项待填写</span> : <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">字段完整</span>}</div>{issues.length ? <div className="mb-5 space-y-2 text-sm font-bold text-amber-800">{issues.map((issue) => <div key={issue}>· {issue}</div>)}</div> : null}{renderProviderFields(provider)}</div></section>
        <section className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-sm"><h2 className="text-2xl font-black">回调与桥接</h2><div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2"><FieldRow label="Bridge 密钥" description="只有使用桥接或个人码监听时填写">{renderInput('bridgeNotifySecret', 'bridge secret')}</FieldRow><FieldRow label="个人码监听密钥" description="只有接入个人码监听时填写">{renderInput('personalQrListenerSecret', 'listener secret')}</FieldRow></div></section>
        <details className="rounded-3xl border border-zinc-100 bg-zinc-50 p-6"><summary className="cursor-pointer list-none font-black">高级配置</summary><div className="mt-5 text-sm text-zinc-500">旧版重复表单已经收口，主通道相关字段统一在上方维护。</div></details>
        <details className="rounded-3xl border border-zinc-100 bg-zinc-50 p-6"><summary className="cursor-pointer list-none font-black">高级工具</summary><div className="mt-6 space-y-6"><div className="rounded-2xl bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-black">运行诊断</div><div className="mt-1 text-xs text-zinc-400">只在排查通道时使用</div></div><button type="button" onClick={() => diagnosticsMutation.mutate()} disabled={diagnosticsMutation.isPending} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-black disabled:opacity-50">{diagnosticsMutation.isPending ? '检查中' : '运行诊断'}</button></div>{diagnostics ? <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-500">{JSON.stringify(diagnostics, null, 2)}</pre> : null}</div><div className="rounded-2xl bg-white p-5"><div className="font-black">测试下单</div><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4"><CustomSelect id="test-plan" ariaLabel="测试套餐" value={testPlanId} onChange={setTestPlanId} options={[{ value: 'basic-monthly', label: 'basic-monthly' }, { value: 'pro-quarterly', label: 'pro-quarterly' }, { value: 'vip-yearly', label: 'vip-yearly' }, { value: 'custom', label: 'custom' }]} /><input aria-label="测试金额" value={testAmount} onChange={(event) => setTestAmount(event.target.value)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm" /><CustomSelect id="test-method" ariaLabel="测试支付方式" value={testPaymentMethod} onChange={(value) => setTestPaymentMethod(value as 'alipay' | 'wechat')} options={[{ value: 'alipay', label: '支付宝' }, { value: 'wechat', label: '微信支付' }]} /><CustomSelect id="test-provider" ariaLabel="测试通道" value={testProvider} onChange={setTestProvider} options={[{ value: '', label: '跟随主通道' }, ...providerOptions(data?.globalStatus.supportedProviders || [])]} /></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => testOrderMutation.mutate()} disabled={testOrderMutation.isPending} className="rounded-xl bg-accent px-4 py-2 text-xs font-black text-white disabled:opacity-50">创建测试订单</button><button type="button" onClick={() => refreshOrderMutation.mutate()} disabled={!testOrder?.orderId || refreshOrderMutation.isPending} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-black disabled:opacity-50">刷新订单</button></div>{testOrder ? <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-500">{JSON.stringify(testOrder, null, 2)}</pre> : null}</div><div className="rounded-2xl bg-white p-5"><div className="font-black">有效地址</div><pre className="mt-3 whitespace-pre-wrap break-all text-xs text-zinc-500">{JSON.stringify(runtimePreview, null, 2)}</pre></div></div></details>
      </div> : null}
    </StatusWrapper>
  </div>;
};

export default AdminPaymentConfig;
