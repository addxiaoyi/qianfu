import { createScriptPrismaClient } from './utils/prismaClient';

const prisma = createScriptPrismaClient();

const PREFIX = 'payment_project:';

type PaymentProjectSeed = {
  key: string;
  displayName: string;
  upstreamProvider: 'paypro' | 'xpay' | 'tpay' | 'hupijiao';
  backupUpstreamProvider?: 'paypro' | 'xpay' | 'tpay' | 'hupijiao';
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

const readJsonEnv = (name: string): Partial<PaymentProjectSeed> | null => {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Partial<PaymentProjectSeed>;
  } catch {
    return null;
  }
};

const normalizeProject = (seed: PaymentProjectSeed): PaymentProjectSeed => {
  const key = seed.key.trim().toLowerCase();
  return {
    key,
    displayName: seed.displayName.trim() || key,
    upstreamProvider: seed.upstreamProvider,
    backupUpstreamProvider: seed.backupUpstreamProvider,
    downstreamNotifyUrl: seed.downstreamNotifyUrl?.trim() || undefined,
    downstreamNotifySecret: seed.downstreamNotifySecret?.trim() || undefined,
    bridgeNotifySecret: seed.bridgeNotifySecret?.trim() || undefined,
    personalQrListenerSecret: seed.personalQrListenerSecret?.trim() || undefined,
    payProApiUrl: seed.payProApiUrl?.trim() || undefined,
    payProOpenApiSecret: seed.payProOpenApiSecret?.trim() || undefined,
    payProNotifyUrl: seed.payProNotifyUrl?.trim() || undefined,
    xpayApiUrl: seed.xpayApiUrl?.trim() || undefined,
    xpayToken: seed.xpayToken?.trim() || undefined,
    xpayNotifyUrl: seed.xpayNotifyUrl?.trim() || undefined,
    xpayGatewayBaseUrl: seed.xpayGatewayBaseUrl?.trim() || undefined,
    xpayGatewayNotifySecret: seed.xpayGatewayNotifySecret?.trim() || undefined,
    xpayTenantKey: seed.xpayTenantKey?.trim() || undefined,
    xpayTenantCallbackSecret: seed.xpayTenantCallbackSecret?.trim() || undefined,
    tpayGatewayUrl: seed.tpayGatewayUrl?.trim() || undefined,
    tpayAppId: seed.tpayAppId?.trim() || undefined,
    tpayAppSecret: seed.tpayAppSecret?.trim() || undefined,
    tpayQueryUrl: seed.tpayQueryUrl?.trim() || undefined,
    hupijiaoGatewayUrl: seed.hupijiaoGatewayUrl?.trim() || undefined,
    hupijiaoBackupGatewayUrl: seed.hupijiaoBackupGatewayUrl?.trim() || undefined,
    hupijiaoAppId: seed.hupijiaoAppId?.trim() || undefined,
    hupijiaoAppSecret: seed.hupijiaoAppSecret?.trim() || undefined,
    hupijiaoNotifyUrl: seed.hupijiaoNotifyUrl?.trim() || undefined,
    hupijiaoReturnUrl: seed.hupijiaoReturnUrl?.trim() || undefined,
    hupijiaoPlugins: seed.hupijiaoPlugins?.trim() || undefined,
    hupijiaoVersion: seed.hupijiaoVersion?.trim() || undefined,
  };
};

