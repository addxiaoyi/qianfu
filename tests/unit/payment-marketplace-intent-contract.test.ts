import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'server/controllers/paymentController.ts'),
  'utf8',
);

const createStart = source.indexOf('export const createPayment = async');
const createEnd = source.indexOf('export const xpayNotify', createStart);
const createPaymentSource = source.slice(createStart, createEnd);

describe('marketplace payment intent contract', () => {
  it('derives marketplace amount and payment identity from the stored order', () => {
    expect(createPaymentSource).toContain('marketplaceOrderId');
    expect(createPaymentSource).toContain("if (normalizedPlanId === 'marketplace')");
    expect(createPaymentSource).toContain('where: { id: marketplaceOrderId }');
    expect(createPaymentSource).toContain('marketplaceOrder.buyer_id !== userId');
    expect(createPaymentSource).toContain('amountFen = marketplaceOrder.total_price');
    expect(createPaymentSource).toContain('payment = await prisma.payment.findUnique');
  });

  it('does not create a second payment record for an existing marketplace order', () => {
    const paymentDeclaration = createPaymentSource.indexOf('let payment:');
    const marketplacePaymentBranch = createPaymentSource.indexOf(
      "if (normalizedPlanId === 'marketplace')",
      paymentDeclaration,
    );
    const marketplacePaymentBranchEnd = createPaymentSource.indexOf('} else {', marketplacePaymentBranch);
    const ordinaryPaymentCreate = createPaymentSource.indexOf('payment = await prisma.payment.create({');

    expect(marketplacePaymentBranch).toBeGreaterThan(paymentDeclaration);
    expect(marketplacePaymentBranchEnd).toBeGreaterThan(marketplacePaymentBranch);
    expect(ordinaryPaymentCreate).toBeGreaterThan(marketplacePaymentBranchEnd);
    expect(
      createPaymentSource.slice(marketplacePaymentBranch, marketplacePaymentBranchEnd),
    ).not.toContain('payment = await prisma.payment.create({');
  });

  it('does not apply the custom recharge minimum to marketplace orders', () => {
    expect(createPaymentSource).toContain(
      "} else if (normalizedPlanId === 'custom' && amount < 0.1)",
    );
  });

  it('completes balance payments with marketplace side effects in the same transaction', () => {
    const balancePaymentStart = createPaymentSource.indexOf("if (paymentMethod === 'balance')");
    const balancePaymentEnd = createPaymentSource.indexOf('const xpayType', balancePaymentStart);
    const balancePaymentSource = createPaymentSource.slice(balancePaymentStart, balancePaymentEnd);

    expect(balancePaymentStart).toBeGreaterThanOrEqual(0);
    expect(balancePaymentEnd).toBeGreaterThan(balancePaymentStart);
    expect(balancePaymentSource).toContain('completePaymentWithSideEffectsInTransaction(tx, {');
    expect(balancePaymentSource).toContain('expectedAmountFen: amountFen');
  });
});
