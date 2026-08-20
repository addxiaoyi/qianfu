import { safeJsonParse } from '../utils/json.js';
import crypto from 'crypto';
import prisma from '../db.js';
import { invalidateUserCache } from '../middleware/auth.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { generateTransactionSignature } from '../lib/wallet.js';
import { logger } from '../utils/logger.js';
import { redisService } from './redisService.js';
const OFFICIAL_BASES = {
    test: 'https://test-api.creem.io',
    production: 'https://api.creem.io',
};
const DEFAULT_TIMEOUT_MS = 12_000;
const ACCESS_PERMISSIONS = ['sponsor_badge', 'priority_support', 'early_access'];
const PAID_EVENTS = new Set(['checkout.completed', 'subscription.paid']);
const ACTIVE_EVENTS = new Set(['subscription.paid', 'subscription.trialing']);
const RETAIN_UNTIL_PERIOD_END_EVENTS = new Set([
    'subscription.scheduled_cancel',
    'subscription.canceled',
    'subscription.past_due',
]);
const REVOKE_EVENTS = new Set(['subscription.expired', 'subscription.paused']);
const asRecord = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const asString = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || undefined;
};
const asNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
const asDate = (value) => {
    const text = asString(value);
    if (!text)
        return undefined;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
const normalizeCurrency = (value) => asString(value)?.toUpperCase();
export const normalizeCreemMode = (value) => {
    const mode = asString(value)?.toLowerCase();
    if (mode === 'prod' || mode === 'production')
        return 'production';
    if (mode === 'test' || mode === 'sandbox')
        return 'test';
    return undefined;
};
export const resolveCreemApiBaseUrl = (config) => {
    const configured = asString(config.apiBaseUrl)?.replace(/\/+$/, '');
    const official = OFFICIAL_BASES[config.mode];
    if (!configured)
        return official;
    if (configured === official)
        return official;
    const allowCustom = process.env.NODE_ENV === 'test'
        || (config.mode === 'test' && String(process.env.CREEM_ALLOW_CUSTOM_API_BASE || '').toLowerCase() === 'true');
    if (!allowCustom) {
        throw new AppError('Creem API base URL does not match the configured mode', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    return configured;
};
const parseProductMap = (raw) => {
    if (!raw)
        return {};
    if (typeof raw === 'object')
        return raw;
    try {
        const parsed = (() => { try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        } })();
        return asRecord(parsed) || {};
    }
    catch {
        throw new AppError('Creem product map is invalid JSON', 500, ErrorCode.INTERNAL_ERROR);
    }
};
const parsePositiveInteger = (value, field) => {
    const parsed = asNumber(value);
    if (parsed === undefined || !Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new AppError(`Creem ${field} must be a positive integer`, 500, ErrorCode.INTERNAL_ERROR);
    }
    return parsed;
};
const resolveProductMapEntry = (config, payment) => {
    const map = parseProductMap(config.productMap);
    const currency = payment.currency.toUpperCase();
    const candidates = [
        `${payment.plan_id}:${payment.amount}:${currency}`,
        `${payment.plan_id}:${payment.amount}`,
        payment.plan_id,
    ];
    for (const key of candidates) {
        const entry = map[key];
        if (typeof entry === 'string' && entry.trim())
            return entry.trim();
        const record = asRecord(entry);
        if (record)
            return record;
    }
    const fallback = asString(config.productId);
    if (fallback)
        return fallback;
    throw new AppError(`Creem product is not mapped for plan ${payment.plan_id}`, 503, ErrorCode.SERVICE_UNAVAILABLE);
};
export const resolveCreemCheckoutTerms = (config, payment) => {
    const paymentCurrency = payment.currency.toUpperCase();
    const entry = resolveProductMapEntry(config, payment);
    if (typeof entry === 'string') {
        return {
            productId: entry,
            checkoutAmount: payment.amount,
            checkoutCurrency: paymentCurrency,
            walletCreditAmount: payment.amount,
            walletCreditCurrency: paymentCurrency,
        };
    }
    const productId = asString(entry.productId ?? entry.product_id ?? entry.id);
    if (!productId) {
        throw new AppError('Creem product map entry is missing productId', 500, ErrorCode.INTERNAL_ERROR);
    }
    const checkoutCurrency = normalizeCurrency(entry.checkoutCurrency ?? entry.checkout_currency ?? entry.currency);
    const walletCreditCurrency = normalizeCurrency(entry.walletCreditCurrency ?? entry.wallet_credit_currency ?? paymentCurrency);
    if (!checkoutCurrency || !walletCreditCurrency) {
        throw new AppError('Creem product map entry is missing currency', 500, ErrorCode.INTERNAL_ERROR);
    }
    const walletCreditAmount = parsePositiveInteger(entry.walletCreditAmount ?? entry.wallet_credit_amount ?? payment.amount, 'wallet credit amount');
    if (walletCreditAmount !== payment.amount || walletCreditCurrency !== paymentCurrency) {
        throw new AppError('Creem wallet credit mapping does not match the payment', 409, ErrorCode.CONFLICT);
    }
    return {
        productId,
        checkoutAmount: parsePositiveInteger(entry.checkoutAmount ?? entry.checkout_amount ?? entry.price, 'checkout amount'),
        checkoutCurrency,
        walletCreditAmount,
        walletCreditCurrency,
    };
};
export const resolveCreemWalletReversal = (input) => {
    const expectedCheckoutAmount = parsePositiveInteger(input.expectedCheckoutAmount, 'expected checkout amount');
    const walletCreditAmount = parsePositiveInteger(input.walletCreditAmount, 'wallet credit amount');
    const refundAmount = parsePositiveInteger(input.refundAmount, 'refund amount');
    const reversedCheckoutAmount = Math.max(0, Math.min(expectedCheckoutAmount, input.reversedCheckoutAmount));
    const reversedWalletCreditAmount = Math.max(0, Math.min(walletCreditAmount, input.reversedWalletCreditAmount));
    const checkoutAmount = Math.min(expectedCheckoutAmount, reversedCheckoutAmount + refundAmount);
    const targetWalletCreditAmount = checkoutAmount === expectedCheckoutAmount
        ? walletCreditAmount
        : Math.floor((checkoutAmount * walletCreditAmount) / expectedCheckoutAmount);
    return {
        checkoutAmount,
        walletCreditAmount: Math.max(0, targetWalletCreditAmount - reversedWalletCreditAmount),
    };
};
export const resolveCreemProductId = (config, payment) => {
    try {
        return resolveCreemCheckoutTerms(config, payment).productId;
    }
    catch (error) {
        const fallback = asString(config.productId);
        if (fallback)
            return fallback;
        throw error;
    }
};
const requestCreemJson = async (config, path, init) => {
    if (!config.apiKey.trim()) {
        throw new AppError('Creem API key is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
        const response = await fetch(`${resolveCreemApiBaseUrl(config)}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey.trim(),
                ...(init.headers || {}),
            },
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
            const message = asRecord(payload) ? asString(asRecord(payload)?.message) : undefined;
            throw new AppError(`Creem API request failed: ${message || `HTTP ${response.status}`}`, 502, ErrorCode.PAYMENT_FAILED);
        }
        return payload;
    }
    catch (error) {
        if (error instanceof AppError)
            throw error;
        if (error instanceof Error && error.name === 'AbortError') {
            throw new AppError('Creem API request timed out', 504, ErrorCode.SERVICE_UNAVAILABLE);
        }
        throw new AppError('Creem API request failed', 502, ErrorCode.SERVICE_UNAVAILABLE);
    }
    finally {
        clearTimeout(timer);
    }
};
export const fetchCreemProduct = async (config, productId) => {
    const payload = await requestCreemJson(config, `/v1/products?product_id=${encodeURIComponent(productId)}`, { method: 'GET' });
    const id = asString(payload.id);
    const mode = asString(payload.mode);
    const price = asNumber(payload.price);
    const currency = normalizeCurrency(payload.currency);
    const billingType = asString(payload.billing_type)?.toLowerCase();
    const status = asString(payload.status)?.toLowerCase() || 'active';
    if (!id || id !== productId || !mode || price === undefined || !currency || !billingType) {
        throw new AppError('Creem product response is incomplete', 502, ErrorCode.PAYMENT_FAILED);
    }
    const responseMode = normalizeCreemMode(mode);
    if (!responseMode || responseMode !== config.mode) {
        throw new AppError('Creem product belongs to a different environment', 409, ErrorCode.CONFLICT);
    }
    if (status !== 'active') {
        throw new AppError('Creem product is not active', 409, ErrorCode.CONFLICT);
    }
    return {
        id,
        mode,
        price,
        currency,
        billingType,
        kind: billingType === 'recurring' ? 'subscription' : 'one_time',
        status,
    };
};
export const createCreemCheckoutSession = async (input) => {
    const { payment, config } = input;
    const terms = resolveCreemCheckoutTerms(config, payment);
    const product = await fetchCreemProduct(config, terms.productId);
    if (product.price !== terms.checkoutAmount) {
        throw new AppError(`Creem product amount mismatch: expected ${terms.checkoutAmount}, got ${product.price}`, 409, ErrorCode.CONFLICT);
    }
    if (product.currency !== terms.checkoutCurrency) {
        throw new AppError(`Creem product currency mismatch: expected ${terms.checkoutCurrency}, got ${product.currency}`, 409, ErrorCode.CONFLICT);
    }
    if (!config.returnUrl.trim()) {
        throw new AppError('Creem return URL is not configured', 503, ErrorCode.SERVICE_UNAVAILABLE);
    }
    const metadata = {
        paymentId: payment.id,
        projectKey: config.projectKey,
        userId: String(payment.user_id),
        planId: payment.plan_id,
        expectedAmount: String(terms.checkoutAmount),
        expectedCurrency: terms.checkoutCurrency,
        walletCreditAmount: String(terms.walletCreditAmount),
        walletCreditCurrency: terms.walletCreditCurrency,
        productKind: product.kind,
        previousRole: input.userRole,
        previousPermissions: input.userPermissions || '[]',
    };
    await prisma.creemPaymentRecord.upsert({
        where: { payment_id: payment.id },
        create: {
            payment_id: payment.id,
            user_id: payment.user_id,
            project_key: config.projectKey,
            mode: config.mode,
            product_id: terms.productId,
            product_kind: product.kind,
            expected_amount: terms.checkoutAmount,
            expected_currency: terms.checkoutCurrency,
            customer_email: input.userEmail.trim().toLowerCase(),
            status: 'PENDING',
            access_status: 'PENDING',
            metadata: JSON.stringify(metadata),
        },
        update: {
            project_key: config.projectKey,
            mode: config.mode,
            product_id: terms.productId,
            product_kind: product.kind,
            expected_amount: terms.checkoutAmount,
            expected_currency: terms.checkoutCurrency,
            customer_email: input.userEmail.trim().toLowerCase(),
            status: 'PENDING',
            metadata: JSON.stringify(metadata),
        },
    });
    const successUrl = new URL(config.returnUrl);
    successUrl.searchParams.set('orderId', payment.id);
    const payload = await requestCreemJson(config, '/v1/checkouts', {
        method: 'POST',
        body: JSON.stringify({
            product_id: product.id,
            request_id: payment.id,
            units: 1,
            success_url: successUrl.toString(),
            customer: { email: input.userEmail.trim().toLowerCase() },
            metadata,
        }),
    });
    const checkoutId = asString(payload.id);
    const checkoutUrl = asString(payload.checkout_url);
    const responseMode = normalizeCreemMode(payload.mode) || config.mode;
    if (!checkoutId || !checkoutUrl) {
        throw new AppError('Creem checkout response is incomplete', 502, ErrorCode.PAYMENT_FAILED);
    }
    if (responseMode !== config.mode) {
        throw new AppError('Creem checkout belongs to a different environment', 409, ErrorCode.CONFLICT);
    }
    const checkoutProductId = asString(payload.product_id)
        || asString(asRecord(payload.product)?.id)
        || asString(payload.product);
    if (checkoutProductId && checkoutProductId !== product.id) {
        throw new AppError('Creem checkout product mismatch', 409, ErrorCode.CONFLICT);
    }
    await prisma.creemPaymentRecord.update({
        where: { payment_id: payment.id },
        data: {
            checkout_id: checkoutId,
            status: asString(payload.status)?.toUpperCase() || 'PENDING',
        },
    });
    return {
        paymentUrl: checkoutUrl,
        checkoutUrl,
        checkout_url: checkoutUrl,
        provider: 'creem',
        upstreamOrderId: checkoutId,
        productId: terms.productId,
        productKind: product.kind,
        mode: config.mode,
    };
};
export const verifyCreemWebhookSignature = (rawBody, signature, secret) => {
    if (!signature || !secret)
        return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = signature.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(received))
        return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
};
const parseWebhookEnvelope = (rawBody) => {
    let parsed;
    try {
        parsed = (() => { try {
            return JSON.parse(rawBody.toString('utf8'));
        }
        catch {
            return null;
        } })();
    }
    catch {
        throw new AppError('Invalid Creem webhook JSON', 400, ErrorCode.VALIDATION_ERROR);
    }
    const record = asRecord(parsed);
    const object = asRecord(record?.object);
    const id = asString(record?.id);
    const eventType = asString(record?.eventType ?? record?.event_type);
    if (!record || !object || !id || !eventType) {
        throw new AppError('Invalid Creem webhook envelope', 400, ErrorCode.VALIDATION_ERROR);
    }
    return { id, eventType, created_at: asString(record.created_at), object };
};
const nestedId = (value) => asString(value) || asString(asRecord(value)?.id);
const extractEventRefs = (envelope) => {
    const object = envelope.object;
    const metadata = asRecord(object.metadata) || {};
    const order = asRecord(object.order) || {};
    const product = asRecord(object.product) || asRecord(order.product) || {};
    const customer = asRecord(object.customer) || asRecord(order.customer) || {};
    const subscription = asRecord(object.subscription)
        || (envelope.eventType.startsWith('subscription.') ? object : {});
    const amount = asNumber(order.amount_paid
        ?? order.amount
        ?? product.price
        ?? object.refund_amount
        ?? object.amount);
    const currency = normalizeCurrency(order.currency
        ?? product.currency
        ?? object.refund_currency
        ?? object.currency);
    const metadataUserId = asNumber(metadata.userId ?? metadata.user_id);
    return {
        paymentId: asString(object.request_id)
            || asString(metadata.paymentId ?? metadata.payment_id),
        projectKey: asString(metadata.projectKey ?? metadata.project_key),
        userId: metadataUserId,
        productId: nestedId(object.product)
            || nestedId(order.product)
            || nestedId(subscription.product),
        subscriptionId: nestedId(object.subscription)
            || (envelope.eventType.startsWith('subscription.') ? asString(object.id) : undefined)
            || asString(object.subscription_id),
        transactionId: nestedId(object.transaction)
            || nestedId(order.transaction)
            || asString(subscription.last_transaction_id),
        orderId: nestedId(object.order) || (envelope.eventType === 'checkout.completed' ? asString(order.id) : undefined),
        checkoutId: envelope.eventType === 'checkout.completed' ? asString(object.id) : undefined,
        customerId: nestedId(object.customer) || nestedId(order.customer) || nestedId(subscription.customer),
        customerEmail: asString(customer.email)
            || asString(asRecord(subscription.customer)?.email),
        mode: asString(object.mode)
            || asString(order.mode)
            || asString(subscription.mode),
        amount,
        currency,
        status: asString(order.status)
            || asString(object.status)
            || asString(subscription.status),
    };
};
const findCreemPaymentRecord = async (refs) => {
    if (refs.paymentId) {
        const direct = await prisma.creemPaymentRecord.findUnique({ where: { payment_id: refs.paymentId } });
        if (direct)
            return direct;
    }
    if (refs.subscriptionId) {
        const subscription = await prisma.creemSubscription.findUnique({ where: { id: refs.subscriptionId } });
        if (subscription?.payment_id) {
            const bySubscription = await prisma.creemPaymentRecord.findUnique({ where: { payment_id: subscription.payment_id } });
            if (bySubscription)
                return bySubscription;
        }
    }
    const conditions = [];
    if (refs.checkoutId)
        conditions.push({ checkout_id: refs.checkoutId });
    if (refs.orderId)
        conditions.push({ order_id: refs.orderId });
    if (refs.transactionId)
        conditions.push({ transaction_id: refs.transactionId });
    if (refs.subscriptionId)
        conditions.push({ subscription_id: refs.subscriptionId });
    return conditions.length
        ? prisma.creemPaymentRecord.findFirst({ where: { OR: conditions } })
        : null;
};
const assertRecordConsistency = (record, refs, config, eventType) => {
    if (!record)
        throw new AppError('Creem payment record not found', 404, ErrorCode.NOT_FOUND);
    if (record.project_key !== config.projectKey) {
        throw new AppError('Creem project mismatch', 409, ErrorCode.CONFLICT);
    }
    const eventMode = normalizeCreemMode(refs.mode);
    if (eventMode && eventMode !== record.mode) {
        throw new AppError('Creem webhook environment mismatch', 409, ErrorCode.CONFLICT);
    }
    if (refs.paymentId && refs.paymentId !== record.payment_id) {
        throw new AppError('Creem request ID mismatch', 409, ErrorCode.CONFLICT);
    }
    if (refs.productId && refs.productId !== record.product_id) {
        throw new AppError('Creem product mismatch', 409, ErrorCode.CONFLICT);
    }
    if (refs.userId !== undefined && refs.userId !== record.user_id) {
        throw new AppError('Creem user mismatch', 409, ErrorCode.CONFLICT);
    }
    if (refs.customerEmail && record.customer_email
        && refs.customerEmail.toLowerCase() !== record.customer_email.toLowerCase()) {
        throw new AppError('Creem customer mismatch', 409, ErrorCode.CONFLICT);
    }
    if (PAID_EVENTS.has(eventType)) {
        if (refs.amount === undefined || refs.amount !== record.expected_amount) {
            throw new AppError('Creem payment amount mismatch', 409, ErrorCode.CONFLICT);
        }
        if (!refs.currency || refs.currency !== record.expected_currency) {
            throw new AppError('Creem payment currency mismatch', 409, ErrorCode.CONFLICT);
        }
        if (eventType === 'checkout.completed' && refs.status
            && !['paid', 'completed', 'succeeded'].includes(refs.status.toLowerCase())) {
            throw new AppError('Creem order is not paid', 409, ErrorCode.CONFLICT);
        }
    }
    if (eventType === 'refund.created' || eventType === 'dispute.created') {
        if (!refs.currency || refs.currency !== record.expected_currency) {
            throw new AppError('Creem adjustment currency mismatch', 409, ErrorCode.CONFLICT);
        }
        if (refs.amount === undefined || refs.amount <= 0 || refs.amount > record.expected_amount) {
            throw new AppError('Creem adjustment amount mismatch', 409, ErrorCode.CONFLICT);
        }
    }
};
const parseMetadata = (value) => {
    try {
        return asRecord((() => { try {
            return JSON.parse(value);
        }
        catch {
            return null;
        } })()) || {};
    }
    catch {
        return {};
    }
};
const roleForPlan = (planId) => {
    const normalized = planId.toLowerCase();
    if (normalized.includes('vip'))
        return 'VIP';
    if (normalized.includes('premium') || normalized.includes('pro'))
        return 'SPONSOR';
    return undefined;
};
const upsertSubscriptionSnapshot = async (subscriptionId, record, refs, envelope) => {
    const object = envelope.object;
    const metadata = parseMetadata(record.metadata);
    const periodStart = asDate(object.current_period_start_date ?? object.current_period_start);
    const periodEnd = asDate(object.current_period_end_date ?? object.current_period_end);
    const nextTransaction = asDate(object.next_transaction_date ?? object.next_transaction_at);
    const status = (refs.status || envelope.eventType.replace('subscription.', '')).toUpperCase();
    const grantedRole = roleForPlan(asString(metadata.planId) || '');
    return prisma.creemSubscription.upsert({
        where: { id: subscriptionId },
        create: {
            id: subscriptionId,
            payment_id: record.payment_id,
            user_id: record.user_id,
            project_key: record.project_key,
            product_id: record.product_id,
            plan_id: asString(metadata.planId) || 'unknown',
            customer_id: refs.customerId,
            customer_email: refs.customerEmail?.toLowerCase() || record.customer_email,
            status,
            access_active: false,
            previous_role: asString(metadata.previousRole),
            previous_permissions: asString(metadata.previousPermissions),
            granted_role: grantedRole,
            current_period_start_at: periodStart,
            current_period_end_at: periodEnd,
            next_transaction_at: nextTransaction,
            last_transaction_id: refs.transactionId,
            last_event_id: envelope.id,
            last_event_at: asDate(envelope.created_at),
            metadata: JSON.stringify({ source: 'creem', lastEventType: envelope.eventType }),
        },
        update: {
            payment_id: record.payment_id,
            customer_id: refs.customerId,
            customer_email: refs.customerEmail?.toLowerCase() || record.customer_email,
            status,
            current_period_start_at: periodStart,
            current_period_end_at: periodEnd,
            next_transaction_at: nextTransaction,
            last_transaction_id: refs.transactionId,
            last_event_id: envelope.id,
            last_event_at: asDate(envelope.created_at),
            metadata: JSON.stringify({ source: 'creem', lastEventType: envelope.eventType }),
        },
    });
};
const grantSubscriptionAccess = async (subscriptionId) => {
    const subscription = await prisma.creemSubscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription)
        return;
    const grantedRole = subscription.granted_role;
    if (grantedRole) {
        const user = await prisma.user.findUnique({
            where: { id: subscription.user_id },
            select: { role: true, permissions: true },
        });
        if (user && !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            const permissions = Array.isArray((() => { try {
                return (() => { try {
                    return JSON.parse(user.permissions || '[]');
                }
                catch {
                    return null;
                } })();
            }
            catch {
                return null;
            } })())
                ? safeJsonParse(user.permissions || '[]', {})
                : [];
            await prisma.user.update({
                where: { id: subscription.user_id },
                data: {
                    role: grantedRole,
                    permissions: JSON.stringify([...new Set([...permissions, ...ACCESS_PERMISSIONS])]),
                },
            });
            await invalidateUserCache(subscription.user_id);
        }
    }
    await prisma.creemSubscription.update({
        where: { id: subscriptionId },
        data: { access_active: true, cancel_at_period_end: false },
    });
};
const revokeSubscriptionAccess = async (subscriptionId, reason) => {
    const subscription = await prisma.creemSubscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription || !subscription.access_active)
        return;
    await prisma.creemSubscription.update({
        where: { id: subscriptionId },
        data: { access_active: false, status: reason.toUpperCase() },
    });
    const otherActive = await prisma.creemSubscription.count({
        where: {
            user_id: subscription.user_id,
            access_active: true,
            id: { not: subscriptionId },
        },
    });
    if (otherActive > 0 || !subscription.granted_role)
        return;
    const user = await prisma.user.findUnique({
        where: { id: subscription.user_id },
        select: { role: true },
    });
    if (!user || ['ADMIN', 'SUPER_ADMIN'].includes(user.role) || user.role !== subscription.granted_role)
        return;
    await prisma.user.update({
        where: { id: subscription.user_id },
        data: {
            role: subscription.previous_role || 'NORMAL',
            permissions: subscription.previous_permissions || '[]',
        },
    });
    await invalidateUserCache(subscription.user_id);
};
const reverseWalletCredit = async (record, amount, eventId, reason) => {
    const payment = await prisma.payment.findUnique({ where: { id: record.payment_id } });
    if (!payment || payment.plan_id !== 'custom')
        return;
    await redisService.withLock(`creem:adjustment:${record.payment_id}`, async () => {
        const fresh = await prisma.creemPaymentRecord.findUnique({ where: { payment_id: record.payment_id } });
        if (!fresh)
            return;
        const metadata = parseMetadata(fresh.metadata);
        const walletCreditAmount = Math.max(0, asNumber(metadata.walletCreditAmount) || fresh.expected_amount);
        const reversal = resolveCreemWalletReversal({
            refundAmount: amount,
            expectedCheckoutAmount: fresh.expected_amount,
            walletCreditAmount,
            reversedCheckoutAmount: Math.max(0, asNumber(metadata.reversedCheckoutAmount) || 0),
            reversedWalletCreditAmount: Math.max(0, asNumber(metadata.reversedWalletCreditAmount) || 0),
        });
        const delta = reversal.walletCreditAmount;
        if (delta <= 0)
            return;
        await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.upsert({
                where: { user_id: fresh.user_id },
                create: {
                    user_id: fresh.user_id,
                    balance: -delta,
                    currency: asString(metadata.walletCreditCurrency) || fresh.expected_currency,
                },
                update: { balance: { decrement: delta } },
            });
            const transaction = await tx.transaction.create({
                data: {
                    wallet_id: wallet.id,
                    amount: -delta,
                    type: reason,
                    status: 'COMPLETED',
                    description: `Creem ${reason.toLowerCase()} adjustment`,
                    metadata: JSON.stringify({ paymentId: fresh.payment_id, creemEventId: eventId }),
                },
            });
            const signature = generateTransactionSignature({
                id: transaction.id,
                walletId: transaction.wallet_id,
                amount: transaction.amount,
                type: transaction.type,
                status: transaction.status,
                createdAt: transaction.created_at,
            });
            await tx.transaction.update({ where: { id: transaction.id }, data: { signature } });
            await tx.creemPaymentRecord.update({
                where: { payment_id: fresh.payment_id },
                data: {
                    metadata: JSON.stringify({
                        ...metadata,
                        reversedCheckoutAmount: reversal.checkoutAmount,
                        reversedWalletCreditAmount: (asNumber(metadata.reversedWalletCreditAmount) || 0) + delta,
                        lastAdjustmentEventId: eventId,
                    }),
                },
            });
        });
    }, 30);
};
const revokeOneTimeAccess = async (record, reason) => {
    const payment = await prisma.payment.findUnique({ where: { id: record.payment_id } });
    if (!payment)
        return;
    if (payment.plan_id === 'marketplace') {
        await prisma.marketplaceOrder.updateMany({
            where: { payment_id: payment.id },
            data: {
                status: reason,
                payment_status: reason,
                fulfillment_status: 'REVOKED',
                delivery_url: null,
                dispute_status: reason === 'DISPUTED' ? 'OPEN' : 'RESOLVED',
                dispute_resolution: reason === 'REFUNDED' ? 'CREEM_REFUND' : 'CREEM_DISPUTE',
            },
        });
    }
    const metadata = parseMetadata(record.metadata);
    const grantedRole = roleForPlan(asString(metadata.planId) || payment.plan_id);
    if (!grantedRole)
        return;
    const activeSubscriptions = await prisma.creemSubscription.count({
        where: { user_id: record.user_id, access_active: true },
    });
    if (activeSubscriptions > 0)
        return;
    const user = await prisma.user.findUnique({ where: { id: record.user_id }, select: { role: true } });
    if (!user || ['ADMIN', 'SUPER_ADMIN'].includes(user.role) || user.role !== grantedRole)
        return;
    await prisma.user.update({
        where: { id: record.user_id },
        data: {
            role: asString(metadata.previousRole) || 'NORMAL',
            permissions: asString(metadata.previousPermissions) || '[]',
        },
    });
    await invalidateUserCache(record.user_id);
};
export const processCreemWebhook = async (input) => {
    const envelope = parseWebhookEnvelope(input.rawBody);
    const refs = extractEventRefs(envelope);
    let record = await findCreemPaymentRecord(refs);
    const projectKey = record?.project_key || refs.projectKey;
    if (!projectKey)
        throw new AppError('Creem project key is missing', 404, ErrorCode.NOT_FOUND);
    const config = await input.resolveConfig(projectKey);
    if (!verifyCreemWebhookSignature(input.rawBody, input.signature, config.webhookSecret)) {
        throw new AppError('Invalid Creem webhook signature', 401, ErrorCode.UNAUTHORIZED);
    }
    return redisService.withLock(`creem:webhook:${envelope.id}`, async () => {
        record = record || await findCreemPaymentRecord(refs);
        const payloadHash = crypto.createHash('sha256').update(input.rawBody).digest('hex');
        const existing = await prisma.creemWebhookEvent.findUnique({ where: { id: envelope.id } });
        if (existing?.payload_hash && existing.payload_hash !== payloadHash) {
            throw new AppError('Creem event payload changed', 409, ErrorCode.CONFLICT);
        }
        if (existing?.status === 'PROCESSED') {
            return {
                duplicate: true,
                eventId: envelope.id,
                eventType: envelope.eventType,
                paymentId: existing.payment_id || record?.payment_id,
                status: 'PROCESSED',
            };
        }
        await prisma.creemWebhookEvent.upsert({
            where: { id: envelope.id },
            create: {
                id: envelope.id,
                event_type: envelope.eventType,
                object_id: asString(envelope.object.id),
                payment_id: record?.payment_id || refs.paymentId,
                mode: normalizeCreemMode(refs.mode),
                payload_hash: payloadHash,
                status: 'PROCESSING',
                event_at: asDate(envelope.created_at),
            },
            update: {
                payment_id: record?.payment_id || refs.paymentId,
                status: 'PROCESSING',
                error: null,
            },
        });
        try {
            if (!record) {
                if (envelope.eventType === 'refund.created' || envelope.eventType === 'dispute.created') {
                    throw new AppError('Creem adjustment cannot be linked to an internal payment', 404, ErrorCode.NOT_FOUND);
                }
                await prisma.creemWebhookEvent.update({
                    where: { id: envelope.id },
                    data: { status: 'IGNORED', processed_at: new Date() },
                });
                return { duplicate: false, eventId: envelope.id, eventType: envelope.eventType, status: 'IGNORED' };
            }
            assertRecordConsistency(record, refs, config, envelope.eventType);
            const payment = await prisma.payment.findUnique({ where: { id: record.payment_id } });
            if (!payment || payment.user_id !== record.user_id) {
                throw new AppError('Creem internal payment mismatch', 409, ErrorCode.CONFLICT);
            }
            const externalIds = {
                checkout_id: refs.checkoutId || record.checkout_id,
                order_id: refs.orderId || record.order_id,
                transaction_id: refs.transactionId || record.transaction_id,
                customer_id: refs.customerId || record.customer_id,
                customer_email: refs.customerEmail?.toLowerCase() || record.customer_email,
                subscription_id: refs.subscriptionId || record.subscription_id,
            };
            if (PAID_EVENTS.has(envelope.eventType)) {
                await input.completePayment(record.payment_id, payment.amount, config, {
                    provider: 'creem',
                    creemEventId: envelope.id,
                    creemEventType: envelope.eventType,
                    creemTransactionId: refs.transactionId,
                    creemSubscriptionId: refs.subscriptionId,
                });
                await prisma.creemPaymentRecord.update({
                    where: { payment_id: record.payment_id },
                    data: { ...externalIds, status: 'COMPLETED', access_status: 'ACTIVE' },
                });
            }
            else {
                await prisma.creemPaymentRecord.update({
                    where: { payment_id: record.payment_id },
                    data: externalIds,
                });
            }
            if (refs.subscriptionId && envelope.eventType.startsWith('subscription.')) {
                const subscription = await upsertSubscriptionSnapshot(refs.subscriptionId, record, refs, envelope);
                if (ACTIVE_EVENTS.has(envelope.eventType)) {
                    await grantSubscriptionAccess(subscription.id);
                }
                else if (RETAIN_UNTIL_PERIOD_END_EVENTS.has(envelope.eventType)) {
                    const periodEnded = subscription.current_period_end_at
                        ? subscription.current_period_end_at.getTime() <= Date.now()
                        : envelope.eventType === 'subscription.expired';
                    await prisma.creemSubscription.update({
                        where: { id: subscription.id },
                        data: {
                            cancel_at_period_end: true,
                            canceled_at: envelope.eventType.includes('cancel') ? new Date() : subscription.canceled_at,
                        },
                    });
                    if (periodEnded)
                        await revokeSubscriptionAccess(subscription.id, envelope.eventType);
                }
                else if (REVOKE_EVENTS.has(envelope.eventType)) {
                    await revokeSubscriptionAccess(subscription.id, envelope.eventType);
                }
            }
            if (envelope.eventType === 'checkout.completed' && refs.subscriptionId) {
                const subscription = await upsertSubscriptionSnapshot(refs.subscriptionId, record, refs, envelope);
                await grantSubscriptionAccess(subscription.id);
            }
            if (envelope.eventType === 'refund.created') {
                const fullRefund = refs.amount === record.expected_amount;
                await prisma.payment.update({
                    where: { id: record.payment_id },
                    data: { status: fullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
                });
                await prisma.creemPaymentRecord.update({
                    where: { payment_id: record.payment_id },
                    data: {
                        status: fullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                        access_status: fullRefund ? 'REVOKED' : record.access_status,
                    },
                });
                await reverseWalletCredit(record, refs.amount, envelope.id, 'REFUND');
                if (fullRefund) {
                    if (record.subscription_id)
                        await revokeSubscriptionAccess(record.subscription_id, 'REFUNDED');
                    await revokeOneTimeAccess(record, 'REFUNDED');
                }
            }
            if (envelope.eventType === 'dispute.created') {
                await prisma.payment.update({ where: { id: record.payment_id }, data: { status: 'DISPUTED' } });
                await prisma.creemPaymentRecord.update({
                    where: { payment_id: record.payment_id },
                    data: { status: 'DISPUTED', access_status: 'REVOKED' },
                });
                await reverseWalletCredit(record, refs.amount, envelope.id, 'CHARGEBACK');
                if (record.subscription_id)
                    await revokeSubscriptionAccess(record.subscription_id, 'DISPUTED');
                await revokeOneTimeAccess(record, 'DISPUTED');
            }
            await prisma.creemWebhookEvent.update({
                where: { id: envelope.id },
                data: { status: 'PROCESSED', processed_at: new Date(), error: null },
            });
            return {
                duplicate: false,
                eventId: envelope.id,
                eventType: envelope.eventType,
                paymentId: record.payment_id,
                status: 'PROCESSED',
            };
        }
        catch (error) {
            await prisma.creemWebhookEvent.update({
                where: { id: envelope.id },
                data: {
                    status: 'FAILED',
                    error: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
                },
            }).catch(() => undefined);
            throw error;
        }
    }, 60);
};
export const cancelCreemSubscription = async (input) => {
    const subscription = await prisma.creemSubscription.findUnique({ where: { id: input.subscriptionId } });
    if (!subscription)
        throw new AppError('Creem subscription not found', 404, ErrorCode.NOT_FOUND);
    if (subscription.user_id !== input.userId || subscription.project_key !== input.config.projectKey) {
        throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }
    const payload = await requestCreemJson(input.config, `/v1/subscriptions/${encodeURIComponent(input.subscriptionId)}/cancel`, { method: 'POST', body: JSON.stringify({}) });
    const status = asString(payload.status)?.toUpperCase() || 'SCHEDULED_CANCEL';
    const periodEnd = asDate(payload.current_period_end_date ?? payload.current_period_end);
    await prisma.creemSubscription.update({
        where: { id: subscription.id },
        data: {
            status,
            cancel_at_period_end: true,
            canceled_at: new Date(),
            current_period_end_at: periodEnd || subscription.current_period_end_at,
            metadata: JSON.stringify({ source: 'api-cancel', responseStatus: status }),
        },
    });
    return {
        id: subscription.id,
        status,
        cancelAtPeriodEnd: true,
        currentPeriodEndAt: (periodEnd || subscription.current_period_end_at)?.toISOString() || null,
    };
};
export const reconcileExpiredCreemSubscriptions = async () => {
    const expired = await prisma.creemSubscription.findMany({
        where: {
            access_active: true,
            current_period_end_at: { lte: new Date() },
            OR: [
                { cancel_at_period_end: true },
                { status: { in: ['EXPIRED', 'PAUSED', 'CANCELED', 'CANCELLED', 'PAST_DUE'] } },
            ],
        },
        select: { id: true },
    });
    for (const item of expired) {
        await revokeSubscriptionAccess(item.id, 'PERIOD_ENDED');
    }
    if (expired.length)
        logger.info(`[Creem] Revoked ${expired.length} expired subscription(s)`);
    return expired.length;
};
//# sourceMappingURL=creemPaymentService.js.map