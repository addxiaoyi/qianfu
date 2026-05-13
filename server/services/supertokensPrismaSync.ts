import SuperTokens from 'supertokens-node';
import prisma from '../db';
import { logger } from '../utils/logger';
import { DEFAULT_PERMISSION_GROUP, getDefaultPermissions } from '../config/permissionGroups';
import { hookService, MotiaHook } from '../services/hookService';
import { redisService } from '../services/redisService';

const USER_CACHE_PREFIX = 'user:cache:';

export interface SyncMeta {
  userId?: string;
  supertokensUserId?: string;
  syncedAt?: Date;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
}

/**
 * 将 SuperTokens 用户与 Prisma User 绑定（按 stUserId 或邮箱去重），并维护登录统计。
 */
export async function syncPrismaUserFromSuperTokens(
  stUserId: string,
  email: string,
  meta: SyncMeta
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const shouldMarkEmailVerified = meta.emailVerified === true;
  if (!normalized) {
    logger.warn('[SuperTokens] sync skipped: empty email', { stUserId });
    return;
  }

  const existingBySt = await prisma.user.findUnique({
    where: { supertokens_user_id: stUserId },
  });
  if (existingBySt) {
    await prisma.user.update({
      where: { id: existingBySt.id },
      data: {
        last_login_at: new Date(),
        login_count: { increment: 1 },
        ...(shouldMarkEmailVerified && !existingBySt.email_verified ? { email_verified: true } : {}),
        ...(meta.name && !existingBySt.display_name ? { display_name: meta.name } : {}),
        ...(meta.picture && !existingBySt.avatar_url ? { avatar_url: meta.picture } : {}),
      },
    });
    return;
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email: normalized },
  });

  if (existingByEmail) {
    if (existingByEmail.supertokens_user_id && existingByEmail.supertokens_user_id !== stUserId) {
      logger.error('[SuperTokens] Email already linked to another auth account', {
        email: normalized,
      });
      throw new Error('ACCOUNT_LINK_CONFLICT');
    }
    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        supertokens_user_id: stUserId,
        email_verified: existingByEmail.email_verified || shouldMarkEmailVerified,
        last_login_at: new Date(),
        login_count: { increment: 1 },
        display_name: existingByEmail.display_name ?? meta.name ?? undefined,
        avatar_url: existingByEmail.avatar_url ?? meta.picture ?? undefined,
      },
    });
    return;
  }

  const baseUsername = (meta.name?.replace(/\s+/g, '_') || normalized.split('@')[0] || 'user').slice(0, 64);
  let username = baseUsername;
  let suffix = 0;
  while (await prisma.user.findFirst({ where: { username } })) {
    suffix += 1;
    username = `${baseUsername}_${suffix}`;
  }

  const user = await prisma.user.create({
    data: {
      email: normalized,
      supertokens_user_id: stUserId,
      username,
      display_name: meta.name ?? username,
      avatar_url: meta.picture ?? null,
      email_verified: shouldMarkEmailVerified,
      preferences: JSON.stringify({ theme: 'system', language: 'zh' }),
      role: DEFAULT_PERMISSION_GROUP,
      permissions: JSON.stringify(getDefaultPermissions()),
    },
  });

  hookService.trigger(MotiaHook.USER_REGISTERED, { user });
}

/** 会话有效但本地无用户行时，用 Core 中的用户信息补一次同步，并清除 Redis 缓存 */
export async function repairPrismaUserIfMissing(stUserId: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { supertokens_user_id: stUserId },
  });
  if (existing) return;

  const stUser = await SuperTokens.getUser(stUserId);
  const email = stUser?.emails?.[0];
  if (!email) {
    logger.warn('[SuperTokens] repair skipped: no email on Core user', { stUserId });
    return;
  }

  await syncPrismaUserFromSuperTokens(stUserId, email, {});

  // 清除 Redis 中该用户的缓存，确保数据一致性
  const freshUser = await prisma.user.findUnique({
    where: { supertokens_user_id: stUserId },
    select: { id: true },
  });
  if (freshUser?.id) {
    await redisService.del(`${USER_CACHE_PREFIX}${freshUser.id}`);
  }
}
