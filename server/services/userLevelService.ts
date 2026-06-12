import prisma from '../db';
import { redisService } from './redisService';
import { PermissionGroup, PermissionGroupManager } from '../config/permissionGroups';
import type { User } from '../db';
import { parseJsonArray } from '../utils/jsonField';

const USER_CACHE_PREFIX = 'user:cache:';

/** 最高等级 */
export const MAX_USER_LEVEL = 100;

export const XP_LIKE = 3;
export const XP_COMMENT = 8;
export const XP_CHECKIN = 25;

/** 从 level 升到 level+1 所需经验（level 为当前等级 1..99） */
export function xpToNextFromLevel(currentLevel: number): number {
  if (currentLevel >= MAX_USER_LEVEL) return 0;
  return 24 + currentLevel * 6;
}

export type LevelProgress = {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number;
  isMax: boolean;
};

export function getLevelProgress(totalXp: number): LevelProgress {
  let xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < MAX_USER_LEVEL) {
    const need = xpToNextFromLevel(level);
    if (xp < need) {
      return {
        level,
        xpIntoLevel: xp,
        xpForNext: need,
        progress: need > 0 ? xp / need : 1,
        isMax: false,
      };
    }
    xp -= need;
    level++;
  }
  return {
    level: MAX_USER_LEVEL,
    xpIntoLevel: 0,
    xpForNext: 0,
    progress: 1,
    isMax: true,
  };
}

/** 等级额外服务器位（叠加在角色默认上限上，管理类角色不叠加） */
export function levelBonusServerSlots(level: number): number {
  if (level >= 75) return 3;
  if (level >= 50) return 2;
  if (level >= 25) return 1;
  return 0;
}

/** 达到该等级后解锁的权限标记（与角色自带权限合并） */
export function getLevelGrantedPermissions(level: number): string[] {
  const out: string[] = [];
  if (level >= 3) out.push('rate_servers');
  if (level >= 5) out.push('comment_servers');
  if (level >= 35) out.push('level_trusted_member');
  if (level >= 60) out.push('level_veteran');
  if (level >= 85) out.push('level_elite');
  return out;
}

function roleBasePermissions(role: string): string[] {
  const g = PermissionGroupManager.getGroup(role as PermissionGroup);
  return g ? [...g.permissions] : [];
}

/** 合并：角色默认 + 用户表 permissions JSON + 等级解锁 */
export function getEffectivePermissions(user: User): string[] {
  const fromRole = roleBasePermissions(user.role);
  const fromDb = parseJsonArray(user.permissions);
  const { level } = getLevelProgress(user.experience_points ?? 0);
  const fromLevel = getLevelGrantedPermissions(level);
  return [...new Set([...fromRole, ...fromDb, ...fromLevel])];
}

function baseServerLimit(role: string): number {
  const g = PermissionGroupManager.getGroup(role as PermissionGroup);
  return g ? g.server_limit : 0;
}

export function getEffectiveServerLimit(user: User): number {
  const role = user.role;
  if (role === 'ADMIN' || role === 'OWNER' || role === 'OPERATOR') {
    return baseServerLimit(role);
  }
  const merged = getEffectivePermissions(user);
  const hasLegacyPublishPermission = merged.includes('publish_servers');
  const base = hasLegacyPublishPermission ? Math.max(1, baseServerLimit(role)) : 1;
  const { level } = getLevelProgress(user.experience_points ?? 0);
  const bonus = levelBonusServerSlots(level);
  return base + bonus;
}

/** 是否可发布服务器：管理类角色放行，其余需合并权限含 publish_servers */
export function userCanPublishServers(user: User): boolean {
  const role = user.role;
  if (role === 'ADMIN' || role === 'OPERATOR' || role === 'OWNER') {
    return true;
  }
  return getEffectiveServerLimit(user) > 0;
}

export async function invalidateUserCache(userId: number): Promise<void> {
  try {
    await redisService.del(`${USER_CACHE_PREFIX}${userId}`);
  } catch {
    // non-fatal
  }
}

export type ApplyXpResult = {
  ok: boolean;
  added: number;
  totalXp: number;
  progress: LevelProgress;
  leveledUp: boolean;
  previousLevel: number;
};

export async function applyExperience(
  userId: number,
  amount: number,
  _reason?: string
): Promise<ApplyXpResult | null> {
  if (amount <= 0) return null;
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { experience_points: true },
  });
  if (!before) return null;
  const prevLevel = getLevelProgress(before.experience_points).level;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { experience_points: { increment: amount } },
    select: { experience_points: true },
  });
  await invalidateUserCache(userId);
  const progress = getLevelProgress(updated.experience_points);
  return {
    ok: true,
    added: amount,
    totalXp: updated.experience_points,
    progress,
    leveledUp: progress.level > prevLevel,
    previousLevel: prevLevel,
  };
}

/** 对外展示用：仅暴露称号档位，不暴露具体经验值 */
export function publicTierBadgeFromXp(totalXp: number): 'trusted' | 'veteran' | 'elite' | null {
  const { level } = getLevelProgress(totalXp);
  if (level >= 85) return 'elite';
  if (level >= 60) return 'veteran';
  if (level >= 35) return 'trusted';
  return null;
}

export function enrichUserWithLevel(user: Record<string, unknown>) {
  const xp = typeof user.experience_points === 'number' ? user.experience_points : 0;
  const prog = getLevelProgress(xp);
  const granted = getLevelGrantedPermissions(prog.level);
  return {
    ...user,
    level: prog.level,
    xp_total: xp,
    xp_into_level: prog.xpIntoLevel,
    xp_for_next_level: prog.xpForNext,
    level_progress: prog.progress,
    level_is_max: prog.isMax,
    level_granted_permissions: granted,
    can_publish: userCanPublishServers(user as User),
  };
}

export function sameUtcCalendarDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export function sameCalendarDayInTimeZone(a: Date, b: Date, timeZone: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(a) === formatter.format(b);
}
