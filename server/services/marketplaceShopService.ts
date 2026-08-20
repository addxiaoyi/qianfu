import { randomUUID } from 'node:crypto';
import type { Prisma } from '../../prisma/generated/client/index.js';
import prisma from '../db';
import { redisService } from './redisService';
import { AppError, ErrorCode } from '../utils/errors';
import type {
  MarketplaceShopConfigInput,
  MarketplaceShopMetricInput,
  MarketplaceVerificationReviewInput,
} from '../core/controller/marketplaceSchemas';

export type MarketplaceShopTheme = 'default' | 'tech' | 'minimal' | 'creator';
export type MarketplaceVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface MarketplaceShopConfig {
  bannerUrl: string;
  avatarUrl: string;
  announcementTitle: string;
  announcementText: string;
  bio: string;
  shopName: string;
  ownerId: number;
  theme: MarketplaceShopTheme;
}

export interface MarketplaceShopMetrics {
  visits: number;
  announcementClicks: number;
  featuredClicks: number;
  updatedAt: string;
}

export interface MarketplaceShopVersion {
  id: string;
  config: MarketplaceShopConfig;
  createdAt: string;
}

export interface MarketplaceVerificationView {
  status: MarketplaceVerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string | null;
}

interface MarketplaceVerificationAudit extends MarketplaceVerificationView {
  reviewedBy: number | null;
  note: string | null;
}

interface Change<T> {
  before: T;
  after: T;
}

const sellerSelect = {
  id: true,
  username: true,
  display_name: true,
  avatar_url: true,
  marketplace_seller_status: true,
  marketplace_verification_status: true,
  marketplace_verification_submitted_at: true,
  marketplace_verification_reviewed_at: true,
  marketplace_verification_reviewed_by: true,
  marketplace_verification_note: true,
  marketplace_verification_expires_at: true,
} satisfies Prisma.UserSelect;

type MarketplaceSeller = Prisma.UserGetPayload<{ select: typeof sellerSelect }>;
type MarketplaceShopRecord = Awaited<ReturnType<Prisma.TransactionClient['marketplaceShop']['findUniqueOrThrow']>>;

const knownVerificationStatuses = new Set<MarketplaceVerificationStatus>([
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
]);

const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

export function getEffectiveMarketplaceVerificationStatus(
  status: string,
  expiresAt: Date | null,
  now = new Date(),
): MarketplaceVerificationStatus {
  const normalized = knownVerificationStatuses.has(status as MarketplaceVerificationStatus)
    ? status as MarketplaceVerificationStatus
    : 'UNVERIFIED';

  if (normalized === 'VERIFIED' && expiresAt && expiresAt.getTime() <= now.getTime()) {
    return 'EXPIRED';
  }
  return normalized;
}

export const canEditMarketplaceShop = (viewerId: number | null | undefined, ownerId: number): boolean => (
  viewerId === ownerId
);

const toVerificationView = (seller: MarketplaceSeller, now = new Date()): MarketplaceVerificationView => ({
  status: getEffectiveMarketplaceVerificationStatus(
    seller.marketplace_verification_status,
    seller.marketplace_verification_expires_at,
    now,
  ),
  submittedAt: toIso(seller.marketplace_verification_submitted_at),
  reviewedAt: toIso(seller.marketplace_verification_reviewed_at),
  expiresAt: toIso(seller.marketplace_verification_expires_at),
});

const toVerificationAudit = (seller: MarketplaceSeller, now = new Date()): MarketplaceVerificationAudit => ({
  ...toVerificationView(seller, now),
  reviewedBy: seller.marketplace_verification_reviewed_by,
  note: seller.marketplace_verification_note,
});

const defaultShopFields = (seller: MarketplaceSeller) => ({
  owner_id: seller.id,
  banner_url: '',
  avatar_url: seller.avatar_url || '',
  announcement_title: '',
  announcement_text: '',
  bio: '',
  shop_name: seller.display_name || seller.username || 'Creator shop',
  theme: 'default',
});

const toShopConfig = (shop: MarketplaceShopRecord): MarketplaceShopConfig => ({
  bannerUrl: shop.banner_url,
  avatarUrl: shop.avatar_url,
  announcementTitle: shop.announcement_title,
  announcementText: shop.announcement_text,
  bio: shop.bio,
  shopName: shop.shop_name,
  ownerId: shop.owner_id,
  theme: shop.theme as MarketplaceShopTheme,
});

const toShopMetrics = (shop: MarketplaceShopRecord): MarketplaceShopMetrics => ({
  visits: shop.visit_count,
  announcementClicks: shop.announcement_click_count,
  featuredClicks: shop.featured_click_count,
  updatedAt: shop.updated_at.toISOString(),
});

