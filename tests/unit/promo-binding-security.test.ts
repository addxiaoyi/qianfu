import { describe, expect, it, vi } from 'vitest';

import { bindPromoPlatformAccount } from '../../server/services/promoBindingService';

const input = {
  platform: 'bilibili' as const,
  platformUserId: '2293237813',
  platformUsername: 'creator_42',
};

describe('promotion platform binding ownership', () => {
  it('does not transfer an external identity to another user', async () => {
    const existing = { id: 7, user_id: 11 };
    const db = {
      promoPlatformBinding: {
        findUnique: vi.fn().mockResolvedValue(existing),
        upsert: vi.fn(),
      },
    };

    await expect(bindPromoPlatformAccount(db, 22, input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.promoPlatformBinding.upsert).not.toHaveBeenCalled();
    expect(existing.user_id).toBe(11);
  });

  it('updates only the caller binding for the platform', async () => {
    const saved = {
      id: 8,
      user_id: 22,
      platform: 'bilibili',
      platform_user_id: '2293237813',
      binding_status: 'PENDING',
    };
    const db = {
      promoPlatformBinding: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(saved),
      },
    };

    await expect(bindPromoPlatformAccount(db, 22, input)).resolves.toEqual(saved);
    expect(db.promoPlatformBinding.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        user_id_platform: {
          user_id: 22,
          platform: 'bilibili',
        },
      },
      update: expect.objectContaining({
        binding_status: 'PENDING',
        bind_source: 'MANUAL',
        verified_at: null,
      }),
      create: expect.objectContaining({
        binding_status: 'PENDING',
        bind_source: 'MANUAL',
      }),
    }));
  });
});
