import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { normalizeUser } from '@/utils/user';

const Billing: React.FC = () => {
  const t = useT();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<any>('/profile'),
  });
  const { data: transactionsResponse } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => api.get<any[]>('/wallet/transactions', { limit: 20 }),
    retry: 1,
  });
  const { data: checkinStatus, isFetching: checkinStatusLoading } = useQuery({
    queryKey: ['checkin-status'],
    queryFn: () => api.get<{
      checkedInToday: boolean;
      streakDays: number;
      rewardXp: number;
      recentCheckinDates: string[];
    }>('/user/checkin/status'),
    staleTime: 30_000,
    retry: 1,
  });
  const transactions = Array.isArray(transactionsResponse) ? transactionsResponse : [];

  const checkinMutation = useMutation({
    mutationFn: () => api.post<any>('/user/checkin', {}),
    onSuccess: (result) => {
      if (currentUser) {
        setUser(normalizeUser({
          ...currentUser,
          experience_points: result.totalXp ?? currentUser.experience_points ?? 0,
          level: result.level ?? currentUser.level ?? 1,
          xp_into_level: result.xp_into_level,
          xp_for_next_level: result.xp_for_next_level,
          level_progress: result.level_progress,
          last_checkin_at: result.checkinAt,
        })!);
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['checkin-status'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      toast({ title: t('common.success'), description: t('dash.checkin.xp_reward') });
    }
  });

  return (
    <StatusWrapper isLoading={isLoading} isError={isError} onRetry={() => refetch()}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 lg:py-12 space-y-6 sm:space-y-8">
        <header className="space-y-2">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase text-zinc-900">{t('dash.menu.billing')}</h2>
          <p className="text-zinc-500 text-sm sm:text-base leading-7 max-w-2xl">{t('dash.financial.desc')}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
           <div className="p-5 sm:p-6 md:p-8 lg:p-10 bg-black rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-[0_16px_50px_rgba(0,0,0,0.12)] relative overflow-hidden group">
              <GeometricLantern variant="payment" className="w-24 h-24 opacity-10 absolute -top-4 -right-4 scale-150 rotate-12 transition-transform group-hover:rotate-45 duration-1000" />
              <div className="relative z-10 space-y-6 sm:space-y-8">
                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/55">{t('dash.financial.balance_label')}</p>
                   <p className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter">¥ {profile?.balance || '0.00'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/payment" className="w-full px-4 py-4 bg-white text-black rounded-2xl font-semibold text-[11px] hover:bg-zinc-100 transition-all active:scale-95 uppercase tracking-[0.28em] flex items-center justify-center">
                    {t('dash.financial.recharge_btn')}
                  </Link>
                  <Link to="/payment" className="w-full px-4 py-4 bg-white/10 text-white rounded-2xl font-semibold text-[11px] hover:bg-white/20 transition-all active:scale-95 uppercase tracking-[0.28em] flex items-center justify-center">
                    支付中心
                  </Link>
                </div>
              </div>
           </div>

           <div className="rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-100 bg-white p-5 sm:p-6 md:p-8 lg:p-10 shadow-[0_12px_40px_rgba(0,0,0,0.04)] flex flex-col justify-between group">
              <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 mb-2">{t('dash.financial.checkin_label')}</p>
                 <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-zinc-900">{t('dash.financial.checkin_desc')}</h3>
              </div>
              <button type="button" 
                onClick={() => checkinMutation.mutate()}
                disabled={checkinMutation.isPending || checkinStatusLoading || !!checkinStatus?.checkedInToday}
                className="w-full py-4 sm:py-5 rounded-2xl bg-zinc-900 hover:bg-black text-white font-semibold transition-all flex items-center justify-center gap-3 mt-6 sm:mt-8 active:scale-[0.98] uppercase tracking-[0.28em] text-[11px] disabled:opacity-50 disabled:active:scale-100"
              >
                {checkinMutation.isPending || checkinStatusLoading ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" /> {t('dash.financial.checkin_loading')}
                   </>
                ) : checkinStatus?.checkedInToday ? (
                   <>
                     <GeometricLantern variant="spark" className="w-5 h-5" /> {t('dash.checkin.claimed')}
                   </>
                ) : (
                   <>
                     <GeometricLantern variant="spark" className="w-5 h-5" /> {t('dash.financial.checkin_btn')} +{checkinStatus?.rewardXp ?? 25} XP
                   </>
                )}
              </button>
           </div>
        </div>

        <section className="pt-2 sm:pt-4">
           <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 flex items-center gap-3 mb-5 sm:mb-6">
              <GeometricLantern variant="activity" className="w-5 h-5 text-zinc-400" /> {t('dash.financial.history_title')}
           </h3>
           {transactions.length === 0 ? (
             <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-white p-8 text-center">
               <div className="text-sm font-bold text-zinc-500">暂无真实账单流水</div>
               <p className="mt-2 text-xs font-medium text-zinc-400">充值、签到奖励或兑换码入账后会显示在这里。</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {transactions.map((tx) => (
                <div key={tx.id} className="rounded-[1.5rem] border border-zinc-100 bg-white p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                   <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                         <GeometricLantern variant="network" className="w-5 h-5 text-zinc-500" />
                      </div>
                      <div className="space-y-1 min-w-0">
                         <div className="font-semibold text-zinc-900 text-sm sm:text-base">{tx.description || tx.type || t('dash.financial.history_type')}</div>
                         <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest break-words">
                           {tx.created_at ? new Date(tx.created_at).toLocaleString() : '时间未知'} // LOG_ID: {tx.id}
                         </div>
                      </div>
                   </div>
                   <div className="text-left sm:text-right space-y-1 sm:ml-auto">
                      <div className={`text-xl sm:text-2xl font-black ${Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {Number(tx.amount) >= 0 ? '+' : '-'} ¥ {Math.abs(Number(tx.amount || 0)).toFixed(2)}
                      </div>
                      <div className="text-[9px] font-black text-zinc-400 flex items-center justify-start sm:justify-end gap-2 uppercase tracking-widest">
                         <div className={`w-1.5 h-1.5 rounded-full ${tx.integrity_valid === false ? 'bg-red-500' : 'bg-emerald-500'} shadow-[0_0_8px_rgba(34,197,94,0.4)]`} />
                         {tx.status || 'RECORDED'}
                      </div>
                   </div>
                </div>
              ))}
             </div>
           )}
        </section>
      </div>
    </StatusWrapper>
  );
};

export default Billing;
