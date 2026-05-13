import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/request';
import StatusWrapper from '@/components/StatusWrapper';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT } from '@/store/uiStore';

const Billing: React.FC = () => {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<any>('/profile'),
  });

  const checkinMutation = useMutation({
    mutationFn: () => api.post('/user/checkin', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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
                  <button className="w-full px-4 py-4 bg-white text-black rounded-2xl font-semibold text-[11px] hover:bg-zinc-100 transition-all active:scale-95 uppercase tracking-[0.28em]">
                    {t('dash.financial.recharge_btn')}
                  </button>
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
              <button 
                onClick={() => checkinMutation.mutate()}
                disabled={checkinMutation.isPending}
                className="w-full py-4 sm:py-5 rounded-2xl bg-zinc-900 hover:bg-black text-white font-semibold transition-all flex items-center justify-center gap-3 mt-6 sm:mt-8 active:scale-[0.98] uppercase tracking-[0.28em] text-[11px]"
              >
                {checkinMutation.isPending ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" /> {t('dash.financial.checkin_loading')}
                   </>
                ) : (
                   <>
                     <GeometricLantern variant="spark" className="w-5 h-5" /> {t('dash.financial.checkin_btn')}
                   </>
                )}
              </button>
           </div>
        </div>

        <section className="pt-2 sm:pt-4">
           <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 flex items-center gap-3 mb-5 sm:mb-6">
              <GeometricLantern variant="activity" className="w-5 h-5 text-zinc-400" /> {t('dash.financial.history_title')}
           </h3>
           <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-[1.5rem] border border-zinc-100 bg-white p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                   <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                         <GeometricLantern variant="network" className="w-5 h-5 text-zinc-500" />
                      </div>
                      <div className="space-y-1 min-w-0">
                         <div className="font-semibold text-zinc-900 text-sm sm:text-base">{t('dash.financial.history_type')}</div>
                         <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest break-words">2026-04-2{i} 14:2{i}:05 // LOG_ID: BILL-{i}0{i}</div>
                      </div>
                   </div>
                   <div className="text-left sm:text-right space-y-1 sm:ml-auto">
                      <div className="text-xl sm:text-2xl font-black text-emerald-600">+ ¥ 50.00</div>
                      <div className="text-[9px] font-black text-zinc-400 flex items-center justify-start sm:justify-end gap-2 uppercase tracking-widest">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse" /> 
                         DATA_VERIFIED
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </section>
      </div>
    </StatusWrapper>
  );
};

export default Billing;