const toShopVersion = (version: {
  id: string;
  owner_id: number | null;
  banner_url: string;
  avatar_url: string;
  announcement_title: string;
  announcement_text: string;
  bio: string;
  shop_name: string;
  theme: string;
  created_at: Date;
}): MarketplaceShopVersion => ({
  id: version.id,
  config: {
    bannerUrl: version.banner_url,
    avatarUrl: version.avatar_url,
    announcementTitle: version.announcement_title,
    announcementText: version.announcement_text,
    bio: version.bio,
    shopName: version.shop_name,
    ownerId: version.owner_id ?? 0,
    theme: version.theme as MarketplaceShopTheme,
  },
  createdAt: version.created_at.toISOString(),
});

const findSeller = async (ownerId: number): Promise<MarketplaceSeller> => {
  const seller = await prisma.user.findUnique({ where: { id: ownerId }, select: sellerSelect });
  if (!seller) {
    throw new AppError('Seller not found', 404, ErrorCode.NOT_FOUND);
  }
  return seller;
};

const requireActiveSeller = async (ownerId: number): Promise<MarketplaceSeller> => {
  const seller = await findSeller(ownerId);
  if (seller.marketplace_seller_status !== 'ACTIVE') {
    throw new AppError('Marketplace seller access is suspended', 403, ErrorCode.FORBIDDEN);
  }
  return seller;
};

const upsertShop = async (
  tx: Prisma.TransactionClient,
  seller: MarketplaceSeller,
): Promise<MarketplaceShopRecord> => tx.marketplaceShop.upsert({
  where: { owner_id: seller.id },
  create: defaultShopFields(seller),
  update: {},
});

const saveVersion = async (tx: Prisma.TransactionClient, shop: MarketplaceShopRecord): Promise<void> => {
  await tx.marketplaceShopConfigVersion.updateMany({
    where: { owner_id: shop.owner_id, is_active: true },
    data: { is_active: false },
  });
  await tx.marketplaceShopConfigVersion.create({
    data: {
      id: `shopver_${randomUUID()}`,
      owner_id: shop.owner_id,
      banner_url: shop.banner_url,
      avatar_url: shop.avatar_url,
      announcement_title: shop.announcement_title,
      announcement_text: shop.announcement_text,
      bio: shop.bio,
      shop_name: shop.shop_name,
      theme: shop.theme,
      visit_count: shop.visit_count,
      click_count: shop.announcement_click_count + shop.featured_click_count,
      is_active: true,
      created_at: new Date(),
    },
  });
};

export async function getMarketplaceShop(ownerId: number, viewerId?: number | null) {
  const seller = await requireActiveSeller(ownerId);
  const shop = await prisma.marketplaceShop.upsert({
    where: { owner_id: ownerId },
    create: { ...defaultShopFields(seller), visit_count: 1 },
    update: { visit_count: { increment: 1 } },
  });
  const editable = canEditMarketplaceShop(viewerId, ownerId);
  const versions = editable
    ? await prisma.marketplaceShopConfigVersion.findMany({
      where: { owner_id: ownerId },
      orderBy: { created_at: 'desc' },
      take: 8,
    })
    : [];

  return {
    config: toShopConfig(shop),
    editable,
    metrics: toShopMetrics(shop),
    verification: toVerificationView(seller),
    versions: versions.map(toShopVersion),
  };
}

