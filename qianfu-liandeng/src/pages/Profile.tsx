import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/request';
import StatusWrapper from '@/components/ui/StatusWrapper';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { Newspaper } from 'lucide-react';
import { useT } from '@/store/uiStore';
import { escapeHtml } from '@/utils/htmlSanitizer';
import { formatUserId, normalizeUser } from '@/utils/user';
import type { CheckinResult, CheckinStatus } from '@/types/api';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

const quickLinks: { to: string; title: string; desc: string; variant: 'network' | 'data' }[] = [
  { to: '/dashboard/servers', title: '我的服务器', desc: '查看已提交的服务器和审核状态。', variant: 'network' },
  { to: '/tickets', title: '技术支持', desc: '提交工单并查看处理进度。', variant: 'data' },
];

const Profile: React.FC = () => {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile'],
      queryFn: async () => normalizeUser(await request<any>(isRustV2Enabled() ? rustV2Path('/profile') : '/profile', isRustV2Enabled() ? rustV2RequestOptions : undefined)),
  });
  const { data: checkinStatus, isFetching: checkinStatusLoading, isError: checkinStatusError, refetch: refetchCheckinStatus } = useQuery({
    queryKey: ['checkin-status', profile?.id],
    queryFn: () => request<CheckinStatus>(isRustV2Enabled() ? rustV2Path('/user/checkin/status') : '/user/checkin/status', isRustV2Enabled() ? rustV2RequestOptions : undefined),
    enabled: !!profile,
    staleTime: 30_000,
    retry: 1,
  });
  const checkinMutation = useMutation({
    mutationFn: () => request<CheckinResult>(isRustV2Enabled() ? rustV2Path('/user/checkin') : '/user/checkin', { method: 'POST', ...(isRustV2Enabled() ? rustV2RequestOptions : {}) }),
    onSuccess: (result) => {
      if (result.ok === false || result.alreadyCheckedIn) {
        void queryClient.invalidateQueries({ queryKey: ['checkin-status'] });
        toast({ title: '今日已签到', description: '今日奖励已经领取，不会重复增加经验。' });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['checkin-status'] });
      toast({ title: t('auth.status.granted'), description: t('profile.checkin.success') });
    },
    onError: (error: unknown) => toast({ variant: 'destructive', title: '签到失败', description: error instanceof Error ? error.message : '请稍后重试。' }),
  });
  const rawProgress = profile?.level_progress ?? 0;
  const levelProgress = Math.min(100, Math.max(0, Math.round(rawProgress <= 1 ? rawProgress * 100 : rawProgress)));

  return (
    <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20 bg-white selection:bg-accent selection:text-white">
        {checkinStatusError ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            签到状态暂时无法读取，失败的数据不会显示成正常空状态。
            <button type="button" onClick={() => { void refetchCheckinStatus(); }} className="ml-3 underline underline-offset-4">重新加载</button>
          </div>
        ) : null}
        <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-gradient-to-b from-zinc-50 to-white p-5 sm:p-8 md:p-10 lg:p-12 mb-8 sm:mb-10 lg:mb-14 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
           <div className="flex flex-col 2xl:flex-row 2xl:items-center gap-6 lg:gap-10">
              <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-black text-white rounded-[1.75rem] flex items-center justify-center text-3xl sm:text-4xl font-black shadow-lg">
                  {escapeHtml(profile?.username ?? '')?.[0]}
                </div>
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="px-2.5 py-1 rounded-full bg-black text-white text-[10px] font-black uppercase tracking-[0.24em]">Profile</span>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">ID #{formatUserId(profile?.id)}</span>
                  </div>
                  <h1 className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(2.2rem,5vw,5rem)] font-black tracking-tight text-zinc-900 leading-[0.9]">{escapeHtml(profile?.username ?? '')}</h1>
                  <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 text-sm text-zinc-500 font-medium min-w-0">
                     <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-zinc-700">
                       <GeometricLantern variant="security" className="w-4 h-4 text-accent" />
                       {profile?.role === 'admin' ? t('profile.role.admin') : t('profile.role.user')}
                     </span>
                     <span className="min-w-0 truncate">{escapeHtml(profile?.email ?? '')}</span>
                  </div>
                </div>
              </div>
              <div className="2xl:ml-auto flex flex-col sm:flex-row gap-3 w-full 2xl:w-auto 2xl:shrink-0">
                 <button type="button" 
                  onClick={() => checkinMutation.mutate()}
                  disabled={checkinMutation.isPending || checkinStatusLoading || checkinStatusError || !!checkinStatus?.checkedInToday}
                  className="w-full sm:w-auto whitespace-nowrap px-5 sm:px-6 py-3.5 rounded-2xl bg-black text-white font-semibold text-[clamp(0.82rem,0.95vw,0.95rem)] hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <GeometricLantern variant="activity" className="w-5 h-5" /> {checkinStatus?.checkedInToday ? '今日已签到' : t('profile.checkin')}
                </button>
                <Link to="/me/edit" className="w-full sm:w-auto whitespace-nowrap px-5 sm:px-6 py-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-[clamp(0.82rem,0.95vw,0.95rem)] hover:border-zinc-400 hover:bg-zinc-50 transition-all flex items-center justify-center gap-3">
                  <GeometricLantern variant="settings" className="w-5 h-5 text-zinc-500" /> 编辑资料
                </Link>
                <Link to="/me/favorites" className="w-full sm:w-auto whitespace-nowrap px-5 sm:px-6 py-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-[clamp(0.82rem,0.95vw,0.95rem)] hover:border-zinc-400 hover:bg-zinc-50 transition-all flex items-center justify-center gap-3">
                  <GeometricLantern variant="heart" className="w-5 h-5 text-zinc-500" /> 我的收藏
                </Link>
                <Link to="/me/tags" className="w-full sm:w-auto whitespace-nowrap px-5 sm:px-6 py-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-[clamp(0.82rem,0.95vw,0.95rem)] hover:border-zinc-400 hover:bg-zinc-50 transition-all flex items-center justify-center gap-3">
                  <GeometricLantern variant="tag" className="w-5 h-5 text-zinc-500" /> 兴趣标签
                </Link>
              </div>
           </div>

           <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
               {[
                 { label: '账户状态', value: profile?.email ? '已绑定邮箱' : '未绑定邮箱' },
                 { label: '等级进度', value: `Lv.${profile?.level || 1} / ${levelProgress}%` },
                 { label: '签到状态', value: checkinMutation.isPending ? '处理中' : checkinStatus?.checkedInToday ? `已签到 ${checkinStatus.streakDays} 天` : '今日可签到' },
               ].map((item) => (
                 <div key={item.label} className="rounded-2xl border border-zinc-100 bg-white p-4 sm:p-5 min-w-0">
                   <div className="truncate whitespace-nowrap text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{item.label}</div>
                   <div className="mt-2 truncate whitespace-nowrap text-sm sm:text-base lg:text-lg font-semibold text-zinc-900">{item.value}</div>
                 </div>
               ))}
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.82fr_1.18fr] gap-6 sm:gap-8 lg:gap-10 xl:gap-12">
          <div className="space-y-6 sm:space-y-8">
            <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600">Quick Actions</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link to="/me/news-submit" className="rounded-[1.5rem] border border-accent/20 bg-accent/5 p-4 hover:border-accent hover:bg-accent/10 transition-all group sm:col-span-2">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white"><Newspaper className="h-6 w-6" /></div>
                    <div><h3 className="text-lg font-semibold text-zinc-900">投稿新闻</h3><p className="mt-1 text-sm leading-6 text-zinc-500">分享社区故事，提交后由编辑部审核发布。</p></div>
                  </div>
                </Link>
                {quickLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4 hover:border-zinc-300 hover:bg-white transition-all group">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-400 mb-4 group-hover:bg-black group-hover:text-white transition-all">
                      <GeometricLantern variant={link.variant} className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-1">{link.title}</h3>
                    <p className="text-sm text-zinc-500 leading-6">{link.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600">Account Details</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: '邮箱', value: profile?.email || '未绑定' },
                  { label: '用户ID', value: profile?.id || '—' },
                  { label: '角色', value: profile?.role === 'admin' ? t('profile.role.admin') : t('profile.role.user') },
                  { label: '签到积分', value: `${profile?.experience_points || 0} XP` },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">{item.label}</div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900 break-words">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 sm:space-y-8">
             <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] space-y-4">
                <div className="flex items-center justify-between">
                   <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600">Security Snapshot</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: '认证状态', value: profile?.email ? '邮箱已验证' : '待验证' },
                    { label: '上次签到', value: profile?.last_checkin_at ? new Date(profile.last_checkin_at).toLocaleString() : '暂无记录' },
                    { label: '账户等级', value: `Lv.${profile?.level || 1}` },
                    { label: '连续签到', value: `${checkinStatus?.streakDays ?? 0} 天` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">{item.label}</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">{item.value}</div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </StatusWrapper>
  );
};


export default Profile;
