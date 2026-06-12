const { PrismaClient } = require('../prisma/generated/client/index.js');

const prisma = new PrismaClient();

const projects = [
  {
    key: 'qianfu',
    displayName: 'QianFu',
    upstreamProvider: process.env.DEFAULT_PAYMENT_UPSTREAM_PROVIDER === 'xpay' ? 'xpay' : 'paypro',
    downstreamNotifyUrl: process.env.DEFAULT_PAYMENT_DOWNSTREAM_NOTIFY_URL || undefined,
    downstreamNotifySecret: process.env.DEFAULT_PAYMENT_DOWNSTREAM_NOTIFY_SECRET || undefined,
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
    bridgeNotifySecret: process.env.XPAY_BRIDGE_NOTIFY_SECRET || undefined,
    personalQrListenerSecret: process.env.PERSONAL_QR_LISTENER_SECRET || undefined,
  },
];

async function main() {
  for (const project of projects) {
    await prisma.systemConfig.upsert({
      where: { key: `payment_project:${project.key}` },
      update: {
        value: JSON.stringify(project),
        is_secret: false,
        description: `Payment project config for ${project.key}`,
      },
      create: {
        key: `payment_project:${project.key}`,
        value: JSON.stringify(project),
        is_secret: false,
        description: `Payment project config for ${project.key}`,
      },
    });
    console.log(`seeded ${project.key}`);
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
