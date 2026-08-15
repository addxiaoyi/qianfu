import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { formatUserId, normalizeUser } from '@/utils/user';
import { toArray } from '@/utils/apiData';
import type { CheckinResult, User as ApiUser } from '@/types/api';
import { toast } from '@/hooks/use-toast';
import {
  Award,
  Bell,
  ChevronRight,
  Heart,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Newspaper,
  Server,
  Tags,
  UserPen,
  type LucideIcon,
} from 'lucide-react';

interface MenuItem {
  Icon: LucideIcon;
  label: string;
  path: string;
  hint: string;
}

const serviceItems: MenuItem[] = [
  { Icon: Server, label: '我的服务器', path: '/dashboard/servers', hint: '查看已发布和审核状态' },
  { Icon: MessageCircle, label: '工单记录', path: '/tickets', hint: '跟进支持请求' },
  { Icon: Newspaper, label: '投稿新闻', path: '/me/news-submit', hint: '分享故事并查看审核状态' },
];

const accountItems: MenuItem[] = [
  { Icon: UserPen, label: '编辑资料', path: '/me/edit', hint: '昵称、头像和个人资料' },
  { Icon: Heart, label: '我的收藏', path: '/me/favorites', hint: '快速返回已收藏的服务器' },
  { Icon: Tags, label: '兴趣标签', path: '/me/tags', hint: '管理玩法偏好与个性化标签' },
  { Icon: Bell, label: '通知中心', path: '/me/notifications', hint: '查看站内通知和提醒' },
  { Icon: Mail, label: '邮箱安全', path: '/me/settings', hint: '验证邮箱与账户安全' },
];

