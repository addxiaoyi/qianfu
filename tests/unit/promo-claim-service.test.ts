import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { createPendingPromoClaim } from '../../server/services/promoClaimService';

const task = {
  id: 5,
  platform: 'bilibili',
  status: 'ENABLED',
  start_at: null,
  end_at: null,
  claim_limit_per_user: 2,
  daily_limit: 10,
  total_limit: 100,
};

describe('promotion claim transaction', () => {
  it('creates sequenced claims and replays one idempotency key', async () => {
    const claims: Array<Record<string, any>> = [];
    const claimDelegate = {
      findUnique: vi.fn(async ({ where }: any) => claims.find((claim) => (
        claim.user_id === where.user_id_task_id_idempotency_key.user_id
        && claim.task_id === where.user_id_task_id_idempotency_key.task_id
        && claim.idempotency_key === where.user_id_task_id_idempotency_key.idempotency_key
      )) ?? null),
      count: vi.fn(async ({ where }: any) => claims.filter((claim) => (
        (!where.user_id || claim.user_id === where.user_id)
        && claim.task_id === where.task_id
      )).length),
      create: vi.fn(async ({ data }: any) => {
        const claim = { id: claims.length + 1, ...data };
        claims.push(claim);
        return claim;
      }),
    };
    const tx = {
      promoTask: { findUnique: vi.fn().mockResolvedValue(task) },
      promoPlatformBinding: {
        findFirst: vi.fn().mockResolvedValue({ platform_user_id: 'external-42' }),
      },
      promoClaimRecord: claimDelegate,
      promoVerifyLog: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    };
    const db = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    const first = await createPendingPromoClaim(db, {
      userId: 22,
      taskId: 5,
      idempotencyKey: 'claim-key-00000001',
      proof: { url: 'https://example.com/proof/1' },
    });
    const second = await createPendingPromoClaim(db, {
      userId: 22,
      taskId: 5,
      idempotencyKey: 'claim-key-00000002',
      proof: { url: 'https://example.com/proof/2' },
    });
    const replay = await createPendingPromoClaim(db, {
      userId: 22,
      taskId: 5,
      idempotencyKey: 'claim-key-00000002',
      proof: { url: 'https://example.com/proof/2' },
    });

    expect(first).toMatchObject({ created: true, claim: { claim_no: 1 } });
    expect(second).toMatchObject({ created: true, claim: { claim_no: 2 } });
    expect(replay).toMatchObject({ created: false, claim: { id: 2, claim_no: 2 } });
    expect(claims).toHaveLength(2);
    expect(claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ claim_status: 'PENDING', reward_status: 'PENDING' }),
    ]));
  });
});
