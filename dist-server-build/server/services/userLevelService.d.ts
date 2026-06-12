import type { User } from '../db';
/** 最高等级 */
export declare const MAX_USER_LEVEL = 100;
export declare const XP_LIKE = 3;
export declare const XP_COMMENT = 8;
export declare const XP_CHECKIN = 25;
/** 从 level 升到 level+1 所需经验（level 为当前等级 1..99） */
export declare function xpToNextFromLevel(currentLevel: number): number;
export type LevelProgress = {
    level: number;
    xpIntoLevel: number;
    xpForNext: number;
    progress: number;
    isMax: boolean;
};
export declare function getLevelProgress(totalXp: number): LevelProgress;
/** 等级额外服务器位（叠加在角色默认上限上，管理类角色不叠加） */
export declare function levelBonusServerSlots(level: number): number;
/** 达到该等级后解锁的权限标记（与角色自带权限合并） */
export declare function getLevelGrantedPermissions(level: number): string[];
/** 合并：角色默认 + 用户表 permissions JSON + 等级解锁 */
export declare function getEffectivePermissions(user: User): string[];
export declare function getEffectiveServerLimit(user: User): number;
/** 是否可发布服务器：管理类角色放行，其余需合并权限含 publish_servers */
export declare function userCanPublishServers(user: User): boolean;
export declare function invalidateUserCache(userId: number): Promise<void>;
export type ApplyXpResult = {
    ok: boolean;
    added: number;
    totalXp: number;
    progress: LevelProgress;
    leveledUp: boolean;
    previousLevel: number;
};
export declare function applyExperience(userId: number, amount: number, _reason?: string): Promise<ApplyXpResult | null>;
/** 对外展示用：仅暴露称号档位，不暴露具体经验值 */
export declare function publicTierBadgeFromXp(totalXp: number): 'trusted' | 'veteran' | 'elite' | null;
export declare function enrichUserWithLevel(user: Record<string, unknown>): {
    level: number;
    xp_total: number;
    xp_into_level: number;
    xp_for_next_level: number;
    level_progress: number;
    level_is_max: boolean;
    level_granted_permissions: string[];
    can_publish: boolean;
};
export declare function sameUtcCalendarDay(a: Date, b: Date): boolean;
export declare function sameCalendarDayInTimeZone(a: Date, b: Date, timeZone: string): boolean;
//# sourceMappingURL=userLevelService.d.ts.map