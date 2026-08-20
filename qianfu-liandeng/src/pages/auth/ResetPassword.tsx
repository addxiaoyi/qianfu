import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { request } from '@/api/request';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Lock, Loader2 } from 'lucide-react';
import { useT } from '@/store/uiStore';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
import GeometricLantern from '@/components/ui/GeometricLantern';

const ResetPassword: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const resetSchema = z.object({
    password: z.string().min(8, t('auth.password') + ' min 8 chars'),
    confirmPassword: z.string(),
  }).refine(data => data.password === data.confirmPassword, {
    message: t('common.error'),
    path: ["confirmPassword"],
  });

  type ResetValues = z.infer<typeof resetSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (values: ResetValues) => {
    if (!token) {
      toast({ 
        title: t('auth.reset.invalid'), 
        description: t('auth.reset.missing_token'), 
        variant: 'destructive' 
      });
      return;
    }
    setLoading(true);
    try {
      await request(isRustV2Enabled() ? rustV2Path('/auth/password-reset/complete') : '/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: values.password, ...(isRustV2Enabled() ? { token } : { token }), email }),
        ...(isRustV2Enabled() ? rustV2RequestOptions : {}),
      });
      toast({ 
        title: t('auth.reset.success'), 
        description: t('auth.reset.success_desc') 
      });
      navigate('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '密码重置失败',
        description: error instanceof Error ? error.message : '链接可能已失效，请重新申请验证码。',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-zinc-50/30 selection:bg-accent selection:text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none">
         <GeometricLantern variant="security" className="w-96 h-96 rotate-12" />
      </div>

      <div className="max-w-md w-full bg-white border border-zinc-50 rounded-[3rem] p-6 sm:p-12 shadow-2xl shadow-black/5 relative z-10">
        <header className="mb-12 space-y-4 text-center">
           <div className="w-20 h-20 bg-black text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl animate-float">
              <GeometricLantern variant="security" className="w-10 h-10 fill-current" />
           </div>
           <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">{t('auth.reset.title')}.</h1>
           <p className="text-zinc-400 font-bold italic text-sm">{t('auth.reset.subtitle')}</p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
          <div className="space-y-4">
            <label htmlFor="reset-password" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">{t('auth.reset.new_pwd')}</label>
            <div className="relative group">
              <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-200 group-focus-within:text-accent transition-colors" />
              <input 
                id="reset-password"
                {...register('password')}
                type="password"
                className="w-full pl-16 pr-8 py-5 bg-zinc-50/50 border border-transparent rounded-2xl focus:bg-white focus:border-accent outline-hidden font-black italic tracking-tight transition-all"
                placeholder="••••••••••••"
              />
            </div>
            {errors.password && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-4 italic">// ERROR: {errors.password.message}</p>}
          </div>

          <div className="space-y-4">
            <label htmlFor="reset-confirm-password" className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-300 italic">{t('auth.reset.confirm_pwd')}</label>
            <div className="relative group">
              <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-200 group-focus-within:text-accent transition-colors" />
              <input 
                id="reset-confirm-password"
                {...register('confirmPassword')}
                type="password"
                className="w-full pl-16 pr-8 py-5 bg-zinc-50/50 border border-transparent rounded-2xl focus:bg-white focus:border-accent outline-hidden font-black italic tracking-tight transition-all"
                placeholder="••••••••••••"
              />
            </div>
            {errors.confirmPassword && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-4 italic">// ERROR: {errors.confirmPassword.message}</p>}
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-7 btn-accent rounded-[2rem] font-black text-[12px] uppercase tracking-[0.6em] transition-all flex items-center justify-center gap-6 shadow-2xl active:scale-95 group"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-white/50" /> : <GeometricLantern variant="spark" className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />}
            {t('auth.reset.submit')}
          </button>
        </form>
      </div>

      {/* Decorative Background */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
    </div>
  );
};

export default ResetPassword;
