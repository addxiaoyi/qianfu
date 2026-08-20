import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

import { loginWithCsrf } from './lib/smoke-session-login';
import { createScriptPrismaClient } from './utils/prismaClient';

dotenv.config();

type Status = 'PASS' | 'FAIL';
type Check = { name: string; status: Status; detail: string; code?: number };
type SessionState = { cookie: string };
type ApiResponse<T = any> = {
  status: number;
  ok: boolean;
  data: T | null;
  text: string;
  headers: Headers;
};
type CreatedState = {
  userIds: number[];
  productId: string | null;
  orderId: string | null;
  paymentId: string | null;
};

const BASE_URL = (process.env.SMOKE_WEB_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const ADMIN_IDENTIFIER = process.env.SMOKE_ADMIN_IDENTIFIER || 'dev_local';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || '';
const CREATE_DISPOSABLE_ADMIN = process.env.SMOKE_MARKETPLACE_CREATE_ADMIN === '1';
const CREATE_DISPOSABLE_USERS = CREATE_DISPOSABLE_ADMIN || process.env.SMOKE_MARKETPLACE_CREATE_USERS_DIRECT === '1';
const ALLOW_MUTATION = process.env.SMOKE_MARKETPLACE_ALLOW_MUTATION === '1';
const ALLOW_REMOTE = process.env.SMOKE_MARKETPLACE_ALLOW_REMOTE === '1';
const ALLOW_PRODUCTION = process.env.SMOKE_MARKETPLACE_ALLOW_PRODUCTION === '1';
const REPORT_PATH = process.env.SMOKE_REPORT_PATH
  || `logs/smoke-marketplace-closure-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

const browserHeaders: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

function assertSafeTarget(): void {
  if (!ALLOW_MUTATION) {
    throw new Error('Set SMOKE_MARKETPLACE_ALLOW_MUTATION=1 to authorize disposable marketplace writes');
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required so smoke-created records can be cleaned up');
  }
  const url = new URL(BASE_URL);
  const hostname = url.hostname.toLowerCase();
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const production = hostname === 'mc-u.top' || hostname.endsWith('.mc-u.top');
  if (CREATE_DISPOSABLE_ADMIN && !loopback) {
    throw new Error('Disposable smoke administrators are allowed only for loopback targets');
  }
  if (!ADMIN_PASSWORD && !CREATE_DISPOSABLE_ADMIN) {
    throw new Error('SMOKE_ADMIN_PASSWORD is required unless SMOKE_MARKETPLACE_CREATE_ADMIN=1 is used on loopback');
  }
  if (production && !ALLOW_PRODUCTION) {
    throw new Error('Production marketplace smoke is blocked; set SMOKE_MARKETPLACE_ALLOW_PRODUCTION=1 explicitly');
  }
  if (!loopback && !ALLOW_REMOTE && !ALLOW_PRODUCTION) {
    throw new Error('Remote marketplace smoke is blocked; use SMOKE_MARKETPLACE_ALLOW_REMOTE=1 for an isolated test host');
  }
}

function mergeCookies(existing: string, setCookie: string | null): string {
  if (!setCookie) return existing;
  const values = setCookie
    .split(/,(?=[^;]+=[^;]+)/g)
    .map((part) => part.trim().split(';')[0])
    .filter(Boolean);
  const cookies = new Map<string, string>();
  for (const part of existing.split(';')) {
    const segment = part.trim();
    const index = segment.indexOf('=');
    if (index > 0) cookies.set(segment.slice(0, index), segment.slice(index + 1));
  }
  for (const value of values) {
    const index = value.indexOf('=');
    if (index > 0) cookies.set(value.slice(0, index), value.slice(index + 1));
  }
  return Array.from(cookies, ([key, value]) => `${key}=${value}`).join('; ');
}

async function requestJson(
  path: string,
  init: RequestInit = {},
  session?: SessionState,
): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    ...(browserHeaders as Record<string, string>),
    ...((init.headers || {}) as Record<string, string>),
  };
  if (session?.cookie) headers.Cookie = session.cookie;
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (session) {
    const setCookie = (response.headers as any).getSetCookie?.().join(',') || response.headers.get('set-cookie');
    session.cookie = mergeCookies(session.cookie, setCookie);
  }
  const text = await response.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, ok: response.ok, data, text, headers: response.headers };
}

function message(response: ApiResponse): string {
  return response.data?.error?.message || response.data?.message || response.text.slice(0, 200) || `HTTP ${response.status}`;
}

function add(checks: Check[], name: string, pass: boolean, detail: string, code?: number): void {
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail, code });
}

function payload<T = any>(response: ApiResponse): T {
  return (response.data?.data ?? response.data) as T;
}

type MarketplaceTableAvailability = {
  appeals: boolean;
  productVersions: boolean;
  orderEvidence: boolean;
  deliveryEvidence: boolean;
};

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: unknown; meta?: { code?: unknown }; message?: unknown };
  const code = String(record.code || record.meta?.code || '');
  const messageText = String(record.message || '');
  return code === 'P2021'
    || code === '42P01'
    || /table .* does not exist/i.test(messageText)
    || /relation .* does not exist/i.test(messageText);
}

async function delegateTableAvailable(delegate: any): Promise<boolean> {
  try {
    await delegate.findFirst({ select: { id: true } });
    return true;
  } catch (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
}

async function getMarketplaceTableAvailability(prisma: any): Promise<MarketplaceTableAvailability> {
  const [appeals, productVersions, orderEvidence, deliveryEvidence] = await Promise.all([
    delegateTableAvailable(prisma.marketplaceAppeal),
    delegateTableAvailable(prisma.marketplaceProductVersion),
    delegateTableAvailable(prisma.marketplaceOrderEvidence),
    delegateTableAvailable(prisma.marketplaceDeliveryEvidence),
  ]);
  return { appeals, productVersions, orderEvidence, deliveryEvidence };
}

async function createDisposableAdmin(
  prisma: any,
  marker: string,
): Promise<{ id: number; email: string; password: string }> {
  const email = `market_admin_${marker}@example.com`;
  const password = `SmokeAdmin_${crypto.randomBytes(18).toString('base64url')}_A1!`;
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      email,
      username: `market_admin_${crypto.randomBytes(4).toString('hex')}`.slice(0, 28),
      display_name: 'Marketplace Smoke Admin',
      password_hash: passwordHash,
      password_changed_at: new Date(),
      role: 'ADMIN',
      permissions: JSON.stringify(['admin']),
      email_verified: true,
    },
    select: { id: true, email: true },
  });
  return { id: admin.id, email: admin.email, password };
}

async function createVerifiedUser(
  prisma: any,
  adminSession: SessionState,
  adminAuth: { token: string; csrfToken: string },
  label: string,
): Promise<{ id: number; email: string; username: string; password: string }> {
  const marker = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const email = `market_${label}_${marker}@example.com`;
  const username = `market_${label}_${marker}`.slice(0, 28);
  const password = `Smoke_${crypto.randomBytes(8).toString('hex')}_A1!`;

  if (CREATE_DISPOSABLE_USERS) {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        display_name: `Marketplace Smoke ${label}`,
        password_hash: passwordHash,
        password_changed_at: new Date(),
        role: 'NORMAL',
        permissions: JSON.stringify([]),
        email_verified: true,
      },
      select: { id: true, email: true, username: true },
    });
    return { id: user.id, email: user.email, username: user.username || username, password };
  }

  const registerSession: SessionState = { cookie: '' };
  const csrf = await requestJson('/api/v1/csrf-token', {}, registerSession);
  const csrfToken = payload<{ csrfToken?: string }>(csrf)?.csrfToken || csrf.data?.csrfToken || '';
  if (!csrf.ok || !csrfToken) throw new Error(`${label} CSRF bootstrap failed: ${message(csrf)}`);

  const registration = await requestJson('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ email, username, password, confirmPassword: password, agree: true }),
  }, registerSession);
  if (!registration.ok) throw new Error(`${label} registration failed: ${message(registration)}`);
  const id = Number(payload<any>(registration)?.user?.id || payload<any>(registration)?.id || 0);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} registration returned no user ID`);

  const verification = await requestJson(`/api/v1/admin/users/${id}/email-verification`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminAuth.token}`,
      'Content-Type': 'application/json',
      'x-csrf-token': adminAuth.csrfToken,
    },
    body: JSON.stringify({ email_verified: true }),
  }, adminSession);
  if (!verification.ok) throw new Error(`${label} verification failed: ${message(verification)}`);
  return { id, email, username, password };
}

async function cleanupCreated(prisma: any, created: CreatedState): Promise<void> {
  const userIds = created.userIds.filter((id) => Number.isSafeInteger(id) && id > 0);
  const targetIds = [created.productId, created.orderId, created.paymentId, ...userIds.map(String)].filter(Boolean) as string[];
  const resourceIds = [created.productId, created.orderId, created.paymentId].filter(Boolean) as string[];
  const tables = await getMarketplaceTableAvailability(prisma);
  await prisma.$transaction(async (tx: any) => {
    if (created.orderId) {
      if (tables.deliveryEvidence) {
        await tx.marketplaceDeliveryEvidence.deleteMany({ where: { order_id: created.orderId } });
      }
      if (tables.orderEvidence) {
        await tx.marketplaceOrderEvidence.deleteMany({ where: { order_id: created.orderId } });
      }
      await tx.marketplaceFulfillmentLog.deleteMany({ where: { order_id: created.orderId } });
      await tx.marketplaceOrder.deleteMany({ where: { id: created.orderId } });
    }
    if (created.paymentId) await tx.payment.deleteMany({ where: { id: created.paymentId } });
    if (created.productId) {
      await tx.marketplaceFavorite.deleteMany({ where: { product_id: created.productId } });
      await tx.marketplaceReview.deleteMany({ where: { product_id: created.productId } });
      await tx.marketplaceShopConfigVersion.deleteMany({ where: { product_id: created.productId } });
      if (tables.appeals) {
        await tx.marketplaceAppeal.deleteMany({ where: { target_type: 'PRODUCT', target_id: created.productId } });
      }
      if (tables.productVersions) {
        await tx.marketplaceProductVersion.deleteMany({ where: { product_id: created.productId } });
      }
      await tx.marketplaceProduct.deleteMany({ where: { id: created.productId } });
    }
    if (userIds.length > 0) {
      if (tables.appeals) {
        await tx.marketplaceAppeal.deleteMany({ where: { appellant_id: { in: userIds } } });
      }
      await tx.marketplaceShop.deleteMany({ where: { owner_id: { in: userIds } } });
      await tx.moderationLog.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.notification.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.session.deleteMany({ where: { user_id: { in: userIds } } });
      const wallets = await tx.wallet.findMany({ where: { user_id: { in: userIds } }, select: { id: true } });
      const walletIds = wallets.map((wallet: { id: number }) => wallet.id);
      if (walletIds.length > 0) await tx.transaction.deleteMany({ where: { wallet_id: { in: walletIds } } });
      await tx.wallet.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { user_id: { in: userIds } },
            { target: { in: targetIds } },
            ...resourceIds.map((id) => ({ target: { contains: id } })),
          ],
        },
      });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });
}

async function readCleanupResidualCounts(prisma: any, created: CreatedState): Promise<Record<string, number>> {
  const userIds = created.userIds.filter((id) => Number.isSafeInteger(id) && id > 0);
  const resourceIds = [created.productId, created.orderId, created.paymentId].filter(Boolean) as string[];
  const tables = await getMarketplaceTableAvailability(prisma);
  const counts: Record<string, number> = {
    users: userIds.length > 0 ? await prisma.user.count({ where: { id: { in: userIds } } }) : 0,
    products: created.productId ? await prisma.marketplaceProduct.count({ where: { id: created.productId } }) : 0,
    productVersions: tables.productVersions && created.productId
      ? await prisma.marketplaceProductVersion.count({ where: { product_id: created.productId } })
      : 0,
    orders: created.orderId ? await prisma.marketplaceOrder.count({ where: { id: created.orderId } }) : 0,
    orderEvidence: tables.orderEvidence && created.orderId
      ? await prisma.marketplaceOrderEvidence.count({ where: { order_id: created.orderId } })
      : 0,
    deliveryEvidence: tables.deliveryEvidence && created.orderId
      ? await prisma.marketplaceDeliveryEvidence.count({ where: { order_id: created.orderId } })
      : 0,
    appeals: tables.appeals
      ? await prisma.marketplaceAppeal.count({
        where: {
          OR: [
            ...(userIds.length > 0 ? [{ appellant_id: { in: userIds } }] : []),
            ...(created.productId ? [{ target_type: 'PRODUCT', target_id: created.productId }] : []),
          ],
        },
      })
      : 0,
    payments: created.paymentId ? await prisma.payment.count({ where: { id: created.paymentId } }) : 0,
    fulfillmentLogs: created.orderId ? await prisma.marketplaceFulfillmentLog.count({ where: { order_id: created.orderId } }) : 0,
    favorites: created.productId ? await prisma.marketplaceFavorite.count({ where: { product_id: created.productId } }) : 0,
    reviews: created.productId ? await prisma.marketplaceReview.count({ where: { product_id: created.productId } }) : 0,
    notifications: userIds.length > 0 ? await prisma.notification.count({ where: { user_id: { in: userIds } } }) : 0,
    sessions: userIds.length > 0 ? await prisma.session.count({ where: { user_id: { in: userIds } } }) : 0,
    audits: userIds.length > 0 || resourceIds.length > 0
      ? await prisma.auditLog.count({
        where: {
          OR: [
            ...(userIds.length > 0 ? [{ user_id: { in: userIds } }] : []),
            ...resourceIds.map((id) => ({ target: { contains: id } })),
          ],
        },
      })
      : 0,
  };
  return counts;
}

async function main(): Promise<void> {
  assertSafeTarget();
  const prisma = createScriptPrismaClient();
  const checks: Check[] = [];
  const created: CreatedState = { userIds: [], productId: null, orderId: null, paymentId: null };
  const adminSession: SessionState = { cookie: '' };
  const sellerSession: SessionState = { cookie: '' };
  const buyerSession: SessionState = { cookie: '' };
  const marker = `marketplace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  let cleanupError: string | null = null;

  try {
    let adminIdentifier = ADMIN_IDENTIFIER;
    let adminPassword = ADMIN_PASSWORD;
    if (CREATE_DISPOSABLE_ADMIN) {
      const disposableAdmin = await createDisposableAdmin(prisma, marker);
      created.userIds.push(disposableAdmin.id);
      adminIdentifier = disposableAdmin.email;
      adminPassword = disposableAdmin.password;
      add(checks, 'disposable-admin', true, `admin=${disposableAdmin.id}`);
    }

    const adminAuth = await loginWithCsrf(requestJson, adminSession, adminIdentifier, adminPassword);
    add(checks, 'admin-login', true, `admin=${adminIdentifier}`, adminAuth.login.status);

    const seller = await createVerifiedUser(prisma, adminSession, adminAuth, 'seller');
    const buyer = await createVerifiedUser(prisma, adminSession, adminAuth, 'buyer');
    created.userIds.push(seller.id, buyer.id);
    add(checks, 'disposable-users', true, `seller=${seller.id} buyer=${buyer.id}`);

    const sellerAuth = await loginWithCsrf(requestJson, sellerSession, seller.email, seller.password);
    const buyerAuth = await loginWithCsrf(requestJson, buyerSession, buyer.email, buyer.password);
    const sellerHeaders = {
      Authorization: `Bearer ${sellerAuth.token}`,
      'Content-Type': 'application/json',
      'x-csrf-token': sellerAuth.csrfToken,
    };
    const buyerHeaders = {
      Authorization: `Bearer ${buyerAuth.token}`,
      'Content-Type': 'application/json',
      'x-csrf-token': buyerAuth.csrfToken,
    };
    const adminHeaders = {
      Authorization: `Bearer ${adminAuth.token}`,
      'Content-Type': 'application/json',
      'x-csrf-token': adminAuth.csrfToken,
    };

    const productFileSha256 = crypto.createHash('sha256').update(marker).digest('hex');
    const createProduct = await requestJson('/api/v1/qianfu/marketplace/products', {
      method: 'POST',
      headers: sellerHeaders,
      body: JSON.stringify({
        title: `Smoke product ${marker}`,
        category: 'template',
        description: `Disposable marketplace closure product ${marker}`,
        price: 1234,
        currency: 'CNY',
        taxIncluded: true,
        additionalFees: 0,
        validityText: 'Valid for the duration of this disposable smoke test',
        deliveryMethod: 'Digital download',
        deliveryEta: 'Available immediately after payment confirmation',
        compatibility: 'Minecraft Java Edition 1.20.1 smoke environment',
        isPlatformOperated: false,
        sellerIdentity: `Verified disposable seller ${seller.id}`,
        afterSalesContact: 'Platform ticket support',
        refundTerms: 'Refunds follow the platform digital goods policy',
        ipSource: 'Original disposable smoke-test content',
        prohibitedUse: 'No redistribution, resale, or unlawful use',
        riskNotice: 'Use only in an isolated smoke-test environment',
        productVersion: '1.0.0',
        fileSha256: productFileSha256,
        assetSize: 1024,
        assetMime: 'application/zip',
        author: seller.username,
        coverUrl: '/uploads/probe.png',
        downloadUrl: `/uploads/${marker}.zip`,
      }),
    }, sellerSession);
    created.productId = payload<any>(createProduct)?.product?.id || null;
    add(checks, 'seller-create-product', createProduct.ok && Boolean(created.productId), createProduct.ok ? `product=${created.productId}` : message(createProduct), createProduct.status);
    if (!created.productId) throw new Error('Product creation did not return an ID');

    const preReviewOrder = await requestJson('/api/v1/qianfu/marketplace/orders', {
      method: 'POST',
      headers: { ...buyerHeaders, 'Idempotency-Key': `pre-${crypto.randomUUID()}` },
      body: JSON.stringify({ productId: created.productId, quantity: 1, policyAcceptance: { accepted: true } }),
    }, buyerSession);
    add(checks, 'unapproved-product-blocked', preReviewOrder.status === 409, message(preReviewOrder), preReviewOrder.status);

    const crossOwnerUpdate = await requestJson(`/api/v1/qianfu/marketplace/products/${created.productId}`, {
      method: 'PATCH',
      headers: buyerHeaders,
      body: JSON.stringify({ title: `Unauthorized ${marker}` }),
    }, buyerSession);
    add(checks, 'cross-owner-update-blocked', crossOwnerUpdate.status === 403, message(crossOwnerUpdate), crossOwnerUpdate.status);

    const approveProduct = await requestJson(`/api/v1/qianfu/marketplace/products/${created.productId}/review`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'APPROVED', notes: `approved smoke ${marker}` }),
    }, adminSession);
    const approved = payload<any>(approveProduct)?.product;
    add(checks, 'admin-approve-product', approveProduct.ok && approved?.listingStatus === 'APPROVED' && approved?.isPublished === true, approveProduct.ok ? `status=${approved?.listingStatus}` : message(approveProduct), approveProduct.status);

    const favorite = await requestJson(`/api/v1/qianfu/marketplace/products/${created.productId}/favorite`, {
      method: 'POST', headers: buyerHeaders, body: '{}',
    }, buyerSession);
    add(checks, 'buyer-favorite', favorite.ok && payload<any>(favorite)?.favorite === true, message(favorite), favorite.status);

    const idempotencyKey = `smoke:${crypto.randomUUID()}`;
    const createOrder = await requestJson('/api/v1/qianfu/marketplace/orders', {
      method: 'POST',
      headers: { ...buyerHeaders, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ productId: created.productId, quantity: 1, policyAcceptance: { accepted: true } }),
    }, buyerSession);
    const orderPayload = payload<any>(createOrder);
    created.orderId = orderPayload?.order?.id || null;
    created.paymentId = orderPayload?.payment?.id || orderPayload?.order?.paymentId || null;
    add(checks, 'buyer-create-order', createOrder.ok && Boolean(created.orderId) && Boolean(created.paymentId), createOrder.ok ? `order=${created.orderId} payment=${created.paymentId}` : message(createOrder), createOrder.status);
    if (!created.orderId || !created.paymentId) throw new Error('Order creation did not return order and payment IDs');

    const replayOrder = await requestJson('/api/v1/qianfu/marketplace/orders', {
      method: 'POST',
      headers: { ...buyerHeaders, 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ productId: created.productId, quantity: 1, policyAcceptance: { accepted: true } }),
    }, buyerSession);
    const replayPayload = payload<any>(replayOrder);
    add(checks, 'order-idempotency', replayOrder.ok && replayPayload?.replayed === true && replayPayload?.order?.id === created.orderId, replayOrder.ok ? `replayed=${String(replayPayload?.replayed)}` : message(replayOrder), replayOrder.status);

    const orderBeforePayment = await requestJson(`/api/v1/qianfu/marketplace/orders/${created.orderId}`, {
      headers: { Authorization: `Bearer ${buyerAuth.token}` },
    }, buyerSession);
    const pendingOrder = payload<any>(orderBeforePayment);
    add(
      checks,
      'buyer-can-pay-pending-order',
      orderBeforePayment.ok
        && pendingOrder?.permissions?.canPay === true
        && pendingOrder?.order?.paymentStatus === 'PENDING'
        && pendingOrder?.order?.paymentId === created.paymentId,
      orderBeforePayment.ok
        ? `canPay=${String(pendingOrder?.permissions?.canPay)} payment=${pendingOrder?.order?.paymentStatus}`
        : message(orderBeforePayment),
      orderBeforePayment.status,
    );

    const paymentBeforeCompletion = await requestJson(`/api/v1/payment/status/${created.paymentId}`, {
      headers: { Authorization: `Bearer ${buyerAuth.token}` },
    }, buyerSession);
    const pendingPayment = payload<any>(paymentBeforeCompletion);
    add(
      checks,
      'pending-payment-links-marketplace-order',
      paymentBeforeCompletion.ok
        && pendingPayment?.status === 'PENDING'
        && pendingPayment?.planId === 'marketplace'
        && pendingPayment?.marketplaceOrderId === created.orderId,
      paymentBeforeCompletion.ok
        ? `status=${pendingPayment?.status} marketplaceOrder=${pendingPayment?.marketplaceOrderId}`
        : message(paymentBeforeCompletion),
      paymentBeforeCompletion.status,
    );

    const completePayment = await requestJson('/api/v1/payment/admin/complete-order', {
      method: 'POST', headers: adminHeaders, body: JSON.stringify({ orderId: created.paymentId }),
    }, adminSession);
    add(checks, 'admin-complete-payment', completePayment.ok, completePayment.ok ? `payment=${created.paymentId}` : message(completePayment), completePayment.status);

    const paymentAfterCompletion = await requestJson(`/api/v1/payment/status/${created.paymentId}`, {
      headers: { Authorization: `Bearer ${buyerAuth.token}` },
    }, buyerSession);
    const completedPayment = payload<any>(paymentAfterCompletion);
    add(
      checks,
      'completed-payment-links-marketplace-order',
      paymentAfterCompletion.ok
        && completedPayment?.status === 'COMPLETED'
        && completedPayment?.planId === 'marketplace'
        && completedPayment?.marketplaceOrderId === created.orderId,
      paymentAfterCompletion.ok
        ? `status=${completedPayment?.status} marketplaceOrder=${completedPayment?.marketplaceOrderId}`
        : message(paymentAfterCompletion),
      paymentAfterCompletion.status,
    );

    const orderAfterPayment = await requestJson(`/api/v1/qianfu/marketplace/orders/${created.orderId}`, {
      headers: { Authorization: `Bearer ${buyerAuth.token}` },
    }, buyerSession);
    const paidOrder = payload<any>(orderAfterPayment)?.order;
    const paidOrderResponse = payload<any>(orderAfterPayment);
    add(
      checks,
      'buyer-can-download-paid-order',
      orderAfterPayment.ok
        && paidOrder?.paymentStatus === 'PAID'
        && paidOrder?.fulfillmentStatus === 'DELIVERED'
        && paidOrder?.deliveryUrl === null
        && paidOrderResponse?.permissions?.canDownload === true
        && paidOrderResponse?.permissions?.canPay === false,
      orderAfterPayment.ok
        ? `payment=${paidOrder?.paymentStatus} fulfillment=${paidOrder?.fulfillmentStatus} canDownload=${String(paidOrderResponse?.permissions?.canDownload)}`
        : message(orderAfterPayment),
      orderAfterPayment.status,
    );

    const download = await requestJson(`/api/v1/qianfu/marketplace/orders/${created.orderId}/download`, {
      method: 'POST',
      headers: buyerHeaders,
      body: '{}',
    }, buyerSession);
    const downloadPayload = payload<any>(download);
    add(
      checks,
      'buyer-download-issuance',
      download.ok && downloadPayload?.downloadUrl === `/uploads/${marker}.zip`,
      download.ok ? `downloadUrl=${downloadPayload?.downloadUrl || 'missing'}` : message(download),
      download.status,
    );

    const fulfill = await requestJson(`/api/v1/qianfu/marketplace/orders/${created.orderId}/fulfill`, {
      method: 'POST', headers: sellerHeaders, body: '{}',
    }, sellerSession);
    add(checks, 'seller-fulfillment-idempotent', fulfill.ok && payload<any>(fulfill)?.replayed === true, fulfill.ok ? `replayed=${String(payload<any>(fulfill)?.replayed)}` : message(fulfill), fulfill.status);

    const review = await requestJson(`/api/v1/qianfu/marketplace/products/${created.productId}/reviews`, {
      method: 'POST', headers: buyerHeaders, body: JSON.stringify({ rating: 5, content: `Smoke review ${marker}` }),
    }, buyerSession);
    add(checks, 'buyer-review-after-payment', review.ok, review.ok ? 'review stored' : message(review), review.status);

    const dispute = await requestJson(`/api/v1/qianfu/marketplace/orders/${created.orderId}/dispute`, {
      method: 'POST',
      headers: buyerHeaders,
      body: JSON.stringify({ reason: 'NOT_AS_DESCRIBED', description: `Smoke dispute evidence for ${marker}` }),
    }, buyerSession);
    add(checks, 'buyer-open-dispute', dispute.ok && payload<any>(dispute)?.order?.disputeStatus === 'OPEN', dispute.ok ? `status=${payload<any>(dispute)?.order?.disputeStatus}` : message(dispute), dispute.status);

    const resolveDispute = await requestJson(`/api/v1/qianfu/marketplace/orders/${created.orderId}/dispute/resolve`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'RESOLVED', resolution: `Smoke resolution ${marker}` }),
    }, adminSession);
    add(checks, 'admin-resolve-dispute', resolveDispute.ok && payload<any>(resolveDispute)?.order?.disputeStatus === 'RESOLVED', resolveDispute.ok ? `status=${payload<any>(resolveDispute)?.order?.disputeStatus}` : message(resolveDispute), resolveDispute.status);

    const removeFavorite = await requestJson(`/api/v1/qianfu/marketplace/products/${created.productId}/favorite`, {
      method: 'POST', headers: buyerHeaders, body: '{}',
    }, buyerSession);
    add(checks, 'buyer-remove-favorite', removeFavorite.ok && payload<any>(removeFavorite)?.favorite === false, message(removeFavorite), removeFavorite.status);
  } catch (error) {
    add(checks, 'unexpected-error', false, error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await cleanupCreated(prisma, created);
      const residualCounts = await readCleanupResidualCounts(prisma, created);
      const residualEntries = Object.entries(residualCounts).filter(([, count]) => count !== 0);
      if (residualEntries.length > 0) {
        cleanupError = `Cleanup left residual records: ${residualEntries.map(([name, count]) => `${name}=${count}`).join(', ')}`;
        add(checks, 'cleanup', false, cleanupError);
      } else {
        add(
          checks,
          'cleanup',
          true,
          `users=${created.userIds.length} product=${created.productId || 'none'} order=${created.orderId || 'none'} payment=${created.paymentId || 'none'} residual=0`,
        );
      }
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : String(error);
      add(checks, 'cleanup', false, cleanupError);
    }
    await prisma.$disconnect();
  }

  const failed = checks.filter((check) => check.status === 'FAIL');
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    marker,
    created,
    cleanupError,
    checks,
    failedCount: failed.length,
  };
  const reportPath = resolve(process.cwd(), REPORT_PATH);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[smoke:marketplace] Base URL: ${BASE_URL}`);
  for (const check of checks) console.log(`- ${check.status} ${check.name}: ${check.detail}`);
  console.log(`[smoke:marketplace] Report written to: ${reportPath}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[smoke:marketplace] Fatal error:', error);
  process.exitCode = 1;
});
