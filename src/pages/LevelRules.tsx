import React from 'react';
import {
  ArrowUpRight,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Compass,
  LockKeyhole,
  ListChecks,
  Loader2,
  MessageSquare,
  RefreshCw,
  Server,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { fetchLevelRules } from '@/api/levelRulesApi';
import { api } from '@/api/request';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
import { useAuthStore } from '@/store/authStore';
import type { CheckinStatus, LevelProgress, LevelRule, LevelRulesResponse } from '@/types/api';

const progressPercent = (progress: number) =>
  Math.round(Math.min(1, Math.max(0, progress <= 1 ? progress : progress / 100)) * 100);

const findNextUnlock = (rules: LevelRule[], progress?: LevelProgress | null) => {
  if (!progress) return null;

  return rules
    .filter((rule) => typeof rule.level === 'number' && rule.level > progress.currentLevel)
    .sort((left, right) => (left.level ?? 0) - (right.level ?? 0))[0] ?? null;
};

type RuleFilter = 'all' | 'xp' | 'unlock';

const isRuleUnlocked = (rule: LevelRule, progress?: LevelProgress | null) =>
  rule.kind === 'xp' || Boolean(progress && typeof rule.level === 'number' && rule.level <= progress.currentLevel);

const activityPath = (rule: LevelRule) => {
  const text = `${rule.title} ${rule.description}`;
  if (text.includes('签到')) return '/dashboard';
  if (text.includes('发布')) return '/editor';
  return '/servers';
};

const actionRules = (rules: LevelRule[], progress?: LevelProgress | null) => {
  if (!progress || progress.isMax) return [];

  const remainingXp = Math.max(0, progress.xpForNextLevel - progress.xpIntoLevel);
  return rules
    .filter((rule) => rule.kind === 'xp' && typeof rule.xp === 'number' && rule.xp > 0)
    .sort((left, right) => (right.xp ?? 0) - (left.xp ?? 0))
    .slice(0, 3)
    .map((rule) => ({
      rule,
      count: Math.ceil(remainingXp / (rule.xp ?? 1)),
    }));
};

const RuleItem: React.FC<{ rule: LevelRule; progress?: LevelProgress | null }> = ({ rule, progress }) => {
  const unlocked = isRuleUnlocked(rule, progress);

  return (
  <li className="flex gap-4 border-t border-zinc-200/80 py-5 first:border-t-0">
    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
      {rule.kind === 'xp' ? <Trophy className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
    </span>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-zinc-950">{rule.title}</h3>
        {typeof rule.level === 'number' && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
            Lv.{rule.level}
          </span>
        )}
        {typeof rule.xp === 'number' && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            +{rule.xp} XP
          </span>
        )}
        {rule.kind !== 'xp' && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${unlocked ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
            {unlocked ? '已解锁' : '待解锁'}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{rule.description}</p>
    </div>
  </li>
  );
};

const GrowthOverview: React.FC<{ rules: LevelRule[]; progress?: LevelProgress | null }> = ({ rules, progress }) => {
  const xpRules = rules.filter((rule) => rule.kind === 'xp');
  const unlockRules = rules.filter((rule) => rule.kind !== 'xp');
  const unlockedCount = progress
    ? unlockRules.filter((rule) => isRuleUnlocked(rule, progress)).length
    : 0;

  return (
    <section aria-labelledby="growth-overview-title" className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Your progress</p>
          <h2 id="growth-overview-title" className="mt-2 text-lg font-black">成长概览</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
          <Sparkles className="h-3.5 w-3.5" /> 规则版本实时同步
        </span>
      </div>
      <div className="mt-5 grid grid-cols-1 divide-y divide-zinc-200 border-t border-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="py-4 sm:pr-5">
          <p className="text-xs font-bold text-zinc-500">当前 XP</p>
          <p className="mt-1 text-2xl font-black text-zinc-950">{progress ? progress.totalXp : '--'}</p>
          <p className="mt-1 text-xs text-zinc-500">{progress ? `Lv.${progress.currentLevel} 成长经验` : '登录后显示个人经验'}</p>
        </div>
        <div className="py-4 sm:px-5">
          <p className="text-xs font-bold text-zinc-500">XP 获取方式</p>
          <p className="mt-1 text-2xl font-black text-zinc-950">{xpRules.length}</p>
          <p className="mt-1 text-xs text-zinc-500">签到、互动与社区贡献</p>
        </div>
        <div className="py-4 sm:pl-5">
          <p className="text-xs font-bold text-zinc-500">已解锁权益</p>
          <p className="mt-1 text-2xl font-black text-zinc-950">{progress ? `${unlockedCount}/${unlockRules.length}` : '--'}</p>
          <p className="mt-1 text-xs text-zinc-500">等级越高，可用能力越多</p>
        </div>
      </div>
    </section>
  );
};

const RuleDetails: React.FC<{ rules: LevelRule[]; progress?: LevelProgress | null }> = ({ rules, progress }) => {
  const [filter, setFilter] = useState<RuleFilter>('all');
  const visibleRules = useMemo(
    () => rules.filter((rule) => filter === 'all' || (filter === 'xp' ? rule.kind === 'xp' : rule.kind !== 'xp')),
    [filter, rules],
  );
  const filters: Array<{ id: RuleFilter; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'xp', label: '获取 XP' },
    { id: 'unlock', label: '等级权益' },
  ];

  return (
    <section aria-labelledby="rule-list-title" className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Latest policy</p>
          <h2 id="rule-list-title" className="mt-2 text-xl font-black">规则明细</h2>
        </div>
        <span className="text-xs font-bold text-zinc-400">{visibleRules.length}/{rules.length} 条</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="规则分类">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${filter === item.id ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {rules.length === 0 ? (
        <div className="py-14 text-center" role="status">
          <p className="font-bold text-zinc-900">暂无等级规则</p>
          <p className="mt-2 text-sm text-zinc-500">服务端还没有发布可展示的规则。</p>
        </div>
      ) : visibleRules.length === 0 ? (
        <div className="py-12 text-center" role="status">
          <p className="font-bold text-zinc-900">此分类暂无规则</p>
          <p className="mt-2 text-sm text-zinc-500">切换分类查看其他成长内容。</p>
        </div>
      ) : (
        <ul className="mt-1">
          {visibleRules.map((rule) => <RuleItem key={rule.id} rule={rule} progress={progress} />)}
        </ul>
      )}
    </section>
  );
};

const GrowthRoadmap: React.FC<{ rules: LevelRule[]; progress?: LevelProgress | null; nextUnlock?: LevelRule | null }> = ({ rules, progress, nextUnlock }) => {
  const milestones = rules
    .filter((rule) => rule.kind !== 'xp' && typeof rule.level === 'number')
    .sort((left, right) => (left.level ?? 0) - (right.level ?? 0));

  return (
    <section aria-labelledby="growth-roadmap-title" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Milestones</p>
          <h2 id="growth-roadmap-title" className="mt-2 text-lg font-black">成长路线</h2>
        </div>
        <Target className="h-5 w-5 text-zinc-400" />
      </div>
      {milestones.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-500">暂时没有可展示的等级里程碑。</p>
      ) : (
        <ol className="mt-5 space-y-3">
          {milestones.map((rule) => {
            const unlocked = isRuleUnlocked(rule, progress);
            const isNext = Boolean(nextUnlock && nextUnlock.id === rule.id);

            return (
              <li key={rule.id} className={`flex items-start gap-3 rounded-xl border p-3 ${isNext ? 'border-amber-300 bg-amber-50/70' : 'border-zinc-200'}`}>
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${unlocked ? 'bg-emerald-100 text-emerald-700' : isNext ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-500'}`}>
                  {unlocked ? <Check className="h-4 w-4" /> : isNext ? <Target className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-zinc-950">Lv.{rule.level} · {rule.title}</span>
                    <span className={`text-[11px] font-bold ${unlocked ? 'text-emerald-700' : isNext ? 'text-amber-800' : 'text-zinc-500'}`}>
                      {unlocked ? '已解锁' : isNext ? '下一目标' : '待解锁'}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">{rule.description}</span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-300" />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

const RuleGuide: React.FC = () => (
  <section aria-labelledby="rule-guide-title" className="rounded-2xl border border-zinc-200 bg-zinc-100/70 p-5">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
        <ListChecks className="h-4 w-4" />
      </span>
      <div>
        <h2 id="rule-guide-title" className="font-black text-zinc-950">规则说明</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">经验只通过真实站内行为获得，等级和权益由服务端统一判定。</p>
      </div>
    </div>
    <ul className="mt-4 grid gap-3 text-sm leading-6 text-zinc-600 sm:grid-cols-3">
      <li className="border-t border-zinc-300 pt-3"><strong className="text-zinc-950">每日签到</strong><br />每天最多计算一次，连续参与可保持成长节奏。</li>
      <li className="border-t border-zinc-300 pt-3"><strong className="text-zinc-950">社区互动</strong><br />点赞和评论都需要进入真实服务器页面完成。</li>
      <li className="border-t border-zinc-300 pt-3"><strong className="text-zinc-950">等级权益</strong><br />达到目标等级后自动生效，不需要手动领取。</li>
    </ul>
  </section>
);

const ActivityLink: React.FC<{
  to: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = ({ to, label, description, icon }) => (
  <Link
    to={to}
    className="group flex min-h-24 items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-900"
  >
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-zinc-950">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-zinc-500">{description}</span>
      </span>
    </span>
    <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  </Link>
);

const TodayGrowthTasks: React.FC<{
  isAuthenticated: boolean;
  checkinStatus?: CheckinStatus | null;
  isLoading: boolean;
  isError: boolean;
}> = ({ isAuthenticated, checkinStatus, isLoading, isError }) => {
  const checkinHref = isAuthenticated ? '/dashboard' : '/login';
  const checkinLabel = !isAuthenticated
    ? '登录后签到'
    : checkinStatus?.checkedInToday
      ? '今日已签到'
      : '立即签到';

  return (
    <section aria-labelledby="today-growth-title" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Today</p>
          <h2 id="today-growth-title" className="mt-2 text-lg font-black">今日成长任务</h2>
        </div>
        <CalendarCheck2 className="h-5 w-5 text-zinc-400" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
                <CalendarCheck2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-zinc-950">每日签到</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {isLoading
                    ? '正在读取今日状态...'
                    : isError
                      ? '暂时无法读取签到状态，请进入控制台确认。'
                      : checkinStatus?.checkedInToday
                        ? '今日经验已计入，明天再来继续连签。'
                        : `今日可获得 +${checkinStatus?.rewardXp ?? 0} XP`}
                </p>
              </div>
            </div>
            <Link to={checkinHref} className="shrink-0 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800">
              {checkinLabel}
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-bold text-zinc-500">连续签到</p>
          <p className="mt-1 text-xl font-black text-zinc-950">
            {isLoading || isError || !isAuthenticated ? '--' : `${checkinStatus?.streakDays ?? 0} 天`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">保持连续参与，避免中断成长节奏</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-bold text-zinc-500">今日可获得 XP</p>
          <p className="mt-1 text-xl font-black text-zinc-950">
            {isLoading || isError || !isAuthenticated ? '--' : `+${checkinStatus?.rewardXp ?? 0}`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">每日最多结算一次签到经验</p>
        </div>
      </div>
    </section>
  );
};

const ActionAdvice: React.FC<{ rules: LevelRule[]; progress?: LevelProgress | null }> = ({ rules, progress }) => {
  const actions = actionRules(rules, progress);

  return (
    <section aria-labelledby="action-advice-title" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">Next move</p>
          <h2 id="action-advice-title" className="mt-2 text-lg font-black">行动建议</h2>
        </div>
        <Target className="h-5 w-5 text-zinc-400" />
      </div>

      {!progress ? (
        <p className="mt-4 text-sm leading-6 text-zinc-500">登录后显示到下一等级还需要多少 XP，以及对应的完成次数估算。</p>
      ) : progress.isMax ? (
        <p className="mt-4 text-sm leading-6 text-emerald-700">当前已达到最高等级，继续参与社区活动即可保持贡献记录。</p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-6 text-zinc-600">
            到下一等级还需要 <strong className="text-zinc-950">{Math.max(0, progress.xpForNextLevel - progress.xpIntoLevel)} XP</strong>。
          </p>
          {actions.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {actions.map(({ rule, count }) => (
                <li key={rule.id}>
                  <Link to={activityPath(rule)} className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 hover:border-zinc-900">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-zinc-950">{rule.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">约 {count} 次，按单次 +{rule.xp} XP 估算；实际以服务端限制为准</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-zinc-950" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">当前没有可计算的 XP 获取方式。</p>
          )}
        </>
      )}
    </section>
  );
};

const ProgressCard: React.FC<{
  progress?: LevelProgress | null;
  nextUnlock?: LevelRule | null;
}> = ({ progress, nextUnlock }) => {
  const percent = progress ? progressPercent(progress.progress) : 0;

  return (
    <section aria-labelledby="level-progress-title" className="rounded-2xl bg-zinc-950 p-6 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">个人成长</p>
          <h2 id="level-progress-title" className="mt-2 text-xl font-black">当前等级</h2>
        </div>
        {progress ? (
          <span className="text-3xl font-black">Lv.{progress.currentLevel}</span>
        ) : (
          <span className="text-3xl font-black text-zinc-500">Lv.--</span>
        )}
      </div>

      {progress ? (
        <>
          <div className="mt-6 flex items-center justify-between text-xs font-bold text-zinc-300">
            <span>{progress.totalXp} XP</span>
            <span>{progress.isMax ? '已达最高等级' : `${progress.xpForNextLevel - progress.xpIntoLevel} XP 到下一级`}</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-label="等级经验进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>本级进度 {progress.xpIntoLevel} / {progress.xpForNextLevel} XP</span>
            <span>{percent}%</span>
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm leading-6 text-zinc-400">登录后可查看你的等级、XP 进度和下一解锁。</p>
      )}

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">下一解锁</p>
        <p className="mt-2 font-bold text-white">
          {nextUnlock ? `${nextUnlock.title}${nextUnlock.level ? ` · Lv.${nextUnlock.level}` : ''}` : progress ? '暂无更多解锁' : '登录后匹配个人等级'}
        </p>
        {nextUnlock && <p className="mt-1 text-sm leading-6 text-zinc-400">{nextUnlock.description}</p>}
      </div>
    </section>
  );
};

const LevelRules: React.FC = () => {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id ?? 'guest');
  const isAuthenticated = useAuthStore((state) => Boolean(state.user));
  const { data, isLoading, isError, refetch } = useQuery<LevelRulesResponse>({
    queryKey: ['level-rules', userId],
    queryFn: fetchLevelRules,
    retry: false,
  });
  const { data: checkinStatus, isLoading: checkinLoading, isError: checkinError } = useQuery<CheckinStatus>({
    queryKey: ['level-rules-checkin', userId],
    queryFn: () => api.get<CheckinStatus>(isRustV2Enabled() ? rustV2Path('/user/checkin/status') : '/user/checkin/status', undefined, isRustV2Enabled() ? rustV2RequestOptions : undefined),
    enabled: isAuthenticated,
    staleTime: 30_000,
    retry: false,
  });

  const handleRetry = () => {
    void refetch();
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
        <div className="mx-auto flex max-w-4xl items-center justify-center py-32" role="status" aria-live="polite">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          <span className="font-bold">等级规则加载中...</span>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
        <div className="mx-auto max-w-4xl">
          <button type="button" onClick={handleBack} className="mb-12 inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-950">
            <ChevronLeft className="h-4 w-4" /> 返回
          </button>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
              <div>
                <h1 className="font-black text-red-950">等级规则暂时无法加载</h1>
                <p className="mt-2 text-sm leading-6 text-red-800">请检查网络连接后重试，失败时不会显示过期规则。</p>
                <button type="button" onClick={handleRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800">
                  <RefreshCw className="h-4 w-4" /> 重新加载
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const rules = data?.rules ?? [];
  const nextUnlock = data?.nextUnlock ?? findNextUnlock(rules, data?.progress);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 pb-20 pt-10 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={handleBack} className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-950">
          <ChevronLeft className="h-4 w-4" /> 返回
        </button>

        <header className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Growth system</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">等级与经验规则</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">查看经验来源、等级解锁和你的当前成长进度。规则以服务端最新配置为准。</p>
        </header>

        <GrowthOverview rules={rules} progress={data?.progress} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
          <RuleDetails rules={rules} progress={data?.progress} />

           <div className="space-y-5">
              <ProgressCard progress={data?.progress} nextUnlock={nextUnlock} />
              <GrowthRoadmap rules={rules} progress={data?.progress} nextUnlock={nextUnlock} />
              <TodayGrowthTasks isAuthenticated={isAuthenticated} checkinStatus={checkinStatus} isLoading={checkinLoading} isError={checkinError} />
              <ActionAdvice rules={rules} progress={data?.progress} />
              <section aria-labelledby="activity-entry-title" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 id="activity-entry-title" className="text-lg font-black">去完成可获得经验的操作</h2>
                <div className="mt-4 space-y-3">
                  <ActivityLink to="/dashboard" label="签到" description="进入个人中心领取今日签到奖励" icon={<CalendarCheck2 className="h-4 w-4" />} />
                  <ActivityLink to="/servers" label="找服" description="浏览公开服务器，进入详情页互动" icon={<Compass className="h-4 w-4" />} />
                  <ActivityLink to="/servers" label="评论" description="先选择服务器，再进入详情页发表评论" icon={<MessageSquare className="h-4 w-4" />} />
                </div>
              </section>
            </div>
        </div>

        <div className="mt-5">
          <RuleGuide />
        </div>

        <footer className="mt-10 flex items-center gap-2 text-xs text-zinc-500">
          <Server className="h-4 w-4" /> 服务器目录和互动入口均使用站内真实页面。
        </footer>
      </div>
    </main>
  );
};

export default LevelRules;
