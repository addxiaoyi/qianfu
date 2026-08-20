import crypto from 'node:crypto';
import prisma from '../db';
import { AppError, ErrorCode } from '../utils/errors';
function conflict(message) {
    throw new AppError(message, 409, ErrorCode.CONFLICT);
}
function notFound(message) {
    throw new AppError(message, 404, ErrorCode.NOT_FOUND);
}
function forbidden(message) {
    throw new AppError(message, 403, ErrorCode.FORBIDDEN);
}
function isUniqueConstraintError(error) {
    return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}
export async function submitMarketplaceAppeal(appellantId, input, client = prisma) {
    let targetId;
    if (input.targetType === 'SELLER') {
        targetId = String(appellantId);
        const seller = await client.user.findUnique({
            where: { id: appellantId },
            select: { id: true, marketplace_seller_status: true },
        });
        if (!seller)
            notFound('Seller not found');
        if (seller.marketplace_seller_status !== 'SUSPENDED') {
            conflict('Only suspended sellers can submit a seller appeal');
        }
    }
    else {
        targetId = String(input.targetId || '').trim();
        if (!targetId)
            throw new AppError('Product ID is required', 400, ErrorCode.VALIDATION_ERROR);
        const product = await client.marketplaceProduct.findUnique({
            where: { id: targetId },
            select: { id: true, creator_id: true, listing_status: true },
        });
        if (!product)
            notFound('Product not found');
        if (product.creator_id !== appellantId)
            forbidden('Only the product owner can submit this appeal');
        if (!['REJECTED', 'SUSPENDED'].includes(product.listing_status)) {
            conflict('Only rejected or suspended products can be appealed');
        }
    }
    const pending = await client.marketplaceAppeal.findFirst({
        where: { appellant_id: appellantId, target_type: input.targetType, target_id: targetId, status: 'PENDING' },
        select: { id: true },
    });
    if (pending)
        conflict('A pending appeal already exists for this target');
    try {
        return await client.marketplaceAppeal.create({
            data: {
                id: `map_${crypto.randomUUID()}`,
                appellant_id: appellantId,
                target_type: input.targetType,
                target_id: targetId,
                reason: input.reason.trim(),
                evidence: input.evidence?.trim() || null,
                status: 'PENDING',
            },
        });
    }
    catch (error) {
        if (isUniqueConstraintError(error))
            conflict('A pending appeal already exists for this target');
        throw error;
    }
}
export async function listMarketplaceAppealsForUser(appellantId, client = prisma) {
    return client.marketplaceAppeal.findMany({
        where: { appellant_id: appellantId },
        orderBy: { submitted_at: 'desc' },
    });
}
export async function listMarketplaceAppeals(status, client = prisma) {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized && !['PENDING', 'APPROVED', 'REJECTED'].includes(normalized)) {
        throw new AppError('Invalid appeal status', 400, ErrorCode.VALIDATION_ERROR);
    }
    return client.marketplaceAppeal.findMany({
        where: normalized ? { status: normalized } : undefined,
        orderBy: { submitted_at: 'desc' },
    });
}
export async function reviewMarketplaceAppeal(appealId, reviewerId, input, client = prisma) {
    const current = await client.marketplaceAppeal.findUnique({ where: { id: appealId } });
    if (!current)
        notFound('Appeal not found');
    if (current.status !== 'PENDING')
        conflict('Appeal has already been reviewed');
    const reviewedAt = new Date();
    return client.$transaction(async (tx) => {
        if (input.decision === 'APPROVED') {
            if (current.target_type === 'SELLER') {
                const sellerId = Number(current.target_id);
                if (!Number.isSafeInteger(sellerId) || sellerId <= 0)
                    conflict('Appeal target is invalid');
                const result = await tx.user.updateMany({
                    where: { id: sellerId, marketplace_seller_status: 'SUSPENDED' },
                    data: { marketplace_seller_status: 'ACTIVE', marketplace_seller_notes: input.note },
                });
                if (result.count !== 1)
                    conflict('Seller is no longer suspended');
            }
            else if (current.target_type === 'PRODUCT') {
                const result = await tx.marketplaceProduct.updateMany({
                    where: { id: current.target_id, creator_id: current.appellant_id, listing_status: { in: ['REJECTED', 'SUSPENDED'] } },
                    data: { listing_status: 'PENDING_REVIEW', is_published: false, moderation_notes: input.note, updated_at: reviewedAt },
                });
                if (result.count !== 1)
                    conflict('Product is no longer eligible for appeal');
            }
            else {
                conflict('Appeal target type is invalid');
            }
        }
        const appeal = await tx.marketplaceAppeal.update({
            where: { id: current.id },
            data: {
                status: input.decision,
                decision_note: input.note,
                reviewer_id: reviewerId,
                reviewed_at: reviewedAt,
            },
        });
        await tx.notification.create({
            data: {
                user_id: current.appellant_id,
                title: 'Marketplace appeal reviewed',
                content: `Your ${current.target_type.toLowerCase()} appeal was ${input.decision.toLowerCase()}.`,
                type: input.decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
            },
        });
        return appeal;
    });
}
//# sourceMappingURL=marketplaceAppealService.js.map