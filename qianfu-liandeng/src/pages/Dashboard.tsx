import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Link, useLocation, Routes, Route } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MyServers from './MyServers';
import Profile from './Profile';
import TicketList from './TicketList';
import TicketCreate from './TicketCreate';
import TicketDetail from './TicketDetail';
import Billing from './Billing';
import { motion } from 'framer-motion';
import StatusWrapper from '@/components/StatusWrapper';
import { toast } from '@/hooks/use-toast';
import GeometricLantern from '@/components/icons/GeometricLantern';
import ThreeDHeadShowcase from '@/components/ThreeDHeadShowcase';
import { useT, type TranslationKey } from '@/store/uiStore';
import { api } from '@/api/request';
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
  variant: 'spark' | 'network' | 'settings' | 'payment' | 'activity';
};
type DashboardShortcut = {
  label: string;
  hint: string;
  to?: string;
  onClick?: () => void;
  variant: 'spark' | 'network' | 'settings' | 'payment' | 'activity' | 'security';
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
  { nameKey: 'dash.menu.billing', path: '/dashboard/billing', variant: 'payment' },
  { nameKey: 'dash.menu.profile', path: '/dashboard/profile', variant: 'settings' },
];

const SUPER_ADMIN_CONTROL_GROUPS: SuperAdminControlGroup[] = [
  {
    title: '系统配置',
    hint: '核心站点参数、支付矩阵与网络安全',
    items: [
      { label: '控制总览', hint: '回到超管主控台', path: '/admin', variant: 'spark', badge: 'CORE' },
      { label: '系统设置', hint: '站点参数、费率与维护模式', path: '/admin-settings', variant: 'settings', badge: 'CFG' },
      { label: '邮件配置', hint: '邮箱验证码、重置密码与通知发信', path: '/admin-mail', variant: 'data', badge: 'MAIL' },
      { label: '支付配置', hint: 'Creem / QiuPay / XPay / TPay', path: '/admin-qianfu', variant: 'payment', badge: 'PAY' },
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
    title: '增长与业务',
    hint: '推广任务、领取审核与商家配置',
    items: [
      { label: '激励任务', hint: '推广任务创建与规则配置', path: '/promotion/tasks', variant: 'spark', badge: 'GROW' },
      { label: '领取审核', hint: '奖励领取审核面板', path: '/promotion/claims', variant: 'activity', badge: 'CLAIM' },
      { label: '店铺管理', hint: '商家资料与前台店铺配置', path: '/seller/shop', variant: 'data', badge: 'SHOP', matches: ['/seller/marketplace', '/marketplace/manage'] },
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
  const { user, logout, setUser } = useAuthStore();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isLocked = !!(user && !user.email_verified);
  const isSuperAdmin = user?.role === 'admin';

  const { data: checkinStatus, isFetching: checkinStatusLoading } = useQuery({
    queryKey: ['checkin-status'],
    queryFn: () => api.get<{
      checkedInToday: boolean;
      streakDays: number;
      rewardXp: number;
      recentCheckinDates: string[];
    }>('/user/checkin/status'),
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });
  const { data: walletTransactionsResponse } = useQuery({
    queryKey: ['wallet-transactions', 'dashboard'],
    queryFn: () => api.get<any[]>('/wallet/transactions', { limit: 3 }),
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });
  const { data: serverQuota } = useQuery({
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
  const { data: ticketSummaryResponse } = useQuery({
    queryKey: ['tickets', 'dashboard-summary'],
    queryFn: () => api.get<any[]>('/tickets', { limit: 50 }),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });
  const [checkingIn, setCheckingIn] = React.useState(false);

  const handleCheckIn = async () => {
     if (checkingIn || checkinStatus?.checkedInToday) return;
     setCheckingIn(true);
     try {
       const result = await api.post<any>('/user/checkin');
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
       toast({ title: t('auth.status.granted'), description: t('dash.checkin.xp_reward') });
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
  const checkinDisabled = checkingIn || checkinStatusLoading || !!checkinStatus?.checkedInToday;
  const walletTransactions = Array.isArray(walletTransactionsResponse) ? walletTransactionsResponse : [];
  const ticketSummary = Array.isArray(ticketSummaryResponse) ? ticketSummaryResponse : [];
  const openTicketCount = ticketSummary.filter((ticket) => !['CLOSED', 'RESOLVED'].includes(String(ticket.status || '').toUpperCase())).length;
  const currentCards = serverQuota?.current_cards ?? 0;
  const maxCards = serverQuota?.max_cards ?? 0;
  const remainingCards = Math.max(0, maxCards - currentCards);
  const latestWalletTx = walletTransactions[0];
  const latestCheckinAt = user?.last_checkin_at || checkinStatus?.recentCheckinDates?.[0];
  const activityItems: ActivityItem[] = [
    ...(latestCheckinAt ? [{
      type: '签到',
      desc: checkinStatus?.checkedInToday ? '今日签到已完成，等级经验已同步。' : '最近一次签到记录',
      time: formatActivityTime(latestCheckinAt),
      variant: 'spark' as const,
    }] : []),
    ...walletTransactions.map((tx) => ({
      type: tx.type || '账单',
      desc: tx.description || `钱包流水 ${Number(tx.amount || 0) >= 0 ? '入账' : '支出'} ¥${Math.abs(Number(tx.amount || 0)).toFixed(2)}`,
      time: formatActivityTime(tx.created_at || tx.createdAt),
      variant: 'payment' as const,
    })),
    ...(user ? [{
      type: '账号',
      desc: user.email_verified ? '邮箱已验证，账号功能可正常使用。' : '邮箱待验证，请先完成验证码确认。',
      time: user.joinDate ? formatActivityTime(user.joinDate) : '当前状态',
      variant: 'settings' as const,
    }] : []),
  ].slice(0, 5);
  const sidebarShortcuts: DashboardShortcut[] = [
    {
      label: checkinStatus?.checkedInToday ? '今日已签到' : '立即签到',
      hint: checkinStatus?.checkedInToday ? `连续 ${checkinStatus.streakDays} 天` : `领取 ${checkinStatus?.rewardXp ?? 25} XP`,
      onClick: checkinStatus?.checkedInToday ? undefined : handleCheckIn,
      variant: 'spark',
      badge: checkinStatus?.checkedInToday ? 'DONE' : 'XP',
      disabled: checkinDisabled,
    },
    {
      label: serverQuota?.can_publish === false ? '查看服务器位' : '发布新服务器',
      hint: maxCards > 0 ? `${currentCards}/${maxCards} 已使用` : '拉取节点配额中',
      to: '/editor',
      variant: 'network',
      badge: remainingCards > 0 ? `${remainingCards}` : 'FULL',
      disabled: serverQuota?.can_publish === false,
    },
    {
      label: openTicketCount > 0 ? '处理工单' : '提交工单',
      hint: openTicketCount > 0 ? `${openTicketCount} 条未结工单` : '当前支持队列为空',
      to: openTicketCount > 0 ? '/dashboard/tickets' : '/dashboard/tickets/new',
      variant: 'activity',
      badge: openTicketCount > 0 ? `${openTicketCount}` : 'NEW',
    },
    {
      label: latestWalletTx ? '查看最近账单' : '进入账单中心',
      hint: latestWalletTx ? String(latestWalletTx.description || latestWalletTx.type || '最近流水') : '钱包流水与余额变动',
      to: '/dashboard/billing',
      variant: 'payment',
      badge: latestWalletTx ? 'LEDGER' : 'WALLET',
    },
  ];
  const isPathActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isProfileRoute = isPathActive('/dashboard/profile');
  const isSuperAdminPathActive = (item: SuperAdminControlItem) =>
    [item.path, ...(item.matches || [])].some((path) => isPathActive(path));

  return (
    <StatusWrapper isLocked={isLocked}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col md:flex-row gap-6 lg:gap-10 min-h-[calc(100vh-200px)] bg-white">
        {/* Sidebar */}
        <aside className="w-full md:w-72 shrink-0 space-y-3 sm:space-y-4 md:sticky md:top-24 md:self-start md:max-h-[calc(100svh-7rem)] md:overflow-y-auto md:pr-2">
          {!isProfileRoute ? (
            <>
              <div className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center font-mono text-xl font-black shadow-lg shrink-0">
                       {user?.username?.[0]}
                    </div>
                    <div className="min-w-0 space-y-1">
                       <div className="font-semibold truncate text-sm text-zinc-900">{user?.username}</div>
                       <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-[0.24em]">ID: {formatUserId(user?.id)}</div>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-2 mt-4">
                   <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-3 py-2">
                     <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">等级</div>
                     <div className="mt-1 text-sm font-semibold text-zinc-900">Lv.{user?.level || 1}</div>
                   </div>
                   <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-3 py-2">
                     <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">余额</div>
                     <div className="mt-1 text-sm font-semibold text-zinc-900">¥ {user?.balance || '0.00'}</div>
                   </div>
                 </div>
              </div>

              <ThreeDHeadShowcase username={user?.username} />
            </>
          ) : null}

          <div className="rounded-[1.75rem] border border-zinc-100 bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
            <div className="space-y-1 flex flex-row md:flex-col overflow-x-auto md:overflow-visible pb-1 md:pb-0 gap-2 md:gap-1">
               {DASHBOARD_MENU.map(item => {
                  const active = isPathActive(item.path);
                  return (
                    <Link 
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 sm:px-5 py-3 rounded-2xl text-[clamp(0.72rem,0.8vw,0.8rem)] font-semibold uppercase tracking-[0.12em] transition-all whitespace-nowrap ${
                        active ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <GeometricLantern variant={item.variant} className="w-4 h-4" />
                      {t(item.nameKey)}
                    </Link>
                  );
               })}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">快捷概览</div>
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-zinc-300">实时</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: '服务器位', value: maxCards > 0 ? `${currentCards}/${maxCards}` : '—', hint: remainingCards > 0 ? `余 ${remainingCards}` : '待配额', variant: 'network' as const },
                { label: '未结工单', value: String(openTicketCount), hint: openTicketCount > 0 ? '待处理' : '清空', variant: 'activity' as const },
                { label: '连签', value: String(checkinStatus?.streakDays ?? 0), hint: checkinStatus?.checkedInToday ? '已签' : '可签', variant: 'spark' as const },
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
              <div className="mt-1 text-sm font-semibold text-zinc-900">{user?.email_verified ? '邮箱已验证，可正常操作。' : '邮箱待验证，部分能力受限。'}</div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-100 bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
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
            <div className="rounded-[1.75rem] border border-zinc-100 bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
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

          <button type="button" 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-2xl border border-zinc-200 bg-white text-xs font-semibold uppercase tracking-[0.24em] text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <GeometricLantern variant="alert" className="w-4 h-4" />
            {t('dash.logout')}
          </button>
        </aside>

        {/* Main Content */}
        <motion.div 
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-grow min-w-0 rounded-[2rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)]"
        >
          <Routes>
            <Route index element={
               <div className="space-y-6 sm:space-y-8 lg:space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                     {/* XP Progress Card */}
                     <div className="lg:col-span-2 space-y-4 sm:space-y-5">
                        <header className="flex items-center justify-between gap-3">
                           <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.level_progress')}</h2>
                           <span className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 bg-zinc-50 border border-zinc-100 px-3 py-1 rounded-full whitespace-nowrap">Lv.{user?.level || 1}</span>
                        </header>
                        <div className="p-5 sm:p-6 md:p-8 border border-zinc-100 rounded-[2rem] bg-zinc-50/40 space-y-6 sm:space-y-8 shadow-sm">
                           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="space-y-2">
                                 <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tighter break-words">
                                    {xp} <span className="text-base sm:text-lg font-bold text-zinc-400 italic">XP</span>
                                 </div>
                                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('dash.xp.remaining').replace('{xp}', String(remainingXp))}</p>
                              </div>
                              <div className="relative w-20 h-20">
                                 <svg className="w-full h-full -rotate-90">
                                    <circle cx="40" cy="40" r="36" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                                    <circle cx="40" cy="40" r="36" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray={226} strokeDashoffset={226 - (226 * progress) / 100} className="text-accent transition-all duration-1000" />
                                 </svg>
                                 <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono">
                                    {progress}%
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-4">
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                 <motion.div 
                                   initial={{ width: 0 }}
                                   animate={{ width: `${progress}%` }}
                                   className="h-full bg-accent" 
                                 />
                              </div>
                               <button type="button" 
                                 onClick={handleCheckIn}
                                 disabled={checkinDisabled}
                                 className="w-full py-4 btn-accent text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-[0.2em] shadow-xl shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
                               >
                                  {checkingIn || checkinStatusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : checkinStatus?.checkedInToday ? t('dash.checkin.claimed') : (
                                    <>
                                      <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('dash.checkin.now')} +{checkinStatus?.rewardXp ?? 25} XP
                                    </>
                                  )}
                               </button>
                           </div>
                        </div>
                     </div>

                     {/* Wallet Brief */}
                     <div className="space-y-4 sm:space-y-5">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.financial_status')}</h2>
                        <div className="p-5 sm:p-6 lg:p-8 bg-black text-white rounded-[2rem] space-y-6 shadow-lg">
                           <div className="space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-white/55">余额</div>
                              <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tighter break-words">¥ {user?.balance || '0.00'}</div>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                              <Link to="/payment" className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all gap-2">
                                 <GeometricLantern variant="spark" className="w-5 h-5 text-white" />
                                 <span className="text-[9px] font-black uppercase tracking-widest">充值</span>
                              </Link>
                              <Link to="/dashboard/billing" className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all gap-2">
                                 <ChevronRight className="w-5 h-5 text-white" />
                                 <span className="text-[9px] font-black uppercase tracking-widest">{t('dash.financial.billing')}</span>
                              </Link>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Quick Access Section */}
                  <div className="space-y-4 sm:space-y-5">
                     <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.services_shortcuts')}</h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                        {[
                           { nameKey: 'dash.shortcuts.publish', sub: '发布服务器', variant: 'network' as const, link: '/editor' },
                           { nameKey: 'dash.shortcuts.ticket', sub: '提交工单', variant: 'activity' as const, link: '/dashboard/tickets/new' },
                           { nameKey: 'dash.shortcuts.ads', sub: '购买推广', variant: 'payment' as const, link: '/promotion' },
                           { nameKey: 'dash.menu.profile', sub: '账号设置', variant: 'settings' as const, link: '/dashboard/profile' },
                        ].map(item => (
                           <Link 
                             key={item.nameKey}
                             to={item.link}
                             className="p-6 sm:p-8 border border-border rounded-2xl bg-white hover:border-accent transition-all group"
                           >
                              <div className="w-12 h-12 bg-muted rounded-xl mb-4 sm:mb-6 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                                 <GeometricLantern variant={item.variant} className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black uppercase tracking-tight">{t(item.nameKey as any)}</div>
                              <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1">{item.sub}</div>
                           </Link>
                        ))}
                     </div>
                  </div>

                   {/* Activity Feed Section */}
                   <div className="space-y-6">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.activity.title')}</h2>
                      <div className="space-y-3 sm:space-y-4">
                         {activityItems.length === 0 ? (
                            <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-white p-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                               <div className="text-sm font-bold text-zinc-500">暂无真实活动记录</div>
                               <p className="mt-2 text-xs font-medium text-zinc-400">完成签到、充值或账号验证后，这里会显示真实操作流水。</p>
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
            <Route path="servers" element={<MyServers />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/new" element={<TicketCreate />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
            <Route path="billing" element={<Billing />} />
            <Route path="profile" element={<Profile />} />
          </Routes>
        </motion.div>
      </div>
    </StatusWrapper>
  );
};

export default Dashboard;
