import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { request } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import GeometricLantern from '@/components/icons/GeometricLantern';
import ThreeDHeadShowcase from '@/components/ThreeDHeadShowcase';
import { useT, type TranslationKey } from '@/store/uiStore';
import { escapeHtml } from '@/utils/htmlSanitizer';
import { formatUserId, normalizeUser } from '@/utils/user';

const quickLinks: { to: string; titleKey: TranslationKey; descKey: TranslationKey; variant: 'network' | 'data' }[] = [
  { to: '/payment', titleKey: 'profile.order.title', descKey: 'profile.order.desc', variant: 'network' },
  { to: '/tickets', titleKey: 'profile.support.title', descKey: 'profile.support.desc', variant: 'data' },
];

const Profile: React.FC = () => {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => normalizeUser(await request<any>('/profile')),
  });
  const { data: checkinStatus } = useQuery({
    queryKey: ['checkin-status'],
    queryFn: () => request<{
      checkedInToday: boolean;
      streakDays: number;
      rewardXp: number;
      recentCheckinDates: string[];
    }>('/user/checkin/status'),
    enabled: !!profile,
    staleTime: 30_000,
    retry: 1,
  });
  const { data: transactions = [] } = useQuery({
    queryKey: ['wallet-transactions', 'profile'],
    queryFn: () => request<any[]>('/wallet/transactions', { params: { limit: 5 } }),
    enabled: !!profile,
    staleTime: 60_000,
    retry: 1,
  });

  const checkinMutation = useMutation({
    mutationFn: () => request('/user/checkin', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['checkin-status'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      toast({ title: t('auth.status.granted'), description: t('profile.checkin.success') });
    }
  });
  const rawProgress = profile?.level_progress ?? 0;
  const levelProgress = Math.min(100, Math.max(0, Math.round(rawProgress <= 1 ? rawProgress * 100 : rawProgress)));

  return (
    <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20 bg-white selection:bg-accent selection:text-white">
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
                  disabled={checkinMutation.isPending || !!checkinStatus?.checkedInToday}
                  className="w-full sm:w-auto whitespace-nowrap px-5 sm:px-6 py-3.5 rounded-2xl bg-black text-white font-semibold text-[clamp(0.82rem,0.95vw,0.95rem)] hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <GeometricLantern variant="activity" className="w-5 h-5" /> {checkinStatus?.checkedInToday ? '今日已签到' : t('profile.checkin')}
                </button>
                <Link to="/me/edit" className="w-full sm:w-auto whitespace-nowrap px-5 sm:px-6 py-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-[clamp(0.82rem,0.95vw,0.95rem)] hover:border-zinc-400 hover:bg-zinc-50 transition-all flex items-center justify-center gap-3">
                  <GeometricLantern variant="settings" className="w-5 h-5 text-zinc-500" /> 编辑资料
                </Link>
              </div>
           </div>

           <div className="mt-6 sm:mt-8 grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-6 items-start">
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
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
             <div className="w-full 2xl:w-[320px]">
               <ThreeDHeadShowcase username={profile?.username} />
             </div>
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.82fr_1.18fr] gap-6 sm:gap-8 lg:gap-10 xl:gap-12">
          <div className="space-y-6 sm:space-y-8">
            <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600">Wallet</div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
              <div className="space-y-3">
                 <div className="text-4xl sm:text-5xl font-black tracking-tighter leading-none text-zinc-900">¥ {profile?.balance || '0.00'}</div>
                 <p className="text-sm text-zinc-500 leading-6 max-w-sm">{t('profile.wallet.desc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button type="button" className="py-3.5 rounded-2xl bg-black text-white font-semibold text-sm hover:bg-zinc-800 transition-all active:scale-[0.98]">
                  {t('profile.wallet.fund')}
                </button>
                <Link to="/dashboard/billing" className="py-3.5 rounded-2xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-sm hover:border-zinc-400 hover:bg-zinc-50 transition-all flex items-center justify-center">
                  账单明细
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600">Quick Actions</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50 p-4 hover:border-zinc-300 hover:bg-white transition-all group">
                    <div className="w-11 h-11 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-400 mb-4 group-hover:bg-black group-hover:text-white transition-all">
                      <GeometricLantern variant={link.variant} className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-1">{t(link.titleKey)}</h3>
                    <p className="text-sm text-zinc-500 leading-6">{t(link.descKey)}</p>
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
             <div className="rounded-[2rem] sm:rounded-[3rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)] space-y-6">
                <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                   <div className="flex items-center gap-4">
                      <GeometricLantern variant="activity" className="w-5 h-5 text-zinc-400" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.45em] text-zinc-400">{t('profile.activity.title')}</h3>
                   </div>
                   <div className="px-3 py-1 rounded-full bg-zinc-100 text-[9px] font-black uppercase tracking-widest text-zinc-400">{transactions.length} Records</div>
                </header>
                {transactions.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-zinc-50/60 p-6 text-center text-sm font-bold text-zinc-400">
                    暂无账户流水记录
                  </div>
                ) : (
                <div className="space-y-4 sm:space-y-5">
                   {transactions.map((tx) => (
                     <div key={tx.id} className="flex gap-4 items-start rounded-[1.5rem] border border-zinc-100 p-4 sm:p-5 bg-zinc-50/60 group">
                        <div className="w-11 h-11 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-white transition-all duration-700 shadow-xs">
                           <GeometricLantern variant="user" className="w-5 h-5" />
                        </div>
                        <div className="space-y-2 flex-grow min-w-0">
                           <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                              <p className="text-sm sm:text-base font-semibold text-zinc-900">{tx.description || tx.type}</p>
                              <span className="text-[10px] font-black font-mono text-zinc-400 italic">{tx.created_at ? new Date(tx.created_at).toLocaleString() : '时间未知'}</span>
                           </div>
                           <p className="text-sm text-zinc-500 leading-6">
                             金额变动 <span className="text-accent font-semibold">¥ {Number(tx.amount || 0).toFixed(2)}</span>，状态 {tx.status || 'RECORDED'}
                           </p>
                        </div>
                     </div>
                   ))}
                </div>
                )}
             </div>

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
