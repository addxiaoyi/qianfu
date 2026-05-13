import { Response, NextFunction } from 'express';
import prisma from '../db';
import { AuthRequest } from '../middleware/auth';
import { AppError, ErrorCode } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { deposit } from '../lib/wallet';
import { logAction } from '../services/auditService';
import {
  getLevelProgress,
  invalidateUserCache,
  sameCalendarDayInTimeZone,
  sameUtcCalendarDay,
  XP_CHECKIN,
} from '../services/userLevelService';

type CheckinHistoryRow = {
  id: number;
  user_id: number;
  checkin_date: string;
  timezone: string | null;
  base_reward: number;
  bonus_reward: number;
  total_reward: number;
  streak_days: number;
  created_at: string;
};

let checkinTableEnsured = false;

async function ensureCheckinHistoryTable() {
  if (checkinTableEnsured) return;

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

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS idx_checkin_history_user_created ON checkin_history(user_id, created_at DESC)'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS idx_checkin_history_user_date ON checkin_history(user_id, checkin_date DESC)'
  );

  checkinTableEnsured = true;
}

function weightedRandomAmount(min: number, max: number, skew = 2.2): number {
  const raw = Math.random();
  const skewed = Math.pow(raw, skew);
  const amount = min + (max - min) * skewed;
  return Math.round(amount * 100) / 100;
}

function getCalendarDayKey(date: Date, timeZone?: string): string {
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

function dayDiff(fromDay: string, toDay: string): number {
  const from = new Date(`${fromDay}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDay}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function getStreakBonus(streakDays: number): number {
  if (streakDays > 0 && streakDays % 7 === 0) {
    return weightedRandomAmount(0.10, 2.00, 1.9);
  }
  return 0;
}

async function getCurrentStreak(userId: number): Promise<number> {
  await ensureCheckinHistoryTable();
  const rows = await prisma.$queryRawUnsafe<Array<Pick<CheckinHistoryRow, 'streak_days'>>>(
    'SELECT streak_days FROM checkin_history WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
    userId
  );
  return rows[0]?.streak_days ?? 0;
}

export const getCheckinStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);

    await ensureCheckinHistoryTable();

    const now = new Date();
    const tz = typeof req.query?.timezone === 'string' ? req.query.timezone : undefined;
    const todayKey = getCalendarDayKey(now, tz);

    const [todayRows, latestRows, recentRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<Pick<CheckinHistoryRow, 'id'>>>(
        'SELECT id FROM checkin_history WHERE user_id = ? AND checkin_date = ? LIMIT 1',
        userId,
        todayKey
      ),
      prisma.$queryRawUnsafe<Array<Pick<CheckinHistoryRow, 'streak_days'>>>(
        'SELECT streak_days FROM checkin_history WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
        userId
      ),
      prisma.$queryRawUnsafe<Array<Pick<CheckinHistoryRow, 'checkin_date'>>>(
        'SELECT checkin_date FROM checkin_history WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 30',
        userId
      ),
    ]);

    return sendSuccess(res, {
      todaySigned: todayRows.length > 0,
      streakDays: latestRows[0]?.streak_days ?? 0,
      recentCheckinDates: recentRows.map(r => r.checkin_date),
      todayKey,
      timezone: tz ?? 'UTC',
    });
  } catch (e) {
    next(e);
  }
};

export const postCheckin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);

    await ensureCheckinHistoryTable();

    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { last_checkin_at: true, experience_points: true },
    });
    if (!row) throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);

    const now = new Date();
    const clientTz = typeof req.body?.timezone === 'string' ? req.body.timezone : undefined;
    const todayKey = getCalendarDayKey(now, clientTz);

    const hasCheckedInByUser = row.last_checkin_at
      ? clientTz
        ? sameCalendarDayInTimeZone(row.last_checkin_at, now, clientTz)
        : sameUtcCalendarDay(row.last_checkin_at, now)
      : false;

    const todayRecordRows = await prisma.$queryRawUnsafe<Array<CheckinHistoryRow>>(
      'SELECT * FROM checkin_history WHERE user_id = ? AND checkin_date = ? LIMIT 1',
      userId,
      todayKey
    );
    const todayRecord = todayRecordRows[0];

    if (hasCheckedInByUser || todayRecord) {
      const prog = getLevelProgress(row.experience_points);
      const streakDays = todayRecord?.streak_days ?? (await getCurrentStreak(userId));
      return sendSuccess(res, {
        ok: false,
        alreadyCheckedIn: true,
        totalXp: row.experience_points,
        streakDays,
        level: prog.level,
        xp_into_level: prog.xpIntoLevel,
        xp_for_next_level: prog.xpForNext,
        level_progress: prog.progress,
      });
    }

    const baseReward = weightedRandomAmount(0.01, 1.0, 2.2);

    const txResult = await prisma.$transaction(async (tx) => {
      const latestRows = await tx.$queryRawUnsafe<Array<Pick<CheckinHistoryRow, 'checkin_date' | 'streak_days'>>>(
        'SELECT checkin_date, streak_days FROM checkin_history WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1',
        userId
      );

      const latest = latestRows[0];
      const streakDays = latest && dayDiff(latest.checkin_date, todayKey) === 1 ? latest.streak_days + 1 : 1;
      const bonusReward = getStreakBonus(streakDays);
      const totalReward = Math.round((baseReward + bonusReward) * 100) / 100;

      await tx.$executeRawUnsafe(
        `INSERT INTO checkin_history (user_id, checkin_date, timezone, base_reward, bonus_reward, total_reward, streak_days)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userId,
        todayKey,
        clientTz ?? null,
        baseReward,
        bonusReward,
        totalReward,
        streakDays
      );

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

    const wallet = await deposit(
      userId,
      txResult.totalReward,
      txResult.bonusReward > 0 ? '每日签到奖励（含连续签到加成，不可提现）' : '每日签到奖励（不可提现）',
      {
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
      }
    );

    await logAction(userId, 'CHECKIN_REWARD_GRANTED', `user:${userId}`, req as any, {
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
    });
  } catch (e) {
    next(e);
  }
};
