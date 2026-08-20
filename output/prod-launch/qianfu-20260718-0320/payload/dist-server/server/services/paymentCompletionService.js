import { generateTransactionSignature } from '../lib/wallet.js';
const syncMarketplaceOrders = async (tx, paymentId) => {
    const orders = await tx.marketplaceOrder.findMany({
        where: { payment_id: paymentId },
    });
    for (const order of orders) {
        const product = await tx.marketplaceProduct.findUnique({ where: { id: order.product_id } });
        if (!product)
            continue;
        const deliveryUrl = product.download_url;
        const fulfillmentStatus = deliveryUrl ? 'DELIVERED' : 'READY';
        const wasPaid = order.payment_status === 'PAID';
        const needsOrderSync = !wasPaid
            || order.fulfillment_status !== fulfillmentStatus
            || order.delivery_url !== deliveryUrl;
        if (!needsOrderSync)
            continue;
        await tx.marketplaceOrder.update({
            where: { id: order.id },
            data: {
                status: 'PAID',
                payment_status: 'PAID',
                fulfillment_status: fulfillmentStatus,
                delivery_url: deliveryUrl,
                updated_at: new Date(),
            },
        });
        if (!wasPaid) {
            await tx.marketplaceProduct.update({
                where: { id: product.id },
                data: { sales: { increment: order.quantity }, updated_at: new Date() },
            });
        }
        await tx.marketplaceFulfillmentLog.create({
            data: {
                id: `flg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                order_id: order.id,
                status: fulfillmentStatus,
                note: wasPaid ? 'Payment completion reconciliation' : 'Payment completed',
                created_at: new Date(),
            },
        });
    }
};
export const completePaymentWithSideEffectsInTransaction = async (tx, input) => {
    const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment)
        return { status: 'NOT_FOUND' };
    if (typeof input.expectedAmountFen === 'number' && input.expectedAmountFen !== payment.amount) {
        return { status: 'AMOUNT_MISMATCH' };
    }
    const wasCompleted = payment.status === 'COMPLETED';
    const paymentRecord = wasCompleted
        ? payment
        : await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'COMPLETED', updated_at: new Date() },
        });
    if (!wasCompleted && paymentRecord.plan_id === 'custom') {
        const wallet = await tx.wallet.findUnique({ where: { user_id: paymentRecord.user_id } });
        if (wallet) {
            const transaction = await tx.transaction.create({
                data: {
                    wallet_id: wallet.id,
                    amount: paymentRecord.amount,
                    type: 'DEPOSIT',
                    status: 'COMPLETED',
                    description: `Recharge: ${paymentRecord.plan_id}`,
                    metadata: JSON.stringify({ paymentId: paymentRecord.id, ...(input.metadata || {}) }),
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
            await tx.wallet.update({
                where: { user_id: paymentRecord.user_id },
                data: { balance: { increment: paymentRecord.amount } },
            });
            await tx.transaction.update({ where: { id: transaction.id }, data: { signature } });
        }
    }
    await syncMarketplaceOrders(tx, paymentRecord.id);
    return { status: wasCompleted ? 'ALREADY_COMPLETED' : 'COMPLETED', paymentRecord };
};
export const completePaymentWithSideEffects = async (db, input) => {
    return db.$transaction((tx) => completePaymentWithSideEffectsInTransaction(tx, input), { isolationLevel: 'Serializable' });
};
//# sourceMappingURL=paymentCompletionService.js.map