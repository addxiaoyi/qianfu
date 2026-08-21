import React from 'react';
import { useAuthStore } from '@/store/authStore';
import type { CheckinResult, CheckinStatus } from '@/types/api';
import { CheckCircle2, ChevronRight, Loader2, LockKeyhole, LogIn } from 'lucide-react';
import { Link, Navigate, useLocation, Routes, Route } from 'react-router-dom';
import CommercialFeatureDisabled from './CommercialFeatureDisabled';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MyServers from './MyServers';
import Profile from './Profile';
import TicketList from './TicketList';
import TicketCreate from './TicketCreate';
import TicketDetail from './TicketDetail';
import { motion } from 'framer-motion';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { toast } from '@/hooks/use-toast';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { LoadingFallback } from '@/auth/guards';
// Player skin/head showcase intentionally removed from the account center.
import { useT, type TranslationKey } from '@/store/uiStore';
import { api } from '@/api/request';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
import { formatUserId, normalizeUser } from '@/utils/user';
import type { User } from '@/types/api';

type DashboardMenuItem = { nameKey: TranslationKey; path: string; variant: any };
type SuperAdminControlItem = {
  label: string;
  hint: string;
  path: string;
  variant: any;
  badge: string;
  matches?: string[];
};
type SuperAdminControlGroup = {
  title: string;
  hint: string;
  items: SuperAdminControlItem[];
};
type ActivityItem = {
  type: string;
  desc: string;
  time: string;
  variant: 'spark' | 'network' | 'settings' | 'activity';
};
type DashboardShortcut = {
  label: string;
  hint: string;
  to?: string;
  onClick?: () => void;
  variant: 'spark' | 'network' | 'settings' | 'activity' | 'security';
  badge: string;
  disabled?: boolean;
};

const formatActivityTime = (value?: string | null) => {
  if (!value) return '时间未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString();
};

const DASHBOARD_MENU: DashboardMenuItem[] = [
  { nameKey: 'dash.menu.overview', path: '/dashboard', variant: 'spark' },
  { nameKey: 'dash.menu.servers', path: '/dashboard/servers', variant: 'network' },
  { nameKey: 'dash.menu.tickets', path: '/dashboard/tickets', variant: 'activity' },
  { nameKey: 'dash.menu.profile', path: '/dashboard/profile', variant: 'settings' },
];

const SUPER_ADMIN_CONTROL_GROUPS: SuperAdminControlGroup[] = [
  {
    title: '系统配置',
    hint: '核心站点参数、邮件与网络安全',
    items: [
      { label: '控制总览', hint: '回到超管主控台', path: '/admin', variant: 'spark', badge: 'CORE' },
      { label: '系统设置', hint: '站点参数、费率与维护模式', path: '/admin-settings', variant: 'settings', badge: 'CFG' },
      { label: '邮件配置', hint: '邮箱验证码、重置密码与通知发信', path: '/admin-mail', variant: 'data', badge: 'MAIL' },
      { label: '端口安全', hint: '网络策略与高危端口治理', path: '/admin-port5555', variant: 'network', badge: 'NET' },
    ],
  },
  {
    title: '运营处理',
    hint: '用户、审核、工单与内容流转',
    items: [
      { label: '用户管理', hint: '权限与账户目录', path: '/admin-users', variant: 'user', badge: 'AUTH' },
      { label: '服务器审核', hint: '上架节点审核流', path: '/admin-review', variant: 'security', badge: 'NODE' },
      { label: '工单管理', hint: '支持与人工处理台', path: '/admin-tickets', variant: 'activity', badge: 'HELP' },
      { label: '内容审核', hint: '站内内容与风控过滤', path: '/admin-moderation', variant: 'security', badge: 'SAFE' },
    ],
  },
  {
    title: '审计与风控',
    hint: '审计日志、指标洞察与举报处置',
    items: [
      { label: '审计日志', hint: '关键动作账本', path: '/admin-audit', variant: 'terminal', badge: 'LOG' },
      { label: '数据统计', hint: '超管指标与运行面板', path: '/admin-audit-stats', variant: 'data', badge: 'STAT' },
      { label: '举报管理', hint: '风险裁决与举报流转', path: '/admin-reports', variant: 'alert', badge: 'RISK' },
    ],
  },
];

