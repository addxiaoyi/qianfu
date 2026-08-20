import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = readFileSync(resolve(process.cwd(), 'server/controllers/promoController.ts'), 'utf8');
const claimService = readFileSync(resolve(process.cwd(), 'server/services/promoClaimService.ts'), 'utf8');
const schemas = [
  'prisma/schema.prisma',
  'prisma/schema.mysql.prisma',
  'prisma/schema.postgresql.prisma',
].map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'));

describe('promotion reward idempotency policy', () => {
  it.each(schemas)('supports sequenced idempotent claims', (schema) => {
    expect(schema).toContain('claim_no')
    expect(schema).toContain('idempotency_key')
    expect(schema).toContain('@@unique([user_id, task_id, claim_no])')
    expect(schema).toContain('@@unique([user_id, task_id, idempotency_key])')
    expect(schema).not.toContain('@@unique([user_id, task_id])')
  })

  it('claims the rewarding state before changing wallet balance', () => {
    const guard = controller.indexOf('const rewardGuard = await tx.promoClaimRecord.updateMany');
    const walletIncrement = controller.indexOf('balance: { increment: claim.task.reward_amount }', guard);

    expect(guard).toBeGreaterThan(-1);
    expect(controller).toContain("reward_status: { notIn: ['REWARDING', 'REWARDED'] }");
    expect(controller).toContain('if (rewardGuard.count === 0)');
    expect(walletIncrement).toBeGreaterThan(guard);
  });

  it.each(schemas)('makes each promotion reward reference unique', (schema) => {
    expect(schema).toContain('@@unique([ref_type, ref_id])');
  });

  it('enforces per-user, daily, and total claim limits before creating a claim', () => {
    const claimHandler = claimService.indexOf('const createInTransaction');
    const claimCreate = claimService.indexOf('tx.promoClaimRecord.create', claimHandler);
    const userCount = claimService.indexOf('const [perUser, daily, total]', claimHandler);
    const perUserQuery = claimService.indexOf('user_id: input.userId', userCount);
    const dailyQuery = claimService.indexOf('claim_at: { gte: dayStart }', perUserQuery);
    const totalQuery = claimService.indexOf("count({ where: { task_id: task.id } })", dailyQuery);
    const limitCheck = claimService.indexOf('assertCapacity', totalQuery);

    expect(userCount).toBeGreaterThan(claimHandler);
    expect(perUserQuery).toBeGreaterThan(userCount);
    expect(dailyQuery).toBeGreaterThan(perUserQuery);
    expect(totalQuery).toBeGreaterThan(dailyQuery);
    expect(limitCheck).toBeGreaterThan(totalQuery);
    expect(limitCheck).toBeLessThan(claimCreate);
    expect(claimService).toContain("isolationLevel: 'Serializable'");
  });

  it('requires a rejection note and never overwrites a rewarded claim', () => {
    expect(controller).toContain("const rejectionNote = String(req.body?.remark ?? '').trim()")
    expect(controller).toContain("claim_status: { not: 'REWARDED' }")
    expect(controller).toContain("reward_status: 'REJECTED'")
  })

  it('does not report a rejected claim as approved', () => {
    const approve = controller.slice(
      controller.indexOf('export const approvePromoClaim'),
      controller.indexOf('export const rejectPromoClaim'),
    );

    expect(approve).toContain("claim_status: { in: ['PENDING', 'VERIFIED'] }");
    expect(approve).toContain("throw new AppError('Claim is not approvable', 409");
  });
});
