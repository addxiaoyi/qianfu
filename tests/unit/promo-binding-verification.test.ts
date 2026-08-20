import { describe, expect, it, vi } from 'vitest';

import {
  buildPromoBindingChallenge,
  validatePromoProofUrl,
  verifyPromoPlatformBinding,
} from '../../server/services/promoBindingVerificationService';

const binding = {
  id: 7,
  user_id: 22,
  platform: 'bilibili',
  platform_user_id: '2293237813',
  platform_username: '测试账号',
  binding_status: 'PENDING',
  bind_source: 'MANUAL',
  verified_at: null,
  last_verify_at: null,
};

const challengeSecret = 'verification-test-secret-that-is-long-enough-123456';

describe('promotion platform binding verification', () => {
  it('builds a deterministic binding-specific public challenge', () => {
    const first = buildPromoBindingChallenge(binding, challengeSecret);
    const repeated = buildPromoBindingChallenge(binding, challengeSecret);
    const other = buildPromoBindingChallenge({ ...binding, id: 8 }, challengeSecret);

    expect(first).toBe(repeated);
    expect(first).toMatch(/^STARX-BILI-[A-F0-9]{12}$/);
    expect(other).not.toBe(first);
  });

  it('accepts only exact public HTTPS hosts for the selected platform', () => {
    expect(validatePromoProofUrl('bilibili', 'https://space.bilibili.com/2293237813').hostname)
      .toBe('space.bilibili.com');
    expect(() => validatePromoProofUrl('bilibili', 'https://space.bilibili.com.evil.example/2293237813'))
      .toThrow('证明链接必须是所选平台的公开 HTTPS 页面');
    expect(() => validatePromoProofUrl('bilibili', 'http://space.bilibili.com/2293237813'))
      .toThrow('证明链接必须是所选平台的公开 HTTPS 页面');
  });

  it('marks ownership verified only when the public page contains the challenge', async () => {
    process.env.PROMO_BINDING_VERIFICATION_SECRET = challengeSecret;
    const challenge = buildPromoBindingChallenge(binding, challengeSecret);
    const update = vi.fn().mockImplementation(async ({ data }) => ({ ...binding, ...data }));
    const db = {
      promoPlatformBinding: {
        findFirst: vi.fn().mockResolvedValue(binding),
        update,
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(
      `<html><body>账号验证：${challenge}</body></html>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    ));

    const result = await verifyPromoPlatformBinding(
      db,
      binding.user_id,
      binding.id,
      'https://space.bilibili.com/2293237813',
      fetchImpl as typeof fetch,
    );

    expect(result.binding_status).toBe('VERIFIED');
    expect(result.verified_at).toBeInstanceOf(Date);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: binding.id },
      data: expect.objectContaining({
        binding_status: 'VERIFIED',
        bind_source: 'PUBLIC_PROFILE_CODE',
      }),
    }));
  });

  it('keeps the binding pending when the challenge is not visible', async () => {
    process.env.PROMO_BINDING_VERIFICATION_SECRET = challengeSecret;
    const update = vi.fn().mockImplementation(async ({ data }) => ({ ...binding, ...data }));
    const db = {
      promoPlatformBinding: {
        findFirst: vi.fn().mockResolvedValue(binding),
        update,
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(
      '<html><body>no verification code</body></html>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    ));

    await expect(verifyPromoPlatformBinding(
      db,
      binding.user_id,
      binding.id,
      'https://space.bilibili.com/2293237813',
      fetchImpl as typeof fetch,
    )).rejects.toMatchObject({ statusCode: 422 });

    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ binding_status: 'PENDING' }),
    }));
  });
});