const MobileUserCenter: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, setUser, logout } = useAuthStore();
  const isGuest = !user;
  const [checkingIn, setCheckingIn] = React.useState(false);

  const { data: checkinStatus, isFetching: checkinStatusLoading, isError: checkinStatusError, refetch: refetchCheckinStatus } = useQuery({
    queryKey: ['checkin-status', user?.id],
    queryFn: () => api.get<{
      checkedInToday: boolean;
      streakDays: number;
      rewardXp: number;
    }>('/user/checkin/status'),
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: serverInfo, isError: serverInfoError, refetch: refetchServerInfo } = useQuery({
    queryKey: ['my-server-info'],
    queryFn: () => api.get<{ current_cards: number; max_cards: number; can_publish: boolean }>('/servers/me'),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: ticketResponse, isError: ticketError, refetch: refetchTickets } = useQuery({
    queryKey: ['tickets', 'mobile-summary'],
    queryFn: () => api.get<any>('/tickets', { limit: 50 }),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });
  const tickets = toArray<any>(ticketResponse);
  const summaryUnavailable = !!user && (checkinStatusError || serverInfoError || ticketError);

  const retrySummary = () => {
    void Promise.all([refetchCheckinStatus(), refetchServerInfo(), refetchTickets()]);
  };

  const handleCheckIn = async () => {
    if (!user) {
      toast({ title: '登录后可签到', description: '访客模式仅支持浏览个人中心。' });
      return;
    }
    if (checkingIn || checkinStatus?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const result = await api.post<CheckinResult>('/user/checkin');
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
      } as ApiUser));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['checkin-status'] }),
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
      ]);
        toast({ title: '签到成功', description: `获得 ${result.gainedXp ?? 0} XP` });
    } catch {
      toast({ title: '签到失败', description: '请稍后再试', variant: 'destructive' });
    } finally {
      setCheckingIn(false);
    }
  };

  const rawProgress = user?.level_progress ?? 0;
  const progress = Math.min(100, Math.max(0, Math.round(rawProgress <= 1 ? rawProgress * 100 : rawProgress)));
  const openTicketCount = tickets.filter((ticket) => ticket.status !== 'CLOSED').length;
  const menuSections = [
    { title: '我的服务', items: serviceItems },
    { title: '账户设置', items: accountItems },
  ];

  return (
    <div className="bg-white pb-6 text-zinc-900">
      <section className="border-b border-zinc-100 bg-white pb-5 pt-1">
        <div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">ACCOUNT</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">个人中心</h1>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black text-2xl font-black text-white">
            {user?.username?.[0] || user?.email?.[0] || '访'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black">{user?.username || user?.email || '访客预览'}</h2>
            <p className="mt-1 truncate text-xs font-bold text-zinc-500">UID: {user ? formatUserId(user.id) : '未登录'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-zinc-600">{user ? `Lv.${user.level ?? 1}` : 'Lv.--'}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-zinc-600">{isGuest ? '访客只读' : user.email_verified ? '邮箱已验证' : '待验证邮箱'}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="min-h-16 rounded-2xl border border-zinc-100 p-3">
            <p className="text-lg font-black">{isGuest ? '—' : serverInfoError ? '—' : serverInfo?.current_cards ?? 0}</p>
            <p className="text-[10px] font-bold text-zinc-400">服务器</p>
          </div>
          <div className="min-h-16 rounded-2xl border border-zinc-100 p-3">
            <p className="text-lg font-black">{isGuest ? '—' : ticketError ? '—' : openTicketCount}</p>
            <p className="text-[10px] font-bold text-zinc-400">未结工单</p>
          </div>
          <div className="min-h-16 rounded-2xl border border-zinc-100 p-3">
            <p className="text-lg font-black">{isGuest ? '—' : checkinStatusError ? '—' : checkinStatus?.streakDays ?? 0}</p>
            <p className="text-[10px] font-bold text-zinc-400">连续签到</p>
          </div>
        </div>

        {summaryUnavailable ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            <p>部分账户统计暂时无法读取，页面没有用 0 代替失败的数据。</p>
            <button type="button" onClick={retrySummary} className="mt-3 rounded-xl bg-black px-4 py-2 text-xs font-black text-white active:scale-[0.98]">重新加载统计</button>
          </div>
        ) : null}

        <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">LEVEL PROGRESS</p>
              <p className="mt-1 text-sm font-bold">{isGuest ? '登录后同步等级经验' : `总经验 ${user.experience_points ?? 0} XP`}</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-black">{isGuest ? '--' : `${progress}%`}</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-black transition-all" style={{ width: `${isGuest ? 0 : progress}%` }} />
          </div>
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={isGuest || checkingIn || checkinStatusLoading || checkinStatusError || !!checkinStatus?.checkedInToday}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
              isGuest
                ? 'cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-500'
                : checkinStatus?.checkedInToday
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'bg-black text-white'
            }`}
          >
            {checkingIn || checkinStatusLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : isGuest ? (
              <LockKeyhole className="h-4 w-4" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            {isGuest ? '登录后签到' : checkinStatus?.checkedInToday ? `今日已签到 · +${checkinStatus.rewardXp} XP` : `立即签到 · +${checkinStatus?.rewardXp ?? 0} XP`}
          </button>
        </div>
      </section>

      <div className="space-y-4 px-4 py-4">
        {menuSections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-zinc-100 bg-white">
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">{section.title}</p>
            </div>
            <div className="divide-y divide-zinc-100">
              {section.items.map((item) => {
                const content = (
                  <>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isGuest ? 'bg-zinc-50 text-zinc-300' : 'bg-zinc-50 text-zinc-700'}`}>
                      {isGuest ? <LockKeyhole className="h-5 w-5" /> : <item.Icon className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black">{item.label}</p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-400">{isGuest ? '登录后可用' : item.hint}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-300" />
                  </>
                );

                return isGuest ? (
                  <div key={item.path + item.label} className="flex cursor-not-allowed items-center gap-3 bg-zinc-50/60 p-4 text-zinc-400" aria-disabled="true">
                    {content}
                  </div>
                ) : (
                  <Link key={item.path + item.label} to={item.path} className="flex min-h-16 items-center gap-3 p-4 active:bg-zinc-50">
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {isGuest ? (
          <Link to="/login" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-4 text-sm font-black text-white">
            <LogIn className="h-4 w-4" />
            登录后使用
          </Link>
        ) : (
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-black text-red-600"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        )}
      </div>
    </div>
  );
};

export default MobileUserCenter;
