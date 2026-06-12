import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, ImageUp, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/api/request';
import { toast } from '@/hooks/use-toast';
import StatusWrapper from '@/components/StatusWrapper';

type UpstreamProvider = 'paypro' | 'xpay' | 'tpay' | 'hupijiao' | 'creem' | 'qiupay';

type PaymentProjectConfig = {
  key: string;
  displayName: string;
  upstreamProvider: UpstreamProvider;
  backupUpstreamProvider?: UpstreamProvider | null;
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
};

type PaymentProjectStatus = {
  primaryProvider: UpstreamProvider;
  backupProvider: UpstreamProvider | null;
  primaryReady: boolean;
  backupReady: boolean | null;
  downstreamReady: boolean;
  personalBridgeReady: boolean;
  tenantCallbackReady?: boolean;
  xpayMode: 'tenant-gateway' | 'legacy' | 'none';
  providerReadiness: Record<UpstreamProvider, boolean>;
};

type PaymentProjectRow = {
  key: string;
  config: PaymentProjectConfig | null;
  status: PaymentProjectStatus | null;
  updatedAt?: string;
  error?: string;
};

type GlobalStatus = {
  supportedProviders: UpstreamProvider[];
  defaults: {
    projectKey: string;
    upstreamProvider: string;
    backupUpstreamProvider: string | null;
  };
  paypro: { configured: boolean; notifyUrl: string | null };
  xpay: {
    tenantGatewayConfigured: boolean;
    legacyConfigured: boolean;
    officialAlipayEnabled: boolean;
    officialWechatEnabled: boolean;
    officialAlipayVerifyEnabled: boolean;
    officialWechatVerifyEnabled: boolean;
  };
  tpay: { configured: boolean; queryConfigured: boolean };
  hupijiao: { configured: boolean; backupGatewayConfigured: boolean; notifyConfigured: boolean };
  creem: { configured: boolean; apiBaseUrl: string | null; returnUrl: string | null };
  qiupay: { configured: boolean; notifyUrl: string | null; returnUrl: string | null };
};

type PaymentProjectsResponse = {
  projects: PaymentProjectRow[];
  globalStatus: GlobalStatus;
};

type PaymentProjectDiagnostics = {
  projectKey: string;
  generatedAt: string;
  primaryProvider: UpstreamProvider;
  backupProvider: UpstreamProvider | null;
  providerReadiness: Record<string, unknown>;
  effectiveEndpoints: Record<string, string>;
  tests: Array<{
    name: string;
    ok: boolean;
    detail: string;
    sample?: string;
  }>;
};

type XpayTenantMethod = {
  id?: number;
  payType?: string;
  displayName?: string;
  qrImagePath?: string;
  enabled?: boolean;
};

type XpayTenantRecord = {
  id: number;
  tenantKey: string;
  displayName?: string;
  callbackUrl?: string;
  status?: number;
  paymentMethods?: XpayTenantMethod[];
};

type XpayTenantStatus = {
  connected: boolean;
  adminBaseUrl: string;
  tenantKey: string;
  callbackUrl: string;
  tenant: XpayTenantRecord | null;
  paymentMethods: XpayTenantMethod[];
  officialProviders?: {
    publicUrl?: string;
    alipayEnabled?: boolean;
    alipayConfigured?: boolean;
    alipayVerifyConfigured?: boolean;
    wechatEnabled?: boolean;
    wechatConfigured?: boolean;
    wechatVerifyConfigured?: boolean;
  } | null;
  resolved: {
    xpayMode: 'tenant-gateway' | 'legacy' | 'none';
    tokenConfigured: boolean;
    gatewayNotifyConfigured: boolean;
    tenantCallbackConfigured: boolean;
    alipayQrConfigured: boolean;
    wechatQrConfigured: boolean;
  };
};

const PROVIDER_LABELS: Record<UpstreamProvider, string> = {
  paypro: 'PayPro',
  xpay: 'XPay',
  tpay: 'Tpay',
  hupijiao: 'HuPiJiao',
  creem: 'Creem',
  qiupay: 'EPay / 易支付',
};

const buildLocalQrUrl = (value?: string, size = 220) => {
  if (!value) return '';
  return `/api/v1/assets/qr?size=${size}&data=${encodeURIComponent(value)}`;
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
  'qiupayKey',
  'tpayAppSecret',
  'hupijiaoAppSecret',
]);

const EMPTY_CONFIG = (key = '', displayName = ''): PaymentProjectConfig => ({
  key,
  displayName,
  upstreamProvider: 'creem',
  backupUpstreamProvider: null,
});

const getProviderIssues = (config: PaymentProjectConfig, provider: UpstreamProvider | null | undefined): string[] => {
  if (!provider) return [];

  if (provider === 'paypro') {
    return [
      !config.payProApiUrl ? '缺少 PayPro API URL' : null,
      !config.payProOpenApiSecret ? '缺少 PayPro OpenAPI Secret' : null,
    ].filter(Boolean) as string[];
  }

  if (provider === 'xpay') {
    const tenantGatewayConfigured = Boolean(config.xpayGatewayBaseUrl || config.xpayTenantKey);
    const tenantGatewayReady = Boolean(
      config.xpayGatewayBaseUrl &&
      config.xpayTenantKey &&
      config.xpayToken &&
      config.xpayTenantCallbackSecret,
    );
    const legacyReady = Boolean(config.xpayApiUrl && config.xpayToken && config.xpayNotifyUrl);
    if (tenantGatewayReady || legacyReady) return [];
    if (tenantGatewayConfigured) {
      return ['XPay tenant gateway 需要 base url、tenant key、access token、tenant callback secret'];
    }
    return ['XPay 需要 tenant gateway 四件套，或 legacy xpay 三件套'];
  }

  if (provider === 'tpay') {
    return [
      !config.tpayGatewayUrl ? '缺少 Tpay Gateway URL' : null,
      !config.tpayAppId ? '缺少 Tpay App ID' : null,
      !config.tpayAppSecret ? '缺少 Tpay Secret' : null,
    ].filter(Boolean) as string[];
  }

  if (provider === 'creem') {
    return [
      !config.creemApiKey ? '缺少 Creem API Key' : null,
      !config.creemWebhookSecret ? '缺少 Creem Webhook Secret' : null,
      !config.creemProductId ? '缺少 Creem Product ID' : null,
    ].filter(Boolean) as string[];
  }

  if (provider === 'qiupay') {
    return [
      !config.qiupayBaseUrl ? '缺少 QiuPay Base URL' : null,
      !config.qiupayPid ? '缺少 QiuPay PID' : null,
      !config.qiupayKey ? '缺少 QiuPay Key' : null,
    ].filter(Boolean) as string[];
  }

  return [
    !config.hupijiaoGatewayUrl ? '缺少 HuPiJiao Gateway URL' : null,
    !config.hupijiaoAppId ? '缺少 HuPiJiao App ID' : null,
    !config.hupijiaoAppSecret ? '缺少 HuPiJiao Secret' : null,
  ].filter(Boolean) as string[];
};

