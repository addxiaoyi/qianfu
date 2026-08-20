import crypto from 'crypto';
import { buildMarketplaceEvidenceId, buildMarketplaceListingSnapshot, buildMarketplacePolicySnapshot, buildMarketplaceVersionId, hmacEvidenceValue, stableJsonStringify, } from './marketplaceEvidenceService';
import { AppError, ErrorCode } from '../utils/errors';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const MAX_QUANTITY = 100;
const buildOrderId = (buyerId, idempotencyKey) => {
    const digest = crypto
        .createHash('sha256')
        .update(`${buyerId}\u0000${idempotencyKey}`)
        .digest('hex');
    return `ord_${digest}`;
};
const isUniqueConflict = (error) => (typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'P2002');
const validateInput = (input) => {
    if (!Number.isInteger(input.buyerId) || input.buyerId <= 0) {
        throw new AppError('Invalid buyer', 400, ErrorCode.VALIDATION_ERROR);
    }
    if (!input.productId.trim()) {
        throw new AppError('Product ID is required', 400, ErrorCode.VALIDATION_ERROR);
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_QUANTITY) {
        throw new AppError('Invalid order quantity', 400, ErrorCode.VALIDATION_ERROR);
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
        throw new AppError('Invalid idempotency key', 400, ErrorCode.VALIDATION_ERROR);
    }
    if (input.policyAcceptance?.accepted !== true) {
        throw new AppError('Marketplace policies must be accepted', 400, ErrorCode.VALIDATION_ERROR);
    }
};
const resolveProductVersion = async (tx, product) => {
    const listingSnapshot = stableJsonStringify(buildMarketplaceListingSnapshot(product));
    const current = await tx.marketplaceProductVersion.findFirst({
        where: { product_id: product.id },
        orderBy: { created_at: 'desc' },
    });
    if (current
        && current.version === product.product_version
        && current.file_sha256 === product.file_sha256
        && current.asset_size === product.asset_size
        && current.asset_mime === product.asset_mime
        && current.download_url === product.download_url
        && current.listing_snapshot === listingSnapshot) {
        return current;
    }
    return tx.marketplaceProductVersion.create({
        data: {
            id: buildMarketplaceVersionId(product.id),
            product_id: product.id,
            version: product.product_version,
            file_sha256: product.file_sha256,
            asset_size: product.asset_size,
            asset_mime: product.asset_mime,
            download_url: product.download_url,
            listing_snapshot: listingSnapshot,
            created_by: product.creator_id,
        },
    });
};
const findExistingOrder = async (tx, input, orderId) => {
    const order = await tx.marketplaceOrder.findUnique({ where: { id: orderId } });
    if (!order)
        return null;
    if (order.buyer_id !== input.buyerId
        || order.product_id !== input.productId
        || order.quantity !== input.quantity) {
        throw new AppError('Idempotency key was already used for another order', 409, ErrorCode.CONFLICT);
    }
    if (!order.payment_id) {
        throw new AppError('Marketplace order has no payment record', 409, ErrorCode.CONFLICT);
    }
    const [payment, product] = await Promise.all([
        tx.payment.findUnique({ where: { id: order.payment_id } }),
        tx.marketplaceProduct.findUnique({
            where: { id: order.product_id },
            include: { creator: { select: { marketplace_seller_status: true } } },
        }),
    ]);
    if (!payment || payment.user_id !== input.buyerId || payment.plan_id !== 'marketplace') {
        throw new AppError('Marketplace payment not found', 409, ErrorCode.CONFLICT);
    }
    if (!product) {
        throw new AppError('Product not found', 404, ErrorCode.NOT_FOUND);
    }
    if (!product.is_published || product.listing_status !== 'APPROVED') {
        throw new AppError('Product is unavailable', 409, ErrorCode.CONFLICT);
    }
    if (!product.creator || product.creator.marketplace_seller_status !== 'ACTIVE') {
        throw new AppError('Seller is unavailable', 409, ErrorCode.CONFLICT);
    }
    return { order, payment, product, replayed: true };
};
export const createMarketplaceOrder = async (db, input) => {
    validateInput(input);
    const orderId = buildOrderId(input.buyerId, input.idempotencyKey);
    const paymentId = `pay_${orderId.slice(4)}`;
    const create = () => db.$transaction(async (tx) => {
        const existing = await findExistingOrder(tx, input, orderId);
        if (existing)
            return existing;
        const product = await tx.marketplaceProduct.findUnique({
            where: { id: input.productId },
            include: { creator: { select: { marketplace_seller_status: true } } },
        });
        if (!product) {
            throw new AppError('Product not found', 404, ErrorCode.NOT_FOUND);
        }
        if (!product.is_published || product.listing_status !== 'APPROVED') {
            throw new AppError('Product is unavailable', 409, ErrorCode.CONFLICT);
        }
        if (!product.creator || product.creator.marketplace_seller_status !== 'ACTIVE') {
            throw new AppError('Seller is unavailable', 409, ErrorCode.CONFLICT);
        }
        if (product.creator_id === input.buyerId) {
            throw new AppError('Cannot purchase your own product', 409, ErrorCode.CONFLICT);
        }
        if (!Number.isSafeInteger(product.price) || product.price <= 0) {
            throw new AppError('Product price is invalid', 409, ErrorCode.CONFLICT);
        }
        if (!Number.isSafeInteger(product.additional_fees) || product.additional_fees < 0) {
            throw new AppError('Product additional fees are invalid', 409, ErrorCode.CONFLICT);
        }
        const unitTotal = product.price + product.additional_fees;
        const totalPrice = unitTotal * input.quantity;
        if (!Number.isSafeInteger(totalPrice) || totalPrice <= 0) {
            throw new AppError('Order total is invalid', 409, ErrorCode.CONFLICT);
        }
        const productVersion = await resolveProductVersion(tx, product);
        const payment = await tx.payment.create({
            data: {
                id: paymentId,
                user_id: input.buyerId,
                amount: totalPrice,
                currency: product.currency,
                status: 'PENDING',
                plan_id: 'marketplace',
                payment_method: 'MARKETPLACE',
            },
        });
        const order = await tx.marketplaceOrder.create({
            data: {
                id: orderId,
                product_id: product.id,
                buyer_id: input.buyerId,
                buyer_name: input.buyerName,
                quantity: input.quantity,
                total_price: totalPrice,
                status: 'PENDING',
                payment_status: 'PENDING',
                fulfillment_status: 'PENDING',
                payment_id: payment.id,
            },
        });
        const acceptedAt = new Date();
        await tx.marketplaceOrderEvidence.create({
            data: {
                id: buildMarketplaceEvidenceId('mpe', order.id),
                order_id: order.id,
                product_version_id: productVersion.id,
                listing_snapshot: stableJsonStringify({
                    listing: buildMarketplaceListingSnapshot(product),
                    quantity: input.quantity,
                    unitPrice: product.price,
                    additionalFeesPerUnit: product.additional_fees,
                    unitTotal,
                    orderTotal: totalPrice,
                }),
                policy_snapshot: stableJsonStringify(buildMarketplacePolicySnapshot()),
                accepted_at: acceptedAt,
                buyer_ip_hmac: hmacEvidenceValue('marketplace-order-buyer-ip', input.buyerIp),
                user_agent_hmac: hmacEvidenceValue('marketplace-order-user-agent', input.userAgent),
            },
        });
        return { order, payment, product, replayed: false };
    }, { isolationLevel: 'Serializable' });
    try {
        return await create();
    }
    catch (error) {
        if (!isUniqueConflict(error))
            throw error;
        return db.$transaction(async (tx) => {
            const existing = await findExistingOrder(tx, input, orderId);
            if (existing)
                return existing;
            throw error;
        }, { isolationLevel: 'Serializable' });
    }
};
//# sourceMappingURL=marketplaceOrderService.js.map