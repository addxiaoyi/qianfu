import prisma from '../db.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { deposit } from '../lib/wallet.js';
import { logAction } from '../services/auditService.js';
import { getLevelProgress, invalidateUserCache, sameCalendarDayInTimeZone, sameUtcCalendarDay, XP_CHECKIN, } from '../services/userLevelService.js';
import { getPrimaryDbProvider } from '../utils/dbProvider.js';
let checkinTableEnsured = false;
async function ensureCheckinHistoryTable() {
    if (checkinTableEnsured)
        return;
    if (getPrimaryDbProvider() === 'mysql') {
        checkinTableEnsured = true;
        return;
    }
    try {
        await prisma.$queryRawUnsafe('SELECT 1 FROM checkin_history LIMIT 1');
        checkinTableEnsured = true;
        return;
    }
    catch {
        // Table missing or not queryable yet; continue with provider-specific bootstrap.
    }
    if (getPrimaryDbProvider() === 'postgresql') {
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS checkin_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        checkin_date TEXT NOT NULL,
        timezone TEXT,
        base_reward DOUBLE PRECISION NOT NULL,
        bonus_reward DOUBLE PRECISION NOT NULL DEFAULT 0,
        total_reward DOUBLE PRECISION NOT NULL,
        streak_days INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, checkin_date)
      )
    `);
    }
    else if (getPrimaryDbProvider() === 'mysql') {
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS checkin_history (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        checkin_date VARCHAR(32) NOT NULL,
        timezone VARCHAR(128),
        base_reward DOUBLE NOT NULL,
        bonus_reward DOUBLE NOT NULL DEFAULT 0,
        total_reward DOUBLE NOT NULL,
        streak_days INTEGER NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_checkin_date (user_id, checkin_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
        await prisma.$executeRawUnsafe(`
      CREATE INDEX idx_checkin_history_user_created
      ON checkin_history(user_id, created_at DESC)
    `).catch(() => { });
        await prisma.$executeRawUnsafe(`
      CREATE INDEX idx_checkin_history_user_date
      ON checkin_history(user_id, checkin_date DESC)
    `).catch(() => { });
    }
    else {
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS checkin_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        checkin_date TEXT NOT NULL,
        timezone TEXT,
        base_reward REAL NOT NULL,
        bonus_reward REAL NOT NULL DEFAULT 0,
        total_reward REAL NOT NULL,
        streak_days INTEGER NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, checkin_date)
      )
    `);
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_checkin_history_user_created ON checkin_history(user_id, created_at DESC)');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_checkin_history_user_date ON checkin_history(user_id, checkin_date DESC)');
    }
    checkinTableEnsured = true;
}
function weightedRandomAmount(min, max, skew = 2.2) {
    const raw = Math.random();
    const skewed = Math.pow(raw, skew);
    const amount = min + (max - min) * skewed;
    return Math.round(amount * 100) / 100;
}
function getCalendarDayKey(date, timeZone) {
    if (!timeZone) {
        return date.toISOString().slice(0, 10);
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(date);
}
function dayDiff(fromDay, toDay) {
    const from = new Date(`${fromDay}T00:00:00.000Z`).getTime();
    const to = new Date(`${toDay}T00:00:00.000Z`).getTime();
    return Math.round((to - from) / (24 * 60 * 60 * 1000));
}
function getStreakBonus(streakDays) {
    if (streakDays > 0 && streakDays % 7 === 0) {
        return weightedRandomAmount(0.10, 2.00, 1.9);
    }
    return 0;
}
async function getCurrentStreak(userId) {
    await ensureCheckinHistoryTable();
    const rows = await prisma.$queryRaw `
    SELECT streak_days
    FROM checkin_history
    WHERE user_id = ${userId}
    ORDER BY checkin_date DESC
    LIMIT 1
  `;
    return rows[0]?.streak_days ?? 0;
}
export const getCheckinStatus = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
        await ensureCheckinHistoryTable();
        const now = new Date();
        const tz = typeof req.query?.timezone === 'string' ? req.query.timezone : undefined;
        const todayKey = getCalendarDayKey(now, tz);
        const [todayRows, latestRows, recentRows] = await Promise.all([
            prisma.$queryRaw `
        SELECT id
        FROM checkin_history
        WHERE user_id = ${userId} AND checkin_date = ${todayKey}
        LIMIT 1
      `,
            prisma.$queryRaw `
        SELECT streak_days
        FROM checkin_history
        WHERE user_id = ${userId}
        ORDER BY checkin_date DESC
        LIMIT 1
      `,
            prisma.$queryRaw `
        SELECT checkin_date
        FROM checkin_history
        WHERE user_id = ${userId}
        ORDER BY checkin_date DESC
        LIMIT 30
      `,
        ]);
        const checkedInToday = todayRows.length > 0;
        return sendSuccess(res, {
            checkedInToday,
            todaySigned: checkedInToday,
            streakDays: latestRows[0]?.streak_days ?? 0,
            rewardXp: XP_CHECKIN,
            recentCheckinDates: recentRows.map(r => r.checkin_date),
            todayKey,
            timezone: tz ?? 'UTC',
        });
    }
    catch (e) {
        next(e);
    }
};
export const postCheckin = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
        await ensureCheckinHistoryTable();
        const row = await prisma.user.findUnique({
            where: { id: userId },
            select: { last_checkin_at: true, experience_points: true },
        });
        if (!row)
            throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
        const now = new Date();
        const clientTz = typeof req.body?.timezone === 'string' ? req.body.timezone : undefined;
        const todayKey = getCalendarDayKey(now, clientTz);
        const hasCheckedInByUser = row.last_checkin_at
            ? clientTz
                ? sameCalendarDayInTimeZone(row.last_checkin_at, now, clientTz)
                : sameUtcCalendarDay(row.last_checkin_at, now)
            : false;
        const todayRecordRows = await prisma.$queryRaw `
      SELECT *
      FROM checkin_history
      WHERE user_id = ${userId} AND checkin_date = ${todayKey}
      LIMIT 1
    `;
        const todayRecord = todayRecordRows[0];
        if (hasCheckedInByUser || todayRecord) {
            const prog = getLevelProgress(row.experience_points);
            const streakDays = todayRecord?.streak_days ?? (await getCurrentStreak(userId));
            return sendSuccess(res, {
                ok: false,
                checkedInToday: true,
                alreadyCheckedIn: true,
                gainedXp: 0,
                rewardXp: XP_CHECKIN,
                totalXp: row.experience_points,
                streakDays,
                level: prog.level,
                xp_into_level: prog.xpIntoLevel,
                xp_for_next_level: prog.xpForNext,
                level_progress: prog.progress,
                checkinAt: row.last_checkin_at?.toISOString?.() ?? null,
            });
        }
        const baseReward = weightedRandomAmount(0.01, 1.0, 2.2);
        const txResult = await prisma.$transaction(async (tx) => {
            const latestRows = await tx.$queryRaw `
        SELECT checkin_date, streak_days
        FROM checkin_history
        WHERE user_id = ${userId}
        ORDER BY checkin_date DESC
        LIMIT 1
      `;
            const latest = latestRows[0];
            const streakDays = latest && dayDiff(latest.checkin_date, todayKey) === 1 ? latest.streak_days + 1 : 1;
            const bonusReward = getStreakBonus(streakDays);
            const totalReward = Math.round((baseReward + bonusReward) * 100) / 100;
            await tx.$executeRaw `
        INSERT INTO checkin_history (
          user_id,
          checkin_date,
          timezone,
          base_reward,
          bonus_reward,
          total_reward,
          streak_days
        )
        VALUES (
          ${userId},
          ${todayKey},
          ${clientTz ?? null},
          ${baseReward},
          ${bonusReward},
          ${totalReward},
          ${streakDays}
        )
      `;
            const updated = await tx.user.update({
                where: { id: userId },
                data: {
                    last_checkin_at: now,
                    experience_points: { increment: XP_CHECKIN },
                },
                select: { experience_points: true, last_checkin_at: true },
            });
            return { updated, streakDays, bonusReward, totalReward };
        });
        const wallet = await deposit(userId, txResult.totalReward, txResult.bonusReward > 0 ? '每日签到奖励（含连续签到加成，不可提现）' : '每日签到奖励（不可提现）', {
            type: 'CHECKIN_REWARD',
            metadata: {
                source: 'daily_checkin',
                nonWithdrawable: true,
                checkinAt: now.toISOString(),
                checkinDate: todayKey,
                streakDays: txResult.streakDays,
                baseReward,
                bonusReward: txResult.bonusReward,
            },
        });
        await logAction(userId, 'CHECKIN_REWARD_GRANTED', `user:${userId}`, req, {
            gainedXp: XP_CHECKIN,
            gainedBalance: txResult.totalReward,
            baseReward,
            streakBonusReward: txResult.bonusReward,
            streakDays: txResult.streakDays,
            nonWithdrawable: true,
            timezone: clientTz ?? null,
            checkinDate: todayKey,
            checkinAt: now.toISOString(),
        });
        await invalidateUserCache(userId);
        const progress = getLevelProgress(txResult.updated.experience_points);
        return sendSuccess(res, {
            ok: true,
            gainedXp: XP_CHECKIN,
            gainedBalance: txResult.totalReward,
            baseReward,
            streakBonusReward: txResult.bonusReward,
            streakDays: txResult.streakDays,
            gainedBalanceWithdrawable: false,
            walletBalance: wallet.balance,
            totalXp: txResult.updated.experience_points,
            level: progress.level,
            xp_into_level: progress.xpIntoLevel,
            xp_for_next_level: progress.xpForNext,
            level_progress: progress.progress,
            level_is_max: progress.isMax,
            checkedInToday: true,
            rewardXp: XP_CHECKIN,
            checkinAt: txResult.updated.last_checkin_at?.toISOString?.() ?? now.toISOString(),
        });
    }
    catch (e) {
        next(e);
    }
};
//# sourceMappingURL=userLevelController.js.map