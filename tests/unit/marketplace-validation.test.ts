import type { ZodType } from 'zod';
import { beforeAll, describe, expect, it } from 'vitest';

type MarketplaceSchemas = {
  marketplaceCreateProductSchema?: ZodType;
  marketplaceUpdateProductSchema?: ZodType;
  marketplaceCreateOrderSchema?: ZodType;
  marketplaceCreateReviewSchema?: ZodType;
  marketplaceShopOwnerParamsSchema?: ZodType;
  marketplaceShopConfigSchema?: ZodType;
  marketplaceShopMetricSchema?: ZodType;
  marketplaceVerificationReviewSchema?: ZodType;
};

let schemas: MarketplaceSchemas = {};

beforeAll(async () => {
  schemas = await import('../../server/core/controller/marketplaceSchemas').catch(() => ({}));
}, 30_000);

function requireSchema(name: keyof MarketplaceSchemas): ZodType | undefined {
  const schema = schemas[name];
  expect(schema, `${name} must be exported`).toBeDefined();
  return schema;
}

const validProduct = {
  title: 'Survival Spawn',
  category: 'map',
  description: 'A polished multiplayer spawn map.',
  price: 20,
  currency: 'CNY',
  taxIncluded: true,
  additionalFees: 0,
  validityText: '永久使用',
  deliveryMethod: '支付成功后通过订单中心下载',
  deliveryEta: '支付成功后即时交付',
  compatibility: 'Minecraft Java Edition 1.20.x',
  isPlatformOperated: false,
  sellerIdentity: '已认证个人卖家 Builder',
  afterSalesContact: '通过站内工单联系卖家',
  refundTerms: '未交付、与描述不符或侵权时可申请退款',
  ipSource: '卖家原创并保留源文件与发布记录',
  prohibitedUse: '禁止转售、恶意传播或用于违法用途',
  riskNotice: '安装前请备份服务器并在测试环境验证',
  productVersion: '1.0.0',
  author: 'Builder',
  coverUrl: '/uploads/spawn-cover.webp',
  downloadUrl: 'https://downloads.example.com/spawn.zip',
};

describe('marketplace input validation', () => {
  it('accepts a valid product and trims text fields', () => {
    const schema = requireSchema('marketplaceCreateProductSchema');
    if (!schema) return;

    const parsed = schema.parse({ ...validProduct, title: '  Survival Spawn  ' });
    expect(parsed).toMatchObject({ ...validProduct, title: 'Survival Spawn' });
  });

  it.each([
    { field: 'category', value: 'unknown' },
    { field: 'price', value: -1 },
    { field: 'price', value: 0 },
    { field: 'price', value: Number.NaN },
    { field: 'price', value: Number.POSITIVE_INFINITY },
    { field: 'price', value: 1.5 },
    { field: 'description', value: 'x'.repeat(50_001) },
  ])('rejects invalid product $field values', ({ field, value }) => {
    const schema = requireSchema('marketplaceCreateProductSchema');
    if (!schema) return;

    expect(schema.safeParse({ ...validProduct, [field]: value }).success).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'http://downloads.example.com/file.zip',
    'https://user:pass@downloads.example.com/file.zip',
    'https://localhost/file.zip',
    'https://127.0.0.1/file.zip',
    'https://10.0.0.8/file.zip',
    'https://100.64.0.8/file.zip',
    'https://169.254.1.8/file.zip',
    'https://172.16.0.8/file.zip',
    'https://192.168.0.8/file.zip',
    'https://[::1]/file.zip',
    'https://[fc00::1]/file.zip',
    '/uploads/../secrets.txt',
  ])('rejects unsafe marketplace asset URL %s', (downloadUrl) => {
    const schema = requireSchema('marketplaceCreateProductSchema');
    if (!schema) return;

    expect(schema.safeParse({ ...validProduct, downloadUrl }).success).toBe(false);
  });

  it('rejects unknown product fields and empty updates', () => {
    const createSchema = requireSchema('marketplaceCreateProductSchema');
    const updateSchema = requireSchema('marketplaceUpdateProductSchema');
    if (!createSchema || !updateSchema) return;

    expect(createSchema.safeParse({ ...validProduct, creatorId: 99 }).success).toBe(false);
    expect(updateSchema.safeParse({}).success).toBe(false);
  });

  it.each([0, -1, 1.5, 101, Number.NaN])('rejects invalid order quantity %s', (quantity) => {
    const schema = requireSchema('marketplaceCreateOrderSchema');
    if (!schema) return;

    expect(schema.safeParse({ productId: 'prd_123', quantity, policyAcceptance: { accepted: true } }).success).toBe(false);
  });

  it('accepts bounded order quantity', () => {
    const schema = requireSchema('marketplaceCreateOrderSchema');
    if (!schema) return;

    expect(schema.parse({ productId: 'prd_123', quantity: 2, policyAcceptance: { accepted: true } })).toEqual({ productId: 'prd_123', quantity: 2, policyAcceptance: { accepted: true } });
  });

  it.each([
    { rating: 0, content: 'bad' },
    { rating: 6, content: 'bad' },
    { rating: 4.5, content: 'bad' },
    { rating: 5, content: 'x'.repeat(2_001) },
  ])('rejects invalid reviews', (review) => {
    const schema = requireSchema('marketplaceCreateReviewSchema');
    if (!schema) return;

    expect(schema.safeParse(review).success).toBe(false);
  });

  it('parses a positive shop owner id and rejects ambiguous ids', () => {
    const schema = requireSchema('marketplaceShopOwnerParamsSchema');
    if (!schema) return;

    expect(schema.parse({ ownerId: '42' })).toEqual({ ownerId: 42 });
    expect(schema.safeParse({ ownerId: '1.5' }).success).toBe(false);
    expect(schema.safeParse({ ownerId: '-1' }).success).toBe(false);
  });

  it('accepts safe shop copy and rejects unsafe image URLs and extra fields', () => {
    const schema = requireSchema('marketplaceShopConfigSchema');
    if (!schema) return;

    expect(schema.safeParse({ shopName: 'Builder Shop', bannerUrl: '/uploads/banner.webp' }).success).toBe(true);
    expect(schema.safeParse({ bannerUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(schema.safeParse({ bannerUrl: 'http://127.0.0.1/banner.png' }).success).toBe(false);
    expect(schema.safeParse({ shopName: 'Builder Shop', ownerId: 99 }).success).toBe(false);
  });

  it('accepts only known metric kinds', () => {
    const schema = requireSchema('marketplaceShopMetricSchema');
    if (!schema) return;

    expect(schema.parse({ kind: 'announcement' })).toEqual({ kind: 'announcement' });
    expect(schema.safeParse({ kind: 'arbitrary' }).success).toBe(false);
  });

  it('validates bounded, non-sensitive verification review input', () => {
    const schema = requireSchema('marketplaceVerificationReviewSchema');
    if (!schema) return;

    expect(schema.safeParse({ status: 'VERIFIED', expiresAt: '2030-01-01T00:00:00.000Z' }).success).toBe(true);
    expect(schema.safeParse({ status: 'REJECTED', note: 'Needs an offline re-check.' }).success).toBe(true);
    expect(schema.safeParse({ status: 'PENDING' }).success).toBe(false);
    expect(schema.safeParse({ status: 'VERIFIED', documentNumber: 'secret' }).success).toBe(false);
  });
});
