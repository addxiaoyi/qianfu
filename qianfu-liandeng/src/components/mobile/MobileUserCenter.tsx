import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { formatUserId, normalizeUser } from '@/utils/user';
import { toArray } from '@/utils/apiData';
import type { User as ApiUser } from '@/types/api';
import { toast } from '@/hooks/use-toast';
import {
  Award,
  Bell,
  ChevronRight,
  Gift,
  LogOut,
  Mail,
  MessageCircle,
  ReceiptText,
  Server,
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
  { Icon: ReceiptText, label: '账单记录', path: '/dashboard/billing', hint: '查看充值与奖励流水' },
  { Icon: Gift, label: '推广中心', path: '/promotion', hint: '任务与奖励领取' },
];

const accountItems: MenuItem[] = [
  { Icon: UserPen, label: '编辑资料', path: '/me/edit', hint: '昵称、头像和个人资料' },
  { Icon: Bell, label: '通知中心', path: '/me/notifications', hint: '查看站内通知和提醒' },
  { Icon: Mail, label: '邮箱安全', path: '/me/settings', hint: '验证邮箱与账户安全' },
];

const MobileUserCenter: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, setUser, logout } = useAuthStore();
  const [checkingIn, setCheckingIn] = React.useState(false);

  const { data: checkinStatus, isFetching: checkinStatusLoading } = useQuery({
    queryKey: ['checkin-status'],
    queryFn: () => api.get<{
      checkedInToday: boolean;
      streakDays: number;
      rewardXp: number;
    }>('/user/checkin/status'),
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: serverInfo } = useQuery({
    queryKey: ['my-server-info'],
    queryFn: () => api.get<{ current_cards: number; max_cards: number; can_publish: boolean }>('/servers/me'),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: ticketResponse } = useQuery({
    queryKey: ['tickets', 'mobile-summary'],
    queryFn: () => api.get<any>('/tickets', { limit: 50 }),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });
  const tickets = toArray<any>(ticketResponse);

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
      } as ApiUser));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['checkin-status'] }),
      ]);
      toast({ title: '签到成功', description: `获得 ${result.gainedXp ?? 25} XP` });
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
      <section className="border-b border-zinc-100 bg-white pb-6 pt-2">
        <div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">ACCOUNT</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">个人中心</h1>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black text-2xl font-black text-white">
            {user?.username?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black">{user?.username || user?.email || '未登录用户'}</h2>
            <p className="mt-1 truncate text-xs font-bold text-zinc-500">UID: {formatUserId(user?.id)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-zinc-600">Lv.{user?.level ?? 1}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-zinc-600">{user?.email_verified ? '邮箱已验证' : '待验证邮箱'}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-100 p-3">
            <p className="text-lg font-black">{serverInfo?.current_cards ?? 0}</p>
            <p className="text-[10px] font-bold text-zinc-400">服务器</p>
          </div>
          <div className="rounded-2xl border border-zinc-100 p-3">
            <p className="text-lg font-black">{openTicketCount}</p>
            <p className="text-[10px] font-bold text-zinc-400">未结工单</p>
          </div>
          <div className="rounded-2xl border border-zinc-100 p-3">
            <p className="text-lg font-black">{checkinStatus?.streakDays ?? 0}</p>
            <p className="text-[10px] font-bold text-zinc-400">连续签到</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">LEVEL</p>
              <p className="mt-1 text-sm font-bold">总经验 {user?.experience_points ?? 0} XP</p>
            </div>
            <span className="text-sm font-black">{progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-black transition-all" style={{ width: `${progress}%` }} />
          </div>
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={checkingIn || checkinStatusLoading || !!checkinStatus?.checkedInToday}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {checkingIn || checkinStatusLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            {checkinStatus?.checkedInToday ? '今日已签到' : `签到 +${checkinStatus?.rewardXp ?? 25} XP`}
          </button>
        </div>
      </section>

      <div className="space-y-5 px-4 py-5">
        {menuSections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-zinc-100 bg-white">
            <div className="border-b border-zinc-100 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">{section.title}</p>
            </div>
            <div className="divide-y divide-zinc-100">
              {section.items.map((item) => (
                <Link key={item.path + item.label} to={item.path} className="flex items-center gap-3 p-4 active:bg-zinc-50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-700">
                    <item.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{item.label}</p>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-zinc-400">{item.hint}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </Link>
              ))}
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-black text-red-600"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </div>
  );
};

export default MobileUserCenter;