export async function getMarketplaceShopHistory(ownerId: number): Promise<MarketplaceShopVersion[]> {
  await requireActiveSeller(ownerId);
  const versions = await prisma.marketplaceShopConfigVersion.findMany({
    where: { owner_id: ownerId },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  return versions.map(toShopVersion);
}

export async function updateMarketplaceShop(
  ownerId: number,
  input: MarketplaceShopConfigInput,
): Promise<Change<MarketplaceShopConfig>> {
  const seller = await requireActiveSeller(ownerId);
  return redisService.withLock(`marketplace_shop:${ownerId}`, async () => prisma.$transaction(async (tx) => {
    const current = await upsertShop(tx, seller);
    const before = toShopConfig(current);
    const shop = await tx.marketplaceShop.update({
      where: { owner_id: ownerId },
      data: {
        banner_url: input.bannerUrl,
        avatar_url: input.avatarUrl,
        announcement_title: input.announcementTitle,
        announcement_text: input.announcementText,
        bio: input.bio,
        shop_name: input.shopName,
        theme: input.theme,
      },
    });
    await saveVersion(tx, shop);
    return { before, after: toShopConfig(shop) };
  }));
}

export async function resetMarketplaceShop(ownerId: number): Promise<Change<MarketplaceShopConfig>> {
  const seller = await requireActiveSeller(ownerId);
  return redisService.withLock(`marketplace_shop:${ownerId}`, async () => prisma.$transaction(async (tx) => {
    const current = await upsertShop(tx, seller);
    const before = toShopConfig(current);
    const defaults = defaultShopFields(seller);
    const shop = await tx.marketplaceShop.update({
      where: { owner_id: ownerId },
      data: {
        banner_url: defaults.banner_url,
        avatar_url: defaults.avatar_url,
        announcement_title: defaults.announcement_title,
        announcement_text: defaults.announcement_text,
        bio: defaults.bio,
        shop_name: defaults.shop_name,
        theme: defaults.theme,
      },
    });
    await saveVersion(tx, shop);
    return { before, after: toShopConfig(shop) };
  }));
}

export async function applyMarketplaceShopTheme(
  ownerId: number,
  theme: MarketplaceShopTheme,
): Promise<Change<MarketplaceShopConfig>> {
  const seller = await requireActiveSeller(ownerId);
  return redisService.withLock(`marketplace_shop:${ownerId}`, async () => prisma.$transaction(async (tx) => {
    const current = await upsertShop(tx, seller);
    const before = toShopConfig(current);
    const shop = await tx.marketplaceShop.update({
      where: { owner_id: ownerId },
      data: { theme },
    });
    await saveVersion(tx, shop);
    return { before, after: toShopConfig(shop) };
  }));
}

export async function incrementMarketplaceShopMetric(
  ownerId: number,
  kind: MarketplaceShopMetricInput['kind'],
): Promise<MarketplaceShopMetrics> {
  const seller = await requireActiveSeller(ownerId);
  const update = kind === 'announcement'
    ? { announcement_click_count: { increment: 1 } }
    : { featured_click_count: { increment: 1 } };
  const create = {
    ...defaultShopFields(seller),
    announcement_click_count: kind === 'announcement' ? 1 : 0,
    featured_click_count: kind === 'featured' ? 1 : 0,
  };
  const shop = await prisma.marketplaceShop.upsert({
    where: { owner_id: ownerId },
    create,
    update,
  });
  return toShopMetrics(shop);
}

export async function getMarketplaceVerification(ownerId: number): Promise<MarketplaceVerificationView> {
  return toVerificationView(await findSeller(ownerId));
}

export async function submitMarketplaceVerification(
  ownerId: number,
): Promise<Change<MarketplaceVerificationAudit>> {
  return redisService.withLock(`marketplace_verification:${ownerId}`, async () => {
    const seller = await requireActiveSeller(ownerId);
    const effectiveStatus = getEffectiveMarketplaceVerificationStatus(
      seller.marketplace_verification_status,
      seller.marketplace_verification_expires_at,
    );
    if (effectiveStatus === 'PENDING') {
      throw new AppError('Verification is already pending', 409, ErrorCode.CONFLICT);
    }
    if (effectiveStatus === 'VERIFIED') {
      throw new AppError('Seller is already verified', 409, ErrorCode.CONFLICT);
    }

    const before = toVerificationAudit(seller);
    const updated = await prisma.user.update({
      where: { id: ownerId },
      data: {
        marketplace_verification_status: 'PENDING',
        marketplace_verification_submitted_at: new Date(),
        marketplace_verification_reviewed_at: null,
        marketplace_verification_reviewed_by: null,
        marketplace_verification_note: null,
        marketplace_verification_expires_at: null,
      },
      select: sellerSelect,
    });
    return { before, after: toVerificationAudit(updated) };
  });
}

export async function reviewMarketplaceVerification(
  ownerId: number,
  reviewerId: number,
  input: MarketplaceVerificationReviewInput,
): Promise<Change<MarketplaceVerificationAudit>> {
  return redisService.withLock(`marketplace_verification:${ownerId}`, async () => {
    const seller = await findSeller(ownerId);
    const before = toVerificationAudit(seller);
    const reviewedAt = new Date();
    const updated = await prisma.user.update({
      where: { id: ownerId },
      data: {
        marketplace_verification_status: input.status,
        marketplace_verification_reviewed_at: reviewedAt,
        marketplace_verification_reviewed_by: reviewerId,
        marketplace_verification_note: input.note || null,
        marketplace_verification_expires_at: input.status === 'EXPIRED'
          ? reviewedAt
          : input.expiresAt ? new Date(input.expiresAt) : null,
      },
      select: sellerSelect,
    });
    return { before, after: toVerificationAudit(updated, reviewedAt) };
  });
}