const Dashboard: React.FC = () => {
  const t = useT();
  const { user, logout, setUser, isLoading: authLoading } = useAuthStore();
  const isGuest = !user;
  const location = useLocation();
  const queryClient = useQueryClient();
  const isLocked = !!(user && !user.email_verified);
  const isSuperAdmin = user?.role === 'admin';

  const { data: checkinStatus, isFetching: checkinStatusLoading, isError: checkinStatusError, refetch: refetchCheckinStatus } = useQuery({
    queryKey: ['checkin-status', user?.id],
    queryFn: () => api.get<CheckinStatus>(isRustV2Enabled() ? rustV2Path('/user/checkin/status') : '/user/checkin/status', undefined, isRustV2Enabled() ? rustV2RequestOptions : undefined),
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });
  const { data: serverQuota, isError: serverQuotaError, refetch: refetchServerQuota } = useQuery({
    queryKey: ['my-server-info', 'dashboard'],
    queryFn: () =>
      api.get<{
        current_cards: number;
        max_cards: number;
        can_publish: boolean;
      }>('/servers/me'),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });
  const { data: ticketSummaryResponse, isError: ticketSummaryError, refetch: refetchTicketSummary } = useQuery({
    queryKey: ['tickets', 'dashboard-summary'],
    queryFn: () => api.get<any[]>('/tickets', { limit: 50 }),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });
  const [checkingIn, setCheckingIn] = React.useState(false);
  const summaryUnavailable = !!user && (checkinStatusError || serverQuotaError || ticketSummaryError);
  const retrySummary = () => {
    void Promise.all([refetchCheckinStatus(), refetchServerQuota(), refetchTicketSummary()]);
  };

  const handleCheckIn = async () => {
     if (!user) {
       toast({ title: '登录后可签到', description: '访客模式仅支持浏览个人中心。' });
       return;
     }
     if (checkingIn || checkinStatus?.checkedInToday) return;
     setCheckingIn(true);
     try {
      const result = await api.post<CheckinResult>(isRustV2Enabled() ? rustV2Path('/user/checkin') : '/user/checkin', {}, isRustV2Enabled() ? rustV2RequestOptions : undefined);
        if (result.ok === false || result.alreadyCheckedIn) {
          await queryClient.invalidateQueries({ queryKey: ['checkin-status'] });
          toast({ title: '今日已签到', description: '今日经验已经领取，不会重复增加。' });
          return;
        }
       setUser(normalizeUser({
         ...(user || {}),
         experience_points: result.totalXp ?? user?.experience_points ?? 0,
         level: result.level ?? user?.level ?? 1,
         xp_into_level: result.xp_into_level,
         xp_for_next_level: result.xp_for_next_level,
         level_progress: result.level_progress,
         last_checkin_at: result.checkinAt,
       } as User));
       await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['profile'] }),
          queryClient.invalidateQueries({ queryKey: ['checkin-status'] }),
        ]);
        toast({ title: t('auth.status.granted'), description: `获得 ${result.gainedXp ?? 0} XP` });
     } catch {
       toast({ title: t('common.error'), description: '签到失败，请稍后再试', variant: 'destructive' });
     } finally {
       setCheckingIn(false);
     }
  };

  const xp = user?.experience_points || 0;
  const rawProgress = user?.level_progress ?? 0;
  const progress = Math.min(100, Math.max(0, Math.round(rawProgress <= 1 ? rawProgress * 100 : rawProgress)));
  const xpIntoLevel = user?.xp_into_level ?? 0;
  const xpForNextLevel = user?.xp_for_next_level ?? 100;
  const remainingXp = Math.max(0, xpForNextLevel - xpIntoLevel);
  const checkinDisabled = isGuest || checkingIn || checkinStatusLoading || !!checkinStatus?.checkedInToday;
  const ticketSummary = Array.isArray(ticketSummaryResponse) ? ticketSummaryResponse : [];
  const openTicketCount = ticketSummary.filter((ticket) => !['CLOSED', 'RESOLVED'].includes(String(ticket.status || '').toUpperCase())).length;
  const currentCards = serverQuota?.current_cards ?? 0;
  const maxCards = serverQuota?.max_cards ?? 0;
  const remainingCards = Math.max(0, maxCards - currentCards);
  const latestCheckinAt = user?.last_checkin_at || checkinStatus?.recentCheckinDates?.[0];
  const activityItems: ActivityItem[] = [
    ...(latestCheckinAt ? [{
      type: '签到',
      desc: checkinStatus?.checkedInToday ? '今日签到已完成，等级经验已同步。' : '最近一次签到记录',
      time: formatActivityTime(latestCheckinAt),
      variant: 'spark' as const,
    }] : []),
    ...(user ? [{
      type: '账号',
      desc: user.email_verified ? '邮箱已验证，账号功能可正常使用。' : '邮箱待验证，请先完成验证码确认。',
      time: user.joinDate ? formatActivityTime(user.joinDate) : '当前状态',
      variant: 'settings' as const,
    }] : []),
  ].slice(0, 5);
  const sidebarShortcuts: DashboardShortcut[] = [
    {
      label: isGuest ? '登录后签到' : checkinStatus?.checkedInToday ? '今日已签到' : '立即签到',
      hint: isGuest
        ? '登录后领取每日 XP'
        : checkinStatus?.checkedInToday
          ? `连续 ${checkinStatus.streakDays} 天`
           : `领取 ${checkinStatus?.rewardXp ?? 0} XP`,
      onClick: checkinStatus?.checkedInToday ? undefined : handleCheckIn,
      variant: 'spark',
      badge: isGuest ? 'LOGIN' : checkinStatus?.checkedInToday ? 'DONE' : 'XP',
      disabled: checkinDisabled,
    },
    {
      label: serverQuota?.can_publish === false ? '查看服务器位' : '发布新服务器',
      hint: maxCards > 0 ? `${currentCards}/${maxCards} 已使用` : '拉取节点配额中',
      to: '/editor',
      variant: 'network',
      badge: remainingCards > 0 ? `${remainingCards}` : 'FULL',
      disabled: isGuest || serverQuota?.can_publish === false,
    },
    {
      label: openTicketCount > 0 ? '处理工单' : '提交工单',
      hint: openTicketCount > 0 ? `${openTicketCount} 条未结工单` : '当前支持队列为空',
      to: openTicketCount > 0 ? '/dashboard/tickets' : '/dashboard/tickets/new',
      variant: 'activity',
      badge: isGuest ? 'LOCK' : openTicketCount > 0 ? `${openTicketCount}` : 'NEW',
      disabled: isGuest,
    },
  ];
  const matchesPath = React.useCallback(
    (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname],
  );
  const activeMenuPath = React.useMemo(() => {
    const matched = DASHBOARD_MENU
      .filter((item) => item.path === '/dashboard'
        ? location.pathname === '/dashboard'
        : matchesPath(item.path))
      .sort((left, right) => right.path.length - left.path.length);
    return matched[0]?.path ?? '/dashboard';
  }, [location.pathname, matchesPath]);
  const isPathActive = (path: string) => activeMenuPath === path;
  const isProfileRoute = matchesPath('/dashboard/profile');
  const isSuperAdminPathActive = (item: SuperAdminControlItem) =>
    [item.path, ...(item.matches || [])].some((path) => matchesPath(path));
  const protectDashboardRoute = (page: React.ReactNode) =>
    authLoading ? <LoadingFallback /> : isGuest ? <Navigate to="/dashboard" replace /> : page;

  return (
    <StatusWrapper isLocked={isLocked}>
      <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-7xl flex-col gap-5 bg-zinc-50/40 px-4 py-6 sm:px-6 md:flex-row lg:gap-6 lg:py-8">
        {/* Sidebar */}
        <aside className="w-full shrink-0 self-start space-y-3 md:w-64 xl:w-72">
          {!isProfileRoute ? (
            <>
              <div className="ui-panel p-4 sm:p-5">
                 <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-black font-mono text-lg font-semibold text-white">
                       {user?.username?.[0] || '访'}
                    </div>
                    <div className="min-w-0 space-y-1">
                       <div className="font-semibold truncate text-sm text-zinc-900">{user?.username || '访客预览'}</div>
                       <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-[0.24em]">ID: {user ? formatUserId(user.id) : '未登录'}</div>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 gap-2 mt-4">
                   <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-3 py-2">
                     <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">等级</div>
                     <div className="mt-1 text-sm font-semibold text-zinc-900">{user ? `Lv.${user.level || 1}` : '--'}</div>
                   </div>
                 </div>
              </div>

              {isSuperAdmin ? (
                <Link
                  to="/admin"
                  data-admin-entry="dashboard"
                  className="group flex items-center gap-3 rounded-[1.25rem] border border-black bg-black px-3 py-3 text-white transition hover:bg-zinc-800"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <GeometricLantern variant="settings" className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black tracking-tight">管理后台</div>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-white/65">进入管理员总览与全部管理工具</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : null}
            </>
          ) : null}

          <div className="ui-panel p-2">
            <div className="flex flex-wrap gap-1.5 md:flex-col">
               {DASHBOARD_MENU.map((item) => {
                  const active = isPathActive(item.path);
                  const guestLocked = isGuest && item.path !== '/dashboard';
                  const className = `flex min-w-[calc(50%-0.1875rem)] flex-1 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[clamp(0.72rem,0.8vw,0.8rem)] font-semibold uppercase tracking-[0.1em] transition-all md:min-w-0 md:flex-none md:px-4 ${
                    active
                      ? 'bg-black text-white shadow-lg'
                      : guestLocked
                        ? 'cursor-not-allowed bg-zinc-50 text-zinc-300'
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                  }`;

                  const content = (
                    <>
                      <GeometricLantern variant={item.variant} className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate">{t(item.nameKey)}</span>
                      {guestLocked ? <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> : null}
                    </>
                  );

                  return guestLocked ? (
                    <div key={item.path} className={className} aria-disabled="true" title="登录后可用">
                      {content}
                    </div>
                  ) : (
                    <Link key={item.path} to={item.path} className={className} aria-current={active ? 'page' : undefined}>
                      {content}
                    </Link>
                  );
               })}
            </div>
          </div>

          <div className="ui-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">快捷概览</div>
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-300">实时</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: '服务器位', value: serverQuotaError ? '—' : maxCards > 0 ? `${currentCards}/${maxCards}` : '—', hint: serverQuotaError ? '读取失败' : remainingCards > 0 ? `余 ${remainingCards}` : '待配额', variant: 'network' as const },
                { label: '未结工单', value: ticketSummaryError ? '—' : String(openTicketCount), hint: ticketSummaryError ? '读取失败' : openTicketCount > 0 ? '待处理' : '清空', variant: 'activity' as const },
                { label: '连签', value: checkinStatusError ? '—' : String(checkinStatus?.streakDays ?? 0), hint: checkinStatusError ? '读取失败' : checkinStatus?.checkedInToday ? '已签' : '可签', variant: 'spark' as const },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.08em] text-zinc-400 leading-none">{item.label}</div>
                    <GeometricLantern variant={item.variant} className="w-3.5 h-3.5 text-zinc-300" />
                  </div>
                  <div className="mt-2 text-base font-black text-zinc-900">{item.value}</div>
                  <div className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-400 leading-none">{item.hint}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 px-3 py-3">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">账号状态</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {isGuest ? '访客只读模式，登录后可操作。' : user.email_verified ? '邮箱已验证，可正常操作。' : '邮箱待验证，部分能力受限。'}
              </div>
            </div>
          </div>

          <div className="ui-panel p-3">
            <div className="px-1 pb-2">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">快捷操作</div>
              <p className="mt-2 text-[11px] font-bold leading-5 text-zinc-500">把高频动作收在一起，减少来回跳转。</p>
            </div>
            <div className="space-y-2">
              {sidebarShortcuts.map((item) => {
                const content = (
                  <>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all ${
                      item.disabled
                        ? 'border-zinc-100 bg-zinc-50 text-zinc-300'
                        : 'border-zinc-100 bg-zinc-50 text-zinc-400 group-hover:border-zinc-200 group-hover:bg-white group-hover:text-accent'
                    }`}>
                      <GeometricLantern variant={item.variant} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-[clamp(0.82rem,0.92vw,0.92rem)] font-black tracking-tight">{item.label}</span>
                        <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.24em] text-zinc-300">
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[clamp(0.72rem,0.82vw,0.82rem)] font-bold leading-5 text-zinc-400">{item.hint}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 group-hover:translate-x-0.5 group-hover:text-zinc-500 transition-transform" />
                  </>
                );

                if (item.to) {
                  return item.disabled ? (
                    <div key={item.label} className="group flex items-center gap-3 rounded-[1.25rem] border border-zinc-100 bg-zinc-50/60 px-3 py-3 opacity-60">
                      {content}
                    </div>
                  ) : (
                    <Link key={item.label} to={item.to} className="group flex items-center gap-3 rounded-[1.25rem] border border-transparent bg-white px-3 py-3 text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 transition-all">
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className="group flex w-full items-center gap-3 rounded-[1.25rem] border border-transparent bg-white px-3 py-3 text-left text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 transition-all disabled:opacity-60 disabled:hover:border-transparent disabled:hover:bg-white disabled:hover:text-zinc-600"
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="ui-panel p-3">
              <div className="px-2 pb-3 pt-1">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">超管配置入口</div>
                <p className="mt-2 text-xs font-bold leading-5 text-zinc-500">
                  超管可配置入口统一收口在这里，直接跳到对应控制面板，不再分散在多个页面里找。
                </p>
              </div>

              <div className="space-y-3">
                {SUPER_ADMIN_CONTROL_GROUPS.map((group) => (
                  <section key={group.title} className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">{group.title}</div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-300">{group.items.length} Items</div>
                    </div>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-zinc-400">{group.hint}</p>

                    <div className="mt-3 space-y-2">
                      {group.items.map((item) => {
                        const active = isSuperAdminPathActive(item);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            className={`group flex items-center gap-3 rounded-[1.25rem] border px-3 py-3 transition-all ${
                              active
                                ? 'border-black bg-black text-white shadow-lg'
                                : 'border-transparent bg-white text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900'
                            }`}
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all ${
                              active
                                ? 'border-white/10 bg-white/10 text-white'
                                : 'border-zinc-100 bg-zinc-50 text-zinc-400 group-hover:border-zinc-200 group-hover:bg-white group-hover:text-accent'
                            }`}>
                              <GeometricLantern variant={item.variant} className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-[clamp(0.78rem,0.88vw,0.88rem)] font-black tracking-tight">{item.label}</span>
                                <span className={`shrink-0 text-[8px] font-black uppercase tracking-[0.24em] ${
                                  active ? 'text-white/50' : 'text-zinc-300'
                                }`}>
                                  {item.badge}
                                </span>
                              </div>
                              <p className={`mt-1 text-[clamp(0.72rem,0.8vw,0.8rem)] font-bold leading-5 ${
                                active ? 'text-white/70' : 'text-zinc-400'
                              }`}>
                                {item.hint}
                              </p>
                            </div>

                            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${
                              active ? 'text-white/50' : 'text-zinc-300 group-hover:translate-x-0.5 group-hover:text-zinc-500'
                            }`} />
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {isGuest ? (
            <Link
              to="/login"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-lg transition hover:bg-zinc-800"
            >
              <LogIn className="h-4 w-4" />
              登录后使用
            </Link>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <GeometricLantern variant="alert" className="h-4 w-4" />
              {t('dash.logout')}
            </button>
          )}
        </aside>

        {/* Main Content */}
        <motion.div 
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="ui-panel min-w-0 flex-grow p-4 sm:p-5 lg:p-6"
        >
          {isGuest ? (
            <div className="mb-6 flex flex-col gap-4 rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-zinc-500 shadow-sm">
                  <LockKeyhole className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-black text-zinc-900">访客只读预览</div>
                  <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">可以浏览个人中心结构；签到、发布、工单和账号设置均不会发起请求。</p>
                </div>
              </div>
              <Link to="/login" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-xs font-black text-white transition hover:bg-zinc-800">
                <LogIn className="h-4 w-4" />
                登录
              </Link>
            </div>
          ) : summaryUnavailable ? (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
              部分控制台摘要暂时无法读取，失败的数据不会作为 0 展示。
              <button type="button" onClick={retrySummary} className="ml-3 underline underline-offset-4">重新加载摘要</button>
            </div>
          ) : null}
          <Routes>
            <Route index element={
               <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              <div className="grid grid-cols-1 gap-4 lg:gap-6">
                     {/* XP Progress Card */}
                     <div>
                        <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-white via-white to-zinc-50 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.06)] sm:p-7">
                           <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-zinc-100/70 blur-3xl" />
                           <header className="relative flex items-center justify-between gap-3">
                              <div>
                                 <h2 className="text-[10px] font-black uppercase tracking-[0.36em] text-zinc-400">{t('dash.level_progress')}</h2>
                                 <p className="mt-2 text-xs font-medium text-zinc-500">{isGuest ? '登录后同步等级、经验和签到奖励' : '持续签到，解锁下一等级权益'}</p>
                              </div>
                              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500 shadow-sm">
                                {user ? `LV.${user.level || 1}` : 'LV.--'}
                              </span>
                           </header>

                           <div className="relative mt-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5">
                              <div>
                                 <div className="flex items-end gap-2">
                                    <span className="font-mono text-5xl font-black tracking-[-0.08em] text-zinc-950 sm:text-6xl">{isGuest ? '--' : xp}</span>
                                    <span className="pb-1.5 text-base font-black italic text-zinc-400">XP</span>
                                 </div>
                                 <p className="mt-3 text-xs font-bold text-zinc-500 sm:text-sm">
                                   {isGuest ? '登录后查看等级进度' : t('dash.xp.remaining').replace('{xp}', String(remainingXp))}
                                 </p>
                              </div>

                              <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
                                 <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden="true">
                                    <circle cx="56" cy="56" r="45" fill="none" stroke="currentColor" strokeWidth="9" className="text-zinc-100" />
                                    <circle
                                      cx="56"
                                      cy="56"
                                      r="45"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="9"
                                      strokeLinecap="round"
                                      strokeDasharray={282.74}
                                      strokeDashoffset={282.74 - (282.74 * (isGuest ? 0 : progress)) / 100}
                                      className="text-zinc-950 transition-all duration-1000"
                                    />
                                 </svg>
                                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="font-mono text-lg font-black text-zinc-950">{isGuest ? '--' : `${progress}%`}</span>
                                    <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-zinc-400">Progress</span>
                                 </div>
                              </div>
                           </div>

                           <div className="relative mt-7">
                              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                 <span>本级进度</span>
                                 <span>{isGuest ? '登录后同步' : `${xpIntoLevel} / ${xpForNextLevel} XP`}</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                                 <motion.div
                                   initial={{ width: 0 }}
                                   animate={{ width: `${isGuest ? 0 : progress}%` }}
                                   className="h-full rounded-full bg-zinc-950"
                                 />
                              </div>
                           </div>

                           <button
                             type="button"
                             onClick={handleCheckIn}
                             disabled={checkinDisabled}
                             className={`relative mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black transition ${
                               isGuest
                                 ? 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500'
                                 : checkinStatus?.checkedInToday
                                   ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700'
                                   : 'bg-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.16)] hover:bg-zinc-800 active:scale-[0.995]'
                             }`}
                           >
                              {checkingIn || checkinStatusLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isGuest ? (
                                <LockKeyhole className="h-4 w-4" />
                              ) : checkinStatus?.checkedInToday ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <GeometricLantern variant="spark" className="h-4 w-4" />
                              )}
                              {isGuest
                                ? '登录后签到'
                                : checkinStatus?.checkedInToday
                                  ? `今日已签到 · 已获得 +${checkinStatus.rewardXp} XP`
                                  : `立即签到 · +${checkinStatus?.rewardXp ?? 0} XP`}
                           </button>
                        </section>
                     </div>

                  </div>

                  {/* Quick Access Section */}
                  <div className="space-y-4 sm:space-y-5">
                     <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.services_shortcuts')}</h2>
                     <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                        {[
                           { nameKey: 'dash.shortcuts.publish', sub: '发布服务器', variant: 'network' as const, link: '/editor' },
                           { nameKey: 'dash.shortcuts.ticket', sub: '提交工单', variant: 'activity' as const, link: '/dashboard/tickets/new' },
                           { nameKey: 'dash.menu.profile', sub: '账号设置', variant: 'settings' as const, link: '/dashboard/profile' },
                        ].map((item) => {
                           const content = (
                             <>
                               <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-colors sm:h-11 sm:w-11 ${
                                 isGuest ? 'bg-zinc-100 text-zinc-300' : 'bg-muted group-hover:bg-accent group-hover:text-white'
                               }`}>
                                  {isGuest ? <LockKeyhole className="h-5 w-5" /> : <GeometricLantern variant={item.variant} className="h-5 w-5" />}
                               </div>
                               <div className="text-sm font-black uppercase tracking-tight">{t(item.nameKey as unknown)}</div>
                               <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{isGuest ? '登录后可用' : item.sub}</div>
                             </>
                           );

                           return isGuest ? (
                             <div key={item.nameKey} className="cursor-not-allowed rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-zinc-400 sm:p-5" aria-disabled="true">
                               {content}
                             </div>
                           ) : (
                             <Link key={item.nameKey} to={item.link} className="group rounded-2xl border border-border bg-white p-4 transition-all hover:border-accent sm:p-5">
                               {content}
                             </Link>
                           );
                        })}
                     </div>
                  </div>

                   {/* Activity Feed Section */}
                   <div className="space-y-6">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.activity.title')}</h2>
                      <div className="space-y-3 sm:space-y-4">
                         {activityItems.length === 0 ? (
                            <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-white p-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                               <div className="text-sm font-bold text-zinc-500">{isGuest ? '访客模式不展示账户活动' : '暂无真实活动记录'}</div>
                               <p className="mt-2 text-xs font-medium text-zinc-400">{isGuest ? '登录后可查看签到和账号操作记录。' : '完成签到或账号验证后，这里会显示真实操作记录。'}</p>
                            </div>
                         ) : activityItems.map((log, i) => (
                            <div key={i} className="rounded-[1.5rem] border border-zinc-100 bg-white p-4 sm:p-5 flex items-start justify-between gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                               <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                                  <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                                     <GeometricLantern variant={log.variant} className="w-4 h-4 text-zinc-500" />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                     <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">{log.type}</div>
                                     <div className="text-sm font-medium text-zinc-900 leading-6">{log.desc}</div>
                                  </div>
                               </div>
                               <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase italic whitespace-nowrap">{log.time}</span>
                            </div>
                         ))}
                      </div>
                   </div>
               </div>
            } />
            <Route path="servers" element={protectDashboardRoute(<MyServers />)} />
            <Route path="tickets" element={protectDashboardRoute(<TicketList />)} />
            <Route path="tickets/new" element={protectDashboardRoute(<TicketCreate />)} />
            <Route path="tickets/:id" element={protectDashboardRoute(<TicketDetail />)} />
            <Route path="profile" element={protectDashboardRoute(<Profile />)} />
            <Route path="billing/*" element={<CommercialFeatureDisabled />} />
          </Routes>
        </motion.div>
      </div>
    </StatusWrapper>
  );
};

export default Dashboard;
