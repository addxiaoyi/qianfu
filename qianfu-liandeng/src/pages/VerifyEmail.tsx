import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiError, setLocalAuthToken } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import type { User } from '@/types/api';
import { Loader2, Mail, ShieldCheck, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useT } from '@/store/uiStore';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { normalizeUser } from '@/utils/user';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

const VerifyEmail: React.FC = () => {
  const t = useT();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);
  const currentUser = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || currentUser?.email || '';

  const canSend = useMemo(() => !sending, [sending]);

  useEffect(() => {
    if (email && !code) {
      setSending(false);
    }
  }, [email, code]);

  const handleSendCode = async () => {
    setSending(true);
    try {
      if (!email) {
        throw new Error('缺少邮箱地址，请返回登录或注册页重新进入验证流程。');
      }
      await api.post(
        isRustV2Enabled() ? rustV2Path('/auth/send-code') : '/auth/send-code',
        { email },
        isRustV2Enabled() ? rustV2RequestOptions : undefined,
      );
      toast({
        title: '验证码发送成功',
        description: '验证码已发送，请查看邮箱。',
      });
    } catch (err: any) {
      const apiError = err as ApiError;
      if (apiError.status === 502) {
        toast({
          variant: 'destructive',
          title: '后端验证码服务未就绪',
          description: '验证码服务暂时无法使用，请稍后再试。',
        });
        return;
      }

      toast({
        variant: 'destructive',
        title: '验证码发送失败',
        description: apiError.message || '验证码发送失败，请检查网络或稍后重试。',
      });
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const result = await api.post<any>(
        isRustV2Enabled() ? rustV2Path('/auth/verify-code') : '/auth/verify-code',
        { code, email },
        isRustV2Enabled() ? rustV2RequestOptions : undefined,
      );
      const updatedUser = normalizeUser(result?.user ?? (result as User));
      if (!updatedUser) {
        throw new Error('邮箱验证返回缺少用户信息');
      }
      if (result?.token) {
        setLocalAuthToken(result.token);
      }
      setUser(updatedUser);
      toast({ title: '验证成功', description: '邮箱已验证，正在跳转到控制台。' });
      navigate('/dashboard');
    } catch (err: any) {
      const apiError = err as ApiError;
      if (apiError.status === 502) {
        toast({
          variant: 'destructive',
          title: '后端验证码服务未就绪',
          description: '验证码验证服务暂时不可用，请稍后重试。',
        });
      } else if (apiError.data?.error?.code === 'VALIDATION_ERROR' && apiError.data?.error?.details?.length) {
        toast({
          variant: 'destructive',
          title: '验证码格式有误',
          description: apiError.data.error.details[0]?.message || '请检查验证码格式',
        });
      } else {
        toast({
          variant: 'destructive',
          title: '验证失败',
          description: apiError.message || '验证码无效，请检查后重试。',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-8 bg-zinc-50/30 selection:bg-accent selection:text-white relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none">
         <GeometricLantern variant="security" className="w-96 h-96 rotate-12" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border border-zinc-50 rounded-[3rem] p-12 text-center shadow-2xl shadow-black/5 relative z-10"
      >
        <button type="button" 
          onClick={() => navigate(-1)}
          aria-label="返回上一页"
          className="absolute top-8 left-8 p-3 hover:bg-zinc-50 rounded-2xl transition-all group"
        >
          <ChevronLeft className="w-5 h-5 text-zinc-300 group-hover:text-black transition-colors" />
        </button>

        <div className="w-24 h-24 bg-black rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl relative group overflow-hidden">
           <Mail className="w-10 h-10 text-white group-hover:scale-110 transition-transform duration-700" />
           <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              <ShieldCheck className="w-5 h-5" />
           </div>
        </div>

        <h1 className="text-4xl font-black mb-4 italic uppercase tracking-tighter leading-none">{t('auth.verify.title')}.</h1>
        <p className="text-zinc-400 font-bold italic mb-12 text-xs leading-relaxed px-4">
          {t('auth.verify.desc')}
        </p>
        
        <div className="space-y-10">
          <div className="relative">
            <input 
              type="text" 
              aria-label="6 位邮箱验证码"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full text-center text-5xl tracking-[0.6em] font-mono font-black py-8 bg-zinc-50/50 border border-transparent rounded-[2rem] focus:bg-white focus:border-accent transition-all outline-hidden placeholder:opacity-10 italic"
              placeholder="000000"
              maxLength={6}
            />
          </div>
          
          <button type="button" 
            onClick={handleVerify}
            disabled={loading || code.length < 6}
            className="w-full py-7 btn-accent rounded-2xl font-black text-[12px] uppercase tracking-[0.5em] transition-all disabled:opacity-20 flex items-center justify-center gap-4 shadow-2xl shadow-accent/20 italic group active:scale-95"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-white/50" /> : <GeometricLantern variant="spark" className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />}
            {t('auth.verify.submit')}
          </button>
          
          <div className="pt-4">
            <button type="button" 
              onClick={handleSendCode}
              disabled={!canSend}
              className="text-[10px] font-black text-zinc-300 hover:text-black uppercase tracking-widest italic border-b border-transparent hover:border-black transition-all disabled:opacity-30"
            >
              {sending ? t('auth.verify.sending') : t('auth.verify.resend')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Decorative Blur */}
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
    </div>
  );
};

export default VerifyEmail;