const normalizeConfigForSave = (draft: PaymentProjectConfig): PaymentProjectConfig => {
  const clean = (value: unknown) => {
    const text = String(value || '').trim();
    return text ? text : undefined;
  };

  return {
    ...draft,
    key: draft.key.trim().toLowerCase(),
    displayName: draft.displayName.trim() || draft.key.trim().toLowerCase(),
    backupUpstreamProvider: draft.backupUpstreamProvider || undefined,
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
  <label className="space-y-3">
    <div className="space-y-1">
      <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">{label}</div>
      {description ? <div className="text-xs text-zinc-400 leading-5">{description}</div> : null}
    </div>
    {children}
  </label>
);

const ToggleSecretInput: React.FC<{
  id: string;
  value?: string;
  onChange: (value: string) => void;
  revealed: boolean;
  onToggle: () => void;
  placeholder?: string;
}> = ({ id, value, onChange, revealed, onToggle, placeholder }) => (
  <div className="relative">
    <input
      type={revealed ? 'text' : 'password'}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 pr-14 text-sm font-mono outline-hidden transition-all focus:border-accent focus:bg-white"
    />
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-accent"
      aria-label={revealed ? `hide-${id}` : `show-${id}`}
    >
      {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>
);

const AdminPaymentConfig: React.FC = () => {
  const [drafts, setDrafts] = useState<Record<string, PaymentProjectConfig>>({});
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [createKey, setCreateKey] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createProvider, setCreateProvider] = useState<UpstreamProvider>('creem');
  const [search, setSearch] = useState('');
  const [testPlanId, setTestPlanId] = useState('basic-monthly');
  const [testAmount, setTestAmount] = useState('20');
  const [testPaymentMethod, setTestPaymentMethod] = useState<'alipay' | 'wechat'>('alipay');
  const [testProvider, setTestProvider] = useState('');
  const [testOrder, setTestOrder] = useState<Record<string, any> | null>(null);
  const [diagnostics, setDiagnostics] = useState<PaymentProjectDiagnostics | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-payment-projects'],
    queryFn: () => api.get<PaymentProjectsResponse>('/admin/payment-projects'),
  });

  useEffect(() => {
    if (!data?.projects) return;
    const nextDrafts: Record<string, PaymentProjectConfig> = {};
    for (const project of data.projects) {
      if (project.config) {
        nextDrafts[project.key] = { ...project.config };
      }
    }
    setDrafts(nextDrafts);

    if (!selectedKey || !nextDrafts[selectedKey]) {
      setSelectedKey(
        nextDrafts[data.globalStatus.defaults.projectKey]
          ? data.globalStatus.defaults.projectKey
          : data.projects[0]?.key || '',
      );
    }
  }, [data, selectedKey]);

  const selectedProject = useMemo(
    () => data?.projects.find((project) => project.key === selectedKey) || null,
    [data, selectedKey],
  );

  const draft = selectedKey ? drafts[selectedKey] : null;
  const xpayEnabled = Boolean(draft && (draft.upstreamProvider === 'xpay' || draft.backupUpstreamProvider === 'xpay'));
  const xpayTenantQuery = useQuery({
    queryKey: ['admin-payment-project-xpay-tenant', draft?.key, draft?.xpayTenantKey, draft?.xpayToken],
    queryFn: () => api.get<XpayTenantStatus>(`/admin/payment-projects/${draft!.key}/xpay-tenant`),
    enabled: Boolean(draft?.key) && xpayEnabled,
  });
  const runtimePreview = useMemo(() => {
    if (!draft) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      createOrder: `${origin}/api/v1/payment/create`,
      xpayNotify: draft.xpayNotifyUrl || `${origin}/api/v1/payment/xpay/notify`,
      xpayTenantNotify: `${origin}/api/v1/payment/xpay/tenant-notify`,
      payproNotify: draft.payProNotifyUrl || `${origin}/api/v1/payment/paypro/notify`,
      tpayNotify: `${origin}/api/v1/payment/tpay/notify`,
      hupijiaoNotify: draft.hupijiaoNotifyUrl || `${origin}/api/v1/payment/hupijiao/notify`,
      qiupayNotify: draft.qiupayNotifyUrl || `${origin}/api/v1/payment/qiupay/notify`,
      creemWebhook: `${origin}/api/v1/payment/creem/webhook`,
      creemReturn: draft.creemReturnUrl || `${origin}/api/v1/payment/creem/return`,
      personalBridge: `${origin}/api/v1/payment/personal-qr/notify`,
      xpayBridge: `${origin}/api/v1/payment/xpay-bridge/notify`,
    };
  }, [draft]);

  const dirty = useMemo(() => {
    if (!draft || !selectedProject?.config) return false;
    return JSON.stringify(normalizeConfigForSave(draft)) !== JSON.stringify(normalizeConfigForSave(selectedProject.config));
  }, [draft, selectedProject]);

  const primaryIssues = useMemo(
    () => (draft ? getProviderIssues(draft, draft.upstreamProvider) : []),
    [draft],
  );

  const backupIssues = useMemo(
    () => (draft ? getProviderIssues(draft, draft.backupUpstreamProvider) : []),
    [draft],
  );

  const saveMutation = useMutation({
    mutationFn: async (config: PaymentProjectConfig) =>
      api.put(`/admin/payment-projects/${config.key}`, normalizeConfigForSave(config)),
    onSuccess: async () => {
      toast({ title: 'PROJECT_SAVED', description: '支付项目配置已保存。' });
      await refetch();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'SAVE_FAILED', description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => api.delete(`/admin/payment-projects/${key}`),
    onSuccess: async () => {
      toast({ title: 'PROJECT_DELETED', description: '支付项目已删除。' });
      setSelectedKey('');
      await refetch();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'DELETE_FAILED', description: error.message });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (config: PaymentProjectConfig) =>
      api.put(`/admin/payment-projects/${config.key}`, normalizeConfigForSave(config)),
    onSuccess: async (_, variables) => {
      toast({ title: 'PROJECT_CREATED', description: '新的支付项目已创建。' });
      setCreateKey('');
      setCreateDisplayName('');
      setCreateProvider('xpay');
      setSelectedKey(variables.key);
      await refetch();
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'CREATE_FAILED', description: error.message });
    },
  });

  const testOrderMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No selected project');
      return api.post<Record<string, any>>(`/admin/payment-projects/${draft.key}/test-order`, {
        planId: testPlanId,
        amount: Number(testAmount),
        paymentMethod: testPaymentMethod,
        provider: testProvider || undefined,
      });
    },
    onSuccess: (result) => {
      setTestOrder(result);
      toast({ title: 'TEST_ORDER_CREATED', description: '测试订单已创建。' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'TEST_ORDER_FAILED', description: error.message });
    },
  });

  const refreshOrderMutation = useMutation({
    mutationFn: async () => {
      if (!draft || !testOrder?.orderId) throw new Error('No test order');
      return api.get<Record<string, any>>(`/admin/payment-projects/${draft.key}/orders/${testOrder.orderId}`);
    },
    onSuccess: (result) => {
      setTestOrder((current) => ({ ...current, ...result }));
      toast({ title: 'ORDER_REFRESHED', description: '测试订单状态已刷新。' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'ORDER_REFRESH_FAILED', description: error.message });
    },
  });

  const diagnosticsMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No selected project');
      return api.get<PaymentProjectDiagnostics>(`/admin/payment-projects/${draft.key}/diagnostics`);
    },
    onSuccess: (result) => {
      setDiagnostics(result);
      toast({ title: 'DIAGNOSTICS_READY', description: '项目运行诊断已刷新。' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'DIAGNOSTICS_FAILED', description: error.message });
    },
  });

  const xpayTenantSyncMutation = useMutation({
    mutationFn: async () => api.post<XpayTenantStatus>(`/admin/payment-projects/${draft!.key}/xpay-tenant/sync`, {}),
    onSuccess: async () => {
      toast({ title: 'XPAY_TENANT_SYNCED', description: 'XPay 租户已同步并刷新密钥。' });
      await Promise.all([refetch(), xpayTenantQuery.refetch()]);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'XPAY_TENANT_SYNC_FAILED', description: error.message });
    },
  });

  const xpayQrUploadMutation = useMutation({
    mutationFn: async ({ payType, file }: { payType: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<Record<string, any>>(`/admin/payment-projects/${draft!.key}/xpay-tenant/payment-methods/${payType}/qr`, form);
    },
    onSuccess: async (_, variables) => {
      toast({ title: 'XPAY_QR_UPLOADED', description: `${variables.payType} 二维码已上传。` });
      await Promise.all([refetch(), xpayTenantQuery.refetch()]);
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'XPAY_QR_UPLOAD_FAILED', description: error.message });
    },
  });

  const updateDraft = <K extends keyof PaymentProjectConfig>(key: K, value: PaymentProjectConfig[K]) => {
    if (!draft) return;
    setDrafts((current) => ({
      ...current,
      [draft.key]: {
        ...current[draft.key],
        [key]: value,
      },
    }));
  };

  const toggleSecret = (field: string) => {
    setRevealed((current) => ({ ...current, [field]: !current[field] }));
  };

  const providerMetrics = useMemo(() => {
    const projects = data?.projects || [];
    const readyPrimary = projects.filter((project) => project.status?.primaryReady).length;
    const readyBackup = projects.filter((project) => project.status?.backupReady).length;
    const personalBridge = projects.filter((project) => project.status?.personalBridgeReady).length;
    return {
      totalProjects: projects.length,
      readyPrimary,
      readyBackup,
      personalBridge,
    };
  }, [data]);

  const projectBackedProviderSummary = useMemo(() => {
    const summary: Record<UpstreamProvider, { configured: boolean; notifyUrl: string | null; returnUrl: string | null }> = {
      paypro: { configured: false, notifyUrl: null, returnUrl: null },
      xpay: { configured: false, notifyUrl: null, returnUrl: null },
      tpay: { configured: false, notifyUrl: null, returnUrl: null },
      hupijiao: { configured: false, notifyUrl: null, returnUrl: null },
      creem: { configured: false, notifyUrl: null, returnUrl: null },
      qiupay: { configured: false, notifyUrl: null, returnUrl: null },
    };
    for (const project of data?.projects || []) {
      const config = project.config;
      const readiness = project.status?.providerReadiness;
      if (!config || !readiness) continue;
      (Object.keys(summary) as UpstreamProvider[]).forEach((provider) => {
        if (!readiness[provider]) return;
        summary[provider].configured = true;
        if (provider === 'qiupay') {
          summary[provider].notifyUrl ||= config.qiupayNotifyUrl || null;
          summary[provider].returnUrl ||= config.qiupayReturnUrl || null;
        } else if (provider === 'paypro') {
          summary[provider].notifyUrl ||= config.payProNotifyUrl || null;
        } else if (provider === 'creem') {
          summary[provider].returnUrl ||= config.creemReturnUrl || null;
        } else if (provider === 'hupijiao') {
          summary[provider].notifyUrl ||= config.hupijiaoNotifyUrl || null;
          summary[provider].returnUrl ||= config.hupijiaoReturnUrl || null;
        } else if (provider === 'xpay') {
          summary[provider].notifyUrl ||= config.xpayNotifyUrl || null;
        }
      });
    }
    return summary;
  }, [data]);

  const globalCards = data?.globalStatus ? [
    {
      key: 'creem',
      title: 'Creem',
      subtitle: data.globalStatus.creem.configured ? 'checkout ready' : 'missing api key / product',
      signal: data.globalStatus.creem.returnUrl ? 'return configured' : 'return auto',
      active: data.globalStatus.creem.configured,
    },
    {
      key: 'qiupay',
      title: 'EPay / 易支付',
      subtitle: projectBackedProviderSummary.qiupay.configured ? 'project-ready epay v1' : data.globalStatus.qiupay.configured ? 'env-ready epay v1' : 'missing base url / pid / key',
      signal: projectBackedProviderSummary.qiupay.returnUrl || data.globalStatus.qiupay.returnUrl ? 'return configured' : projectBackedProviderSummary.qiupay.notifyUrl || data.globalStatus.qiupay.notifyUrl ? 'notify configured' : 'notify auto',
      active: projectBackedProviderSummary.qiupay.configured || data.globalStatus.qiupay.configured,
    },
    {
      key: 'xpay',
      title: 'XPay',
      subtitle: data.globalStatus.xpay.tenantGatewayConfigured ? 'tenant gateway ready' : data.globalStatus.xpay.legacyConfigured ? 'legacy mode ready' : 'not configured',
      signal: data.globalStatus.xpay.officialAlipayEnabled || data.globalStatus.xpay.officialWechatEnabled ? 'official api on' : 'official api off',
      active: data.globalStatus.xpay.tenantGatewayConfigured || data.globalStatus.xpay.legacyConfigured,
    },
    {
      key: 'tpay',
      title: 'Tpay',
      subtitle: data.globalStatus.tpay.configured ? 'gateway ready' : 'missing app id/secret',
      signal: data.globalStatus.tpay.queryConfigured ? 'query enabled' : 'query missing',
      active: data.globalStatus.tpay.configured,
    },
    {
      key: 'hupijiao',
      title: 'HuPiJiao',
      subtitle: data.globalStatus.hupijiao.configured ? 'gateway ready' : 'missing app id/secret',
      signal: data.globalStatus.hupijiao.backupGatewayConfigured ? 'backup gateway on' : 'single gateway',
      active: data.globalStatus.hupijiao.configured,
    },
    {
      key: 'paypro',
      title: 'PayPro',
      subtitle: data.globalStatus.paypro.configured ? 'api + secret ready' : 'missing credentials',
      signal: data.globalStatus.paypro.notifyUrl ? 'notify bound' : 'notify missing',
      active: data.globalStatus.paypro.configured,
    },
  ] : [];

  const filteredProjects = useMemo(() => {
    const projects = data?.projects || [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((project) => {
      const displayName = project.config?.displayName || '';
      return project.key.toLowerCase().includes(keyword) || displayName.toLowerCase().includes(keyword);
    });
  }, [data, search]);

  const createProject = () => {
    const projectKey = createKey.trim().toLowerCase();
    if (!projectKey) {
      toast({ variant: 'destructive', title: 'KEY_REQUIRED', description: '请先填写 project key。' });
      return;
    }
    createMutation.mutate({
      ...EMPTY_CONFIG(projectKey, createDisplayName.trim() || projectKey),
      upstreamProvider: createProvider,
    });
  };

  const saveSelectedProject = () => {
    if (!draft) return;
    saveMutation.mutate(draft);
  };

  const deleteSelectedProject = () => {
    if (!draft) return;
    if (!window.confirm(`确认删除支付项目 ${draft.key} ?`)) return;
    deleteMutation.mutate(draft.key);
  };

  const openQrUploadDialog = (payType: string) => {
    if (!draft) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      xpayQrUploadMutation.mutate({ payType, file });
    };
    input.click();
  };

  const renderInput = <K extends keyof PaymentProjectConfig>(field: K, placeholder?: string) => {
    if (!draft) return null;
    const fieldKey = `${draft.key}:${String(field)}`;
    if (SECRET_FIELDS.has(field)) {
      return (
        <ToggleSecretInput
          id={fieldKey}
          value={draft[field] as string | undefined}
          onChange={(value) => updateDraft(field, value as PaymentProjectConfig[K])}
          revealed={Boolean(revealed[fieldKey])}
          onToggle={() => toggleSecret(fieldKey)}
          placeholder={placeholder}
        />
      );
    }
    return (
      <input
        value={(draft[field] as string | undefined) || ''}
        onChange={(event) => updateDraft(field, event.target.value as PaymentProjectConfig[K])}
        placeholder={placeholder}
        className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
      />
    );
  };

  return (
    <div className="space-y-14 pb-28 bg-white">
      <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-4 py-1.5 bg-accent text-white text-[10px] font-black uppercase tracking-[0.38em] rounded-sm shadow-2xl shadow-accent/20 italic">
                支付配置 / Runtime
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300 italic">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.45)] animate-pulse" />
                default → {data?.globalStatus.defaults.projectKey || 'qianfu'}
              </div>
            </div>
            <h1 className="text-7xl sm:text-8xl font-black tracking-tighter uppercase leading-[0.86] italic text-accent">支付配置</h1>
            <p className="max-w-3xl text-zinc-500 font-bold text-lg leading-9 italic border-l-2 border-zinc-100 pl-8">
              这里不再是展示稿，而是实际支付项目控制台。你可以切主通道、挂备用通道、配回调、配 bridge、配个人码监听，把 Creem 作为第一方案、EPay / 易支付 作为第二方案、XPay / Tpay 作为第三梯队统一管理。
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => refetch()}
              className="px-8 py-5 rounded-[2rem] border border-zinc-100 bg-white text-[11px] font-black uppercase tracking-[0.35em] italic text-zinc-500 shadow-xs hover:border-accent hover:text-accent transition-all flex items-center gap-3"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
            <button
              type="button"
              onClick={saveSelectedProject}
              disabled={!draft || saveMutation.isPending || !dirty}
              className="px-10 py-5 btn-accent rounded-[2rem] text-[11px] font-black uppercase tracking-[0.4em] italic text-white shadow-2xl shadow-accent/20 disabled:opacity-50 flex items-center gap-3"
            >
              <Save className="h-4 w-4" />
              {dirty ? '保存项目' : '已保存'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
          {[
            { label: '支付项目', value: providerMetrics.totalProjects, hint: '已登记的支付项目' },
            { label: '主通道就绪', value: providerMetrics.readyPrimary, hint: '主通道配置完整' },
            { label: '备用通道就绪', value: providerMetrics.readyBackup, hint: '备用通道已可切换' },
            { label: '桥接就绪', value: providerMetrics.personalBridge, hint: '个人码监听或 bridge 可用' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-[2.8rem] border border-zinc-50 bg-zinc-50/40 px-8 py-8 shadow-xs"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">{item.label}</div>
              <div className="mt-4 text-5xl font-black tracking-tighter italic">{item.value}</div>
              <div className="mt-2 text-sm font-bold text-zinc-400 italic">{item.hint}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          <aside className="xl:col-span-4 space-y-8">
            <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">全局通道</div>
                <h2 className="text-3xl font-black tracking-tighter uppercase italic mt-2">运行状态</h2>
              </div>
              <ShieldCheck className="h-7 w-7 text-accent" />
            </div>

            <div className="space-y-4">
              {globalCards.map((card) => (
                <div key={card.key} className="rounded-[2rem] border border-zinc-100 bg-zinc-50/60 px-5 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] italic">{card.title}</div>
                      <div className="mt-2 text-xs font-bold text-zinc-400 uppercase tracking-[0.2em]">{card.subtitle}</div>
                    </div>
                    <div className={`px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.28em] ${card.active ? 'bg-green-50 text-green-600' : 'bg-zinc-100 text-zinc-500'}`}>
                      {card.signal}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-8">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">创建项目</div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic mt-2">新增支付项目</h2>

            <div className="space-y-5 mt-6">
              <FieldRow label="project key" description="例如 qianfu、starmc、legacyshop">
                <input
                  value={createKey}
                  onChange={(event) => setCreateKey(event.target.value)}
                  className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                  placeholder="qianfu"
                />
              </FieldRow>

              <FieldRow label="display name" description="后台展示名，不影响路由 key">
                <input
                  value={createDisplayName}
                  onChange={(event) => setCreateDisplayName(event.target.value)}
                  className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                  placeholder="QianFu Primary"
                />
              </FieldRow>

              <FieldRow label="primary provider">
                <select
                  value={createProvider}
                  onChange={(event) => setCreateProvider(event.target.value as UpstreamProvider)}
                  className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                >
                  {data?.globalStatus.supportedProviders.map((provider) => (
                    <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
                  ))}
                </select>
              </FieldRow>

              <button
                type="button"
                onClick={createProject}
                disabled={createMutation.isPending}
                className="w-full px-8 py-5 btn-accent rounded-[2rem] text-[11px] font-black uppercase tracking-[0.38em] italic text-white shadow-2xl shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <Plus className="h-4 w-4" />
                创建项目
              </button>
            </div>
          </section>

          <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-8">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">支付项目</div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic mt-2">项目列表</h2>

            <div className="mt-6 space-y-4">
              <div className="pb-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索 project key / display name"
                  className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                />
              </div>

              {filteredProjects.map((project) => (
                <button
                  key={project.key}
                  type="button"
                  onClick={() => setSelectedKey(project.key)}
                  className={`w-full rounded-[2rem] border px-5 py-5 text-left transition-all ${selectedKey === project.key ? 'border-accent bg-accent-subtle shadow-lg shadow-accent/10' : 'border-zinc-100 bg-zinc-50/50 hover:border-zinc-200 hover:bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300 italic">{project.key}</div>
                      <div className="mt-2 text-lg font-black tracking-tight italic">{project.config?.displayName || project.key}</div>
                    </div>
                    <div className={`px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.28em] ${project.status?.primaryReady ? 'bg-green-50 text-green-600' : 'bg-zinc-100 text-zinc-500'}`}>
                      {project.status?.primaryReady ? '就绪' : '草稿'}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">{PROVIDER_LABELS[project.status?.primaryProvider || project.config?.upstreamProvider || 'xpay']}</span>
                    {project.status?.backupProvider ? (
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-300">备用 → {PROVIDER_LABELS[project.status.backupProvider]}</span>
                    ) : null}
                    {project.status?.xpayMode && project.status.xpayMode !== 'none' ? (
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-300">{project.status.xpayMode}</span>
                    ) : null}
                  </div>
                </button>
              ))}
              {!filteredProjects.length ? (
                <div className="rounded-[2rem] border border-dashed border-zinc-200 bg-zinc-50/40 px-5 py-6 text-sm font-bold italic text-zinc-400 text-center">
                  没有匹配的支付项目。
                </div>
              ) : null}
            </div>
          </section>
        </aside>

          <main className="xl:col-span-8">
            {!draft || !selectedProject ? (
              <div className="rounded-[3rem] border border-dashed border-zinc-200 bg-zinc-50/30 p-16 text-center text-zinc-400 font-bold italic">
                先从左侧选择一个支付项目。
              </div>
            ) : (
              <div className="space-y-8">
                <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-10">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">{selectedProject.key}</div>
                    <h2 className="mt-3 text-4xl font-black tracking-tighter uppercase italic">{draft.displayName || selectedProject.key}</h2>
                    <p className="mt-3 text-sm font-bold text-zinc-400 leading-7">
                      主通道和备用通道在这里统一维护。保存后即写入 `system_config`，支付创建会立刻按新策略生效。
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap justify-end">
                    <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.28em] ${dirty ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-600'}`}>
                      {dirty ? '待保存' : '已同步'}
                    </div>
                    <button
                      type="button"
                      onClick={deleteSelectedProject}
                      disabled={deleteMutation.isPending}
                      className="px-6 py-4 rounded-[1.8rem] border border-red-100 bg-red-50 text-[10px] font-black uppercase tracking-[0.35em] italic text-red-600 transition-all hover:bg-red-100 disabled:opacity-50 flex items-center gap-3"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                  {([
                    { label: 'Primary', value: draft.upstreamProvider, active: selectedProject.status?.primaryReady },
                    { label: 'Backup', value: draft.backupUpstreamProvider || 'none', active: selectedProject.status?.backupReady ?? false },
                    { label: 'Downstream', value: selectedProject.status?.downstreamReady ? 'wired' : 'unset', active: selectedProject.status?.downstreamReady },
                    { label: 'Bridge', value: selectedProject.status?.personalBridgeReady ? 'ready' : 'off', active: selectedProject.status?.personalBridgeReady },
                  ]).map((card) => (
                    <div key={card.label} className="rounded-[2rem] border border-zinc-100 bg-zinc-50/50 px-5 py-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">{card.label}</div>
                      <div className="mt-3 text-xl font-black tracking-tight italic">{card.value}</div>
                      <div className={`mt-3 text-[10px] font-black uppercase tracking-[0.28em] ${card.active ? 'text-green-600' : 'text-zinc-400'}`}>
                        {card.active ? 'ready' : 'needs work'}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-10">
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">Runtime Preview</div>
                <h3 className="mt-3 text-3xl font-black tracking-tighter uppercase italic">Effective Endpoints</h3>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {runtimePreview ? (
                    Object.entries(runtimePreview).map(([key, value]) => (
                      <div key={key} className="rounded-[1.8rem] border border-zinc-100 bg-zinc-50/60 px-5 py-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300 italic">{key}</div>
                        <div className="mt-3 text-sm font-mono break-all text-zinc-600">{value}</div>
                      </div>
                    ))
                  ) : null}
                </div>
              </section>

              <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-10 space-y-8">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">Diagnostics</div>
                    <h3 className="mt-3 text-3xl font-black tracking-tighter uppercase italic">运行诊断</h3>
                    <p className="mt-3 text-sm font-bold text-zinc-400 leading-7">
                      这里会直接请求后端诊断接口，返回当前项目的 provider 就绪状态、XPay tenant 联通性、回调路径和备用通道是否配置完整。
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => diagnosticsMutation.mutate()}
                    disabled={!draft || diagnosticsMutation.isPending}
                    className="px-8 py-4 rounded-[1.8rem] border border-zinc-100 bg-white text-[10px] font-black uppercase tracking-[0.35em] italic text-zinc-500 shadow-xs hover:border-accent hover:text-accent transition-all disabled:opacity-50 flex items-center gap-3"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {diagnosticsMutation.isPending ? 'Running...' : 'Run Diagnostics'}
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50/50 px-6 py-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">Checks</div>
                    <div className="mt-4 space-y-4">
                      {(diagnostics?.tests || []).length ? diagnostics!.tests.map((test) => (
                        <div key={test.name} className="rounded-[1.5rem] border border-zinc-100 bg-white px-4 py-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-sm font-black tracking-tight italic">{test.name}</div>
                            <div className={`px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.28em] ${test.ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {test.ok ? 'pass' : 'fail'}
                            </div>
                          </div>
                          <div className="mt-3 text-sm font-bold text-zinc-500 break-all">{test.detail}</div>
                          {test.sample ? (
                            <pre className="mt-3 whitespace-pre-wrap break-all text-xs font-mono text-zinc-400">{test.sample}</pre>
                          ) : null}
                        </div>
                      )) : (
                        <div className="text-sm font-bold italic text-zinc-400">先执行一次诊断。</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50/50 px-6 py-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">Snapshot</div>
                    <pre className="mt-4 whitespace-pre-wrap break-all text-sm font-mono text-zinc-600">{diagnostics ? JSON.stringify(diagnostics, null, 2) : 'null'}</pre>
                  </div>
                </div>
              </section>

              <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-10 space-y-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">Order Lab</div>
                  <h3 className="mt-3 text-3xl font-black tracking-tighter uppercase italic">Test Flow</h3>
                  <p className="mt-3 text-sm font-bold text-zinc-400 leading-7">
                    这里直接走真实后端。你可以用当前项目创建测试订单、刷新订单状态、模拟成功入账，验证通道配置和下游回调是否成环。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  <FieldRow label="plan id">
                    <select
                      value={testPlanId}
                      onChange={(event) => setTestPlanId(event.target.value)}
                      className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                    >
                      <option value="basic-monthly">basic-monthly</option>
                      <option value="pro-quarterly">pro-quarterly</option>
                      <option value="vip-yearly">vip-yearly</option>
                      <option value="custom">custom</option>
                    </select>
                  </FieldRow>

                  <FieldRow label="amount">
                    <input
                      value={testAmount}
                      onChange={(event) => setTestAmount(event.target.value)}
                      className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                    />
                  </FieldRow>

                  <FieldRow label="payment method">
                    <select
                      value={testPaymentMethod}
                      onChange={(event) => setTestPaymentMethod(event.target.value as 'alipay' | 'wechat')}
                      className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                    >
                      <option value="alipay">alipay</option>
                      <option value="wechat">wechat</option>
                    </select>
                  </FieldRow>

                  <FieldRow label="provider override" description="为空则用项目默认主通道">
                    <select
                      value={testProvider}
                      onChange={(event) => setTestProvider(event.target.value)}
                      className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                    >
                      <option value="">(default)</option>
                      {data?.globalStatus.supportedProviders.map((provider) => (
                        <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
                      ))}
                    </select>
                  </FieldRow>
                </div>

                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => testOrderMutation.mutate()}
                    disabled={testOrderMutation.isPending}
                    className="px-8 py-4 btn-accent rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.35em] italic text-white shadow-2xl shadow-accent/20 disabled:opacity-50"
                  >
                    {testOrderMutation.isPending ? 'Creating...' : 'Create Test Order'}
                  </button>
                  <button
                    type="button"
                    onClick={() => refreshOrderMutation.mutate()}
                    disabled={!testOrder?.orderId || refreshOrderMutation.isPending}
                    className="px-8 py-4 rounded-[1.8rem] border border-zinc-100 bg-white text-[10px] font-black uppercase tracking-[0.35em] italic text-zinc-500 shadow-xs disabled:opacity-50"
                  >
                    {refreshOrderMutation.isPending ? 'Refreshing...' : 'Refresh Order'}
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50/50 px-6 py-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">Test Order</div>
                    <pre className="mt-4 whitespace-pre-wrap break-all text-sm font-mono text-zinc-600">{testOrder ? JSON.stringify(testOrder, null, 2) : 'null'}</pre>
                  </div>

                  <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50/50 px-6 py-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300 italic">Preview</div>
                    {testOrder?.paymentQrContent || testOrder?.qrImagePath || testOrder?.paymentUrl ? (
                      <div className="mt-4 space-y-4">
                        <div className="text-sm font-bold text-zinc-500 break-all">{testOrder.paymentUrl || testOrder.qrImagePath || testOrder.paymentQrContent}</div>
                        <img
                          src={
                            testOrder.qrImagePath
                              || (testOrder.paymentQrContent
                                ? buildLocalQrUrl(testOrder.paymentQrContent, 220)
                                : testOrder.paymentUrl
                                  ? buildLocalQrUrl(testOrder.paymentUrl, 220)
                                  : '')
                          }
                          alt="test-order-qr"
                          className="h-[220px] w-[220px] rounded-[1.6rem] border border-zinc-100 bg-white object-contain p-3"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 text-sm font-bold italic text-zinc-400">先创建测试订单。</div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-[3rem] border border-zinc-50 bg-white shadow-xs p-10 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FieldRow label="display name" description="后台展示名">
                    {renderInput('displayName', 'QianFu Primary')}
                  </FieldRow>

                  <FieldRow label="primary provider" description="默认下单通道">
                    <select
                      value={draft.upstreamProvider}
                      onChange={(event) => updateDraft('upstreamProvider', event.target.value as UpstreamProvider)}
                      className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                    >
                      {data?.globalStatus.supportedProviders.map((provider) => (
                        <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
                      ))}
                    </select>
                  </FieldRow>

                  <FieldRow label="backup provider" description="主通道失败时自动切换">
                    <select
                      value={draft.backupUpstreamProvider || ''}
                      onChange={(event) => updateDraft('backupUpstreamProvider', (event.target.value || null) as PaymentProjectConfig['backupUpstreamProvider'])}
                      className="w-full rounded-[1.6rem] border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm outline-hidden transition-all focus:border-accent focus:bg-white"
                    >
                      <option value="">none</option>
                      {data?.globalStatus.supportedProviders.map((provider) => (
                        <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
                      ))}
                    </select>
                  </FieldRow>

                  <FieldRow label="downstream notify url" description="业务系统支付成功回调">
                    {renderInput('downstreamNotifyUrl', 'https://app.example.com/api/payment/callback')}
                  </FieldRow>

                  <FieldRow label="downstream notify secret" description="下游业务签名">
                    {renderInput('downstreamNotifySecret', 'callback secret')}
                  </FieldRow>

                  <FieldRow label="bridge notify secret" description="XPay bridge / listener 共用密钥">
                    {renderInput('bridgeNotifySecret', 'bridge secret')}
                  </FieldRow>

                  <FieldRow label="personal qr listener secret" description="个人码监听中间层专用密钥">
                    {renderInput('personalQrListenerSecret', 'listener secret')}
                  </FieldRow>
                </div>

                <section className="space-y-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">XPay Layer</div>
                  {draft.upstreamProvider === 'xpay' || draft.backupUpstreamProvider === 'xpay' ? (
                    <div className={`rounded-[1.8rem] border px-5 py-4 text-sm font-bold ${primaryIssues.length && draft.upstreamProvider === 'xpay' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-zinc-100 bg-zinc-50 text-zinc-500'}`}>
                      {draft.upstreamProvider === 'xpay' && primaryIssues.length
                        ? primaryIssues.join('；')
                        : draft.backupUpstreamProvider === 'xpay' && backupIssues.length
                          ? backupIssues.join('；')
                          : `XPay mode: ${selectedProject.status?.xpayMode || 'none'}`}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FieldRow label="xpay gateway base url" description="多租户网关，如 https://pay.example.com/xpay">
                      {renderInput('xpayGatewayBaseUrl', 'https://pay.example.com/xpay')}
                    </FieldRow>
                    <FieldRow label="xpay tenant key" description="多租户 tenantKey">
                      {renderInput('xpayTenantKey', 'qianfu')}
                    </FieldRow>
                    <FieldRow label="xpay token" description="租户 access token">
                      {renderInput('xpayToken', 'tenant access token')}
                    </FieldRow>
                    <FieldRow label="xpay gateway notify secret" description="bridge 转发到 XPay 网关验签">
                      {renderInput('xpayGatewayNotifySecret', 'gateway notify secret')}
                    </FieldRow>
                    <FieldRow label="xpay tenant callback secret" description="XPay 租户成功回调给主站时使用">
                      {renderInput('xpayTenantCallbackSecret', 'tenant callback secret')}
                    </FieldRow>
                    <FieldRow label="legacy xpay api url" description="旧版收银台地址">
                      {renderInput('xpayApiUrl', 'https://pay.example.com/starmc/pay')}
                    </FieldRow>
                    <FieldRow label="legacy xpay notify url" description="旧版回调地址">
                      {renderInput('xpayNotifyUrl', 'https://pay.example.com/api/v1/payment/xpay/notify')}
                    </FieldRow>
                  </div>
                  <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50/70 p-6 space-y-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500 italic">XPay Tenant Runtime</div>
                        <div className="text-xs text-zinc-400">
                          直接从主站后台同步租户、检查回调、上传收款二维码。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => xpayTenantSyncMutation.mutate()}
                        disabled={!draft || xpayTenantSyncMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-accent/20 bg-accent px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCw className={`h-4 w-4 ${xpayTenantSyncMutation.isPending ? 'animate-spin' : ''}`} />
                        {xpayTenantSyncMutation.isPending ? 'Syncing…' : 'Sync Tenant'}
                      </button>
                    </div>

                    {xpayTenantQuery.isLoading ? (
                      <div className="text-sm text-zinc-400">正在读取 XPay 租户状态…</div>
                    ) : xpayTenantQuery.isError ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        XPay 租户状态读取失败，请先检查远端 XPay 服务与本地管理员配置。
                      </div>
                    ) : xpayTenantQuery.data ? (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                          {[
                            ['mode', xpayTenantQuery.data.resolved.xpayMode],
                            ['tenant', xpayTenantQuery.data.tenant?.tenantKey || xpayTenantQuery.data.tenantKey],
                            ['callback', xpayTenantQuery.data.resolved.tenantCallbackConfigured ? 'ready' : 'missing'],
                            ['gateway sign', xpayTenantQuery.data.resolved.gatewayNotifyConfigured ? 'ready' : 'missing'],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-[1.4rem] border border-white bg-white px-4 py-4 shadow-xs">
                              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300 italic">{label}</div>
                              <div className="mt-2 text-sm font-bold text-zinc-700 break-all">{value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(['alipay', 'wechat'] as const).map((payType) => {
                            const method = (xpayTenantQuery.data.paymentMethods || []).find((item) => item.payType === payType);
                            const hasQr = Boolean(method?.qrImagePath);
                            return (
                              <div key={payType} className="rounded-[1.6rem] border border-white bg-white p-5 shadow-xs space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500 italic">
                                      {payType === 'alipay' ? 'Alipay QR' : 'WeChat QR'}
                                    </div>
                                    <div className={`mt-1 text-xs font-bold ${hasQr ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {hasQr ? '二维码已配置' : '当前未配置二维码'}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openQrUploadDialog(payType)}
                                    disabled={xpayQrUploadMutation.isPending}
                                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-600 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <ImageUp className="h-4 w-4" />
                                    {xpayQrUploadMutation.isPending ? 'Uploading…' : 'Upload QR'}
                                  </button>
                                </div>
                                <div className="rounded-[1.2rem] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-mono text-zinc-500 break-all">
                                  {method?.qrImagePath || '未上传'}
                                </div>
                                {hasQr ? (
                                  <img
                                    src={method!.qrImagePath}
                                    alt={`${payType}-qr`}
                                    className="h-28 w-28 rounded-[1.2rem] border border-zinc-100 object-cover"
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-[1.4rem] border border-white bg-white px-4 py-4 shadow-xs">
                            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300 italic">tenant callback url</div>
                            <div className="mt-2 text-xs font-mono text-zinc-600 break-all">{xpayTenantQuery.data.callbackUrl}</div>
                          </div>
                          <div className="rounded-[1.4rem] border border-white bg-white px-4 py-4 shadow-xs">
                            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300 italic">xpay admin base</div>
                            <div className="mt-2 text-xs font-mono text-zinc-600 break-all">{xpayTenantQuery.data.adminBaseUrl}</div>
                          </div>
                        </div>

                        <div className="rounded-[1.4rem] border border-white bg-white px-4 py-4 shadow-xs">
                          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-300 italic">official provider switches</div>
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold text-zinc-600">
                            <div>Alipay: {xpayTenantQuery.data.officialProviders?.alipayEnabled ? 'on' : 'off'}</div>
                            <div>Alipay verify: {xpayTenantQuery.data.officialProviders?.alipayVerifyConfigured ? 'ready' : 'off'}</div>
                            <div>WeChat: {xpayTenantQuery.data.officialProviders?.wechatEnabled ? 'on' : 'off'}</div>
                            <div>WeChat verify: {xpayTenantQuery.data.officialProviders?.wechatVerifyConfigured ? 'ready' : 'off'}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">PayPro Layer</div>
                  {(draft.upstreamProvider === 'paypro' || draft.backupUpstreamProvider === 'paypro') && (primaryIssues.length || backupIssues.length) ? (
                    <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                      {draft.upstreamProvider === 'paypro' ? primaryIssues.join('；') : backupIssues.join('；')}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FieldRow label="paypro api url">
                      {renderInput('payProApiUrl', 'http://127.0.0.1:8889')}
                    </FieldRow>
                    <FieldRow label="paypro openapi secret">
                      {renderInput('payProOpenApiSecret', 'openapi secret')}
                    </FieldRow>
                    <FieldRow label="paypro notify url">
                      {renderInput('payProNotifyUrl', 'https://pay.example.com/api/v1/payment/paypro/notify')}
                    </FieldRow>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">EPay / 易支付 Layer</div>
                  {(draft.upstreamProvider === 'qiupay' || draft.backupUpstreamProvider === 'qiupay') && (primaryIssues.length || backupIssues.length) ? (
                    <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                      {draft.upstreamProvider === 'qiupay' ? primaryIssues.join('；') : backupIssues.join('；')}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FieldRow label="qiupay base url" description="填写商户根地址或 mapi.php，例如 https://www.ezfpy.cn">
                      {renderInput('qiupayBaseUrl', 'https://www.ezfpy.cn')}
                    </FieldRow>
                    <FieldRow label="qiupay pid" description="易支付商户 PID">
                      {renderInput('qiupayPid', '1')}
                    </FieldRow>
                    <FieldRow label="qiupay key" description="易支付商户密钥">
                      {renderInput('qiupayKey', 'merchant key')}
                    </FieldRow>
                    <FieldRow label="qiupay notify url" description="默认落到 /api/v1/payment/qiupay/notify，兼容易支付 V1 异步回调">
                      {renderInput('qiupayNotifyUrl', 'https://mc-u.top/api/v1/payment/qiupay/notify')}
                    </FieldRow>
                    <FieldRow label="qiupay return url" description="可选，支付完成后跳回前端页面">
                      {renderInput('qiupayReturnUrl', 'https://mc-u.top/payment/success')}
                    </FieldRow>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">Creem Layer</div>
                  {(draft.upstreamProvider === 'creem' || draft.backupUpstreamProvider === 'creem') && (primaryIssues.length || backupIssues.length) ? (
                    <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                      {draft.upstreamProvider === 'creem' ? primaryIssues.join('；') : backupIssues.join('；')}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FieldRow label="creem api base url" description="测试环境可填 https://test-api.creem.io">
                      {renderInput('creemApiBaseUrl', 'https://api.creem.io')}
                    </FieldRow>
                    <FieldRow label="creem api key" description="后台 checkout API 用">
                      {renderInput('creemApiKey', 'creem_live_xxx')}
                    </FieldRow>
                    <FieldRow label="creem webhook secret" description="webhook 验签密钥">
                      {renderInput('creemWebhookSecret', 'webhook secret')}
                    </FieldRow>
                    <FieldRow label="creem product id" description="购买时绑定的产品 ID">
                      {renderInput('creemProductId', 'prod_xxx')}
                    </FieldRow>
                    <FieldRow label="creem return url" description="默认会落到 /api/v1/payment/creem/return">
                      {renderInput('creemReturnUrl', 'https://pay.example.com/api/v1/payment/creem/return')}
                    </FieldRow>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">Tpay Layer</div>
                  {(draft.upstreamProvider === 'tpay' || draft.backupUpstreamProvider === 'tpay') && (primaryIssues.length || backupIssues.length) ? (
                    <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                      {draft.upstreamProvider === 'tpay' ? primaryIssues.join('；') : backupIssues.join('；')}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FieldRow label="tpay gateway url">
                      {renderInput('tpayGatewayUrl', 'https://gateway.xddpay.com')}
                    </FieldRow>
                    <FieldRow label="tpay app id">
                      {renderInput('tpayAppId', '10088')}
                    </FieldRow>
                    <FieldRow label="tpay app secret">
                      {renderInput('tpayAppSecret', 'tpay secret')}
                    </FieldRow>
                    <FieldRow label="tpay query url">
                      {renderInput('tpayQueryUrl', 'https://gateway.xddpay.com/query.ashx')}
                    </FieldRow>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-300 italic">HuPiJiao Layer</div>
                  {(draft.upstreamProvider === 'hupijiao' || draft.backupUpstreamProvider === 'hupijiao') && (primaryIssues.length || backupIssues.length) ? (
                    <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                      {draft.upstreamProvider === 'hupijiao' ? primaryIssues.join('；') : backupIssues.join('；')}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FieldRow label="hupijiao gateway url">
                      {renderInput('hupijiaoGatewayUrl', 'https://api.xunhupay.com/payment/do.html')}
                    </FieldRow>
                    <FieldRow label="hupijiao backup gateway">
                      {renderInput('hupijiaoBackupGatewayUrl', 'https://api.dpweixin.com/payment/do.html')}
                    </FieldRow>
                    <FieldRow label="hupijiao app id">
                      {renderInput('hupijiaoAppId', 'appid')}
                    </FieldRow>
                    <FieldRow label="hupijiao app secret">
                      {renderInput('hupijiaoAppSecret', 'secret')}
                    </FieldRow>
                    <FieldRow label="hupijiao notify url">
                      {renderInput('hupijiaoNotifyUrl', 'https://pay.example.com/api/v1/payment/hupijiao/notify')}
                    </FieldRow>
                    <FieldRow label="hupijiao return url">
                      {renderInput('hupijiaoReturnUrl', 'https://app.example.com/payment-success')}
                    </FieldRow>
                    <FieldRow label="hupijiao plugins">
                      {renderInput('hupijiaoPlugins', 'alipay')}
                    </FieldRow>
                    <FieldRow label="hupijiao version">
                      {renderInput('hupijiaoVersion', '1.1')}
                    </FieldRow>
                  </div>
                </section>
                </section>
              </div>
            )}
          </main>
        </div>
      </StatusWrapper>
    </div>
  );
};

export default AdminPaymentConfig;