const defaultProjects: PaymentProjectSeed[] = [
  normalizeProject({
    key: 'qianfu',
    displayName: 'QianFu',
    upstreamProvider: process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER === 'xpay'
      ? 'xpay'
      : process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER === 'tpay'
        ? 'tpay'
        : process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER === 'hupijiao'
          ? 'hupijiao'
          : 'paypro',
    backupUpstreamProvider:
      process.env.DEFAULT_PAYMENT_BACKUP_PROVIDER === 'paypro' ||
      process.env.DEFAULT_PAYMENT_BACKUP_PROVIDER === 'xpay' ||
      process.env.DEFAULT_PAYMENT_BACKUP_PROVIDER === 'tpay' ||
      process.env.DEFAULT_PAYMENT_BACKUP_PROVIDER === 'hupijiao'
        ? process.env.DEFAULT_PAYMENT_BACKUP_PROVIDER
        : undefined,
    downstreamNotifyUrl: process.env.DEFAULT_PAYMENT_DOWNSTREAM_NOTIFY_URL || undefined,
    downstreamNotifySecret: process.env.DEFAULT_PAYMENT_DOWNSTREAM_NOTIFY_SECRET || undefined,
    bridgeNotifySecret: process.env.XPAY_BRIDGE_NOTIFY_SECRET || undefined,
    personalQrListenerSecret: process.env.PERSONAL_QR_LISTENER_SECRET || undefined,
    payProApiUrl: process.env.PAYPRO_API_URL || undefined,
    payProOpenApiSecret: process.env.PAYPRO_OPENAPI_SECRET || undefined,
    payProNotifyUrl: process.env.PAYPRO_NOTIFY_URL || undefined,
    xpayApiUrl: process.env.XPAY_API_URL || undefined,
    xpayToken: process.env.XPAY_TOKEN || undefined,
    xpayNotifyUrl: process.env.XPAY_NOTIFY_URL || undefined,
    xpayGatewayBaseUrl: process.env.XPAY_GATEWAY_BASE_URL || undefined,
    xpayGatewayNotifySecret: process.env.XPAY_GATEWAY_NOTIFY_SECRET || undefined,
    xpayTenantKey: process.env.XPAY_TENANT_KEY || undefined,
    xpayTenantCallbackSecret: process.env.XPAY_TENANT_CALLBACK_SECRET || undefined,
    tpayGatewayUrl: process.env.TPAY_GATEWAY_URL || undefined,
    tpayAppId: process.env.TPAY_APP_ID || undefined,
    tpayAppSecret: process.env.TPAY_APP_SECRET || undefined,
    tpayQueryUrl: process.env.TPAY_QUERY_URL || undefined,
    hupijiaoGatewayUrl: process.env.HUPIJIAO_GATEWAY_URL || undefined,
    hupijiaoBackupGatewayUrl: process.env.HUPIJIAO_BACKUP_GATEWAY_URL || undefined,
    hupijiaoAppId: process.env.HUPIJIAO_APP_ID || undefined,
    hupijiaoAppSecret: process.env.HUPIJIAO_APP_SECRET || undefined,
    hupijiaoNotifyUrl: process.env.HUPIJIAO_NOTIFY_URL || undefined,
    hupijiaoReturnUrl: process.env.HUPIJIAO_RETURN_URL || undefined,
    hupijiaoPlugins: process.env.HUPIJIAO_PLUGINS || undefined,
    hupijiaoVersion: process.env.HUPIJIAO_VERSION || undefined,
  }),
];

const extraProjects = [
  readJsonEnv('PAYMENT_PROJECT_SEED'),
  readJsonEnv('PAYMENT_PROJECT_SEED_2'),
  readJsonEnv('PAYMENT_PROJECT_SEED_3'),
].filter(Boolean) as Partial<PaymentProjectSeed>[];

for (const extra of extraProjects) {
  if (!extra.key || !extra.upstreamProvider) continue;
  defaultProjects.push(
    normalizeProject({
      key: String(extra.key),
      displayName: String(extra.displayName || extra.key),
      upstreamProvider: extra.upstreamProvider,
      backupUpstreamProvider: extra.backupUpstreamProvider,
      downstreamNotifyUrl: extra.downstreamNotifyUrl,
      downstreamNotifySecret: extra.downstreamNotifySecret,
      bridgeNotifySecret: extra.bridgeNotifySecret,
      personalQrListenerSecret: extra.personalQrListenerSecret,
      payProApiUrl: extra.payProApiUrl,
      payProOpenApiSecret: extra.payProOpenApiSecret,
      payProNotifyUrl: extra.payProNotifyUrl,
      xpayApiUrl: extra.xpayApiUrl,
      xpayToken: extra.xpayToken,
      xpayNotifyUrl: extra.xpayNotifyUrl,
      xpayGatewayBaseUrl: extra.xpayGatewayBaseUrl,
      xpayGatewayNotifySecret: extra.xpayGatewayNotifySecret,
      xpayTenantKey: extra.xpayTenantKey,
      xpayTenantCallbackSecret: extra.xpayTenantCallbackSecret,
      tpayGatewayUrl: extra.tpayGatewayUrl,
      tpayAppId: extra.tpayAppId,
      tpayAppSecret: extra.tpayAppSecret,
      tpayQueryUrl: extra.tpayQueryUrl,
      hupijiaoGatewayUrl: extra.hupijiaoGatewayUrl,
      hupijiaoBackupGatewayUrl: extra.hupijiaoBackupGatewayUrl,
      hupijiaoAppId: extra.hupijiaoAppId,
      hupijiaoAppSecret: extra.hupijiaoAppSecret,
      hupijiaoNotifyUrl: extra.hupijiaoNotifyUrl,
      hupijiaoReturnUrl: extra.hupijiaoReturnUrl,
      hupijiaoPlugins: extra.hupijiaoPlugins,
      hupijiaoVersion: extra.hupijiaoVersion,
    }),
  );
}

async function upsertProject(seed: PaymentProjectSeed) {
  const key = `${PREFIX}${seed.key}`;
  await prisma.systemConfig.upsert({
    where: { key },
    update: {
      value: JSON.stringify(seed),
      is_secret: false,
      description: `Payment project config for ${seed.key}`,
    },
    create: {
      key,
      value: JSON.stringify(seed),
      is_secret: false,
      description: `Payment project config for ${seed.key}`,
    },
  });
  console.log(`seeded ${seed.key}`);
}

async function main() {
  for (const project of defaultProjects) {
    await upsertProject(project);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
