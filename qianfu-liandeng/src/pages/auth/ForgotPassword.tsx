import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronRight, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';

const STORIES: { id: string; badge: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    id: 'recovery',
    badge: 'SECURITY / RECOVERY',
    titleKey: 'auth.forgot.title',
    descKey: 'auth.forgot.subtitle',
  },
  {
    id: 'verify',
    badge: 'ID_PROOF / VERIFY',
    titleKey: 'auth.story.4.title',
    descKey: 'auth.story.4.desc',
  },
];

type ForgotStep = 'identify' | 'verify' | 'reset';

const ForgotPassword: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [activeStory, setActiveStory] = useState(0);
  const [step, setStep] = useState<ForgotStep>('identify');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const backendReady = useAuthStore((state) => state.backendReady);
  const navigate = useNavigate();

  const currentStory = STORIES[activeStory];

  // Countdown timer for code resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Story rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStory((prev) => (prev + 1) % STORIES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Step 1: Identify account
  const identifySchema = z.object({
    email: z.string().email(t('auth.form.email.placeholder')),
  });
  type IdentifyFormValues = z.infer<typeof identifySchema>;
  const {
    register: regIdentify,
    handleSubmit: handleSubmitIdentify,
    formState: { errors: errorsIdentify },
  } = useForm<IdentifyFormValues>({
    resolver: zodResolver(identifySchema),
  });

  // Step 2: Verify code
  const verifySchema = z.object({
    code: z.string().length(6, 'Input 6 digits'),
  });
  type VerifyFormValues = z.infer<typeof verifySchema>;
  const {
    register: regVerify,
    handleSubmit: handleSubmitVerify,
    formState: { errors: errorsVerify },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
  });

  // Step 3: Reset password
  const resetSchema = z
    .object({
      password: z.string().min(6, 'Password must be 6 chars'),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
  type ResetFormValues = z.infer<typeof resetSchema>;
  const {
    register: regReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: errorsReset },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  const onSendCode = handleSubmitIdentify(async (values) => {
    if (!backendReady) {
      toast({ variant: 'destructive', title: 'Error', description: 'Backend unavailable.' });
      return;
    }
    setSendingCode(true);
    try {
      await api.post('/auth/forgot-password', { email: values.email }, { skipCsrf: true });
      setVerifiedEmail(values.email);
      setStep('verify');
      setCountdown(60);
      toast({ title: 'Code sent', description: 'Verification code sent to your email.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSendingCode(false);
    }
  });

  const onVerifyCode = handleSubmitVerify(async (values) => {
    if (!backendReady) {
      toast({ variant: 'destructive', title: 'Error', description: 'Backend unavailable.' });
      return;
    }
    setLoading(true);
    try {
      setResetCode(values.code);
      setStep('reset');
      toast({ title: 'Code ready', description: 'Set your new password to complete verification.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  });

  const onResetPassword = handleSubmitReset(async (values) => {
    if (!backendReady) {
      toast({ variant: 'destructive', title: 'Error', description: 'Backend unavailable.' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: verifiedEmail, code: resetCode, password: values.password }, { skipCsrf: true });
      toast({ title: 'Password reset', description: 'Your password has been reset successfully.' });
      navigate('/login');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  });

  // Step indicator
  const steps: { key: ForgotStep; label: string }[] = [
    { key: 'identify', label: 'Identify' },
    { key: 'verify', label: 'Verify' },
    { key: 'reset', label: 'Reset' },
  ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white selection:bg-accent selection:text-white">
      {/* Visual Side: Cinematic Black */}
      <aside className="hidden lg:flex lg:w-[48%] bg-black p-24 flex-col justify-between relative overflow-hidden shadow-2xl shadow-black/50">
        <div className="relative z-20 space-y-32">
          <Link to="/" className="flex items-center gap-4 group">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all duration-700 shadow-xl shadow-white/5">
              <GeometricLantern variant="spark" className="w-6 h-6 text-black fill-current" />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="font-black tracking-tighter text-3xl text-white uppercase italic">
                {t('admin.title')}.
              </span>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic leading-none">
                Minecraft 服务器平台
              </span>
            </div>
          </Link>

          <div className="space-y-16 max-w-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStory}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.8, ease: 'circOut' }}
                className="space-y-10"
              >
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 border border-zinc-800 bg-zinc-900/50 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 italic">
                    {currentStory.badge}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">
                      轮播中
                    </span>
                  </div>
                </div>
                <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-none text-white uppercase italic break-words">
                  {t(currentStory.titleKey)}
                </h2>
                <p className="text-zinc-500 text-base sm:text-lg lg:text-xl font-medium leading-relaxed italic border-l-2 border-zinc-800 pl-8 max-w-lg">
                  "{t(currentStory.descKey)}"
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-3">
              {STORIES.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setActiveStory(i)}
                  className={`h-1.5 rounded-full transition-all duration-1000 ${
                    i === activeStory ? 'w-24 bg-accent shadow-accent' : 'w-6 bg-zinc-900 hover:bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-20 pt-16 border-t border-zinc-900">
          <div className="p-12 bg-zinc-900/30 border border-zinc-800/50 rounded-[3rem] space-y-6 group hover:border-accent transition-all duration-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <GeometricLantern variant="security" className="w-5 h-5 text-zinc-400 group-hover:text-accent transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic leading-none">
                  账号找回与重置
                </span>
              </div>
              <GeometricLantern variant="data" className="w-4 h-4 text-zinc-800" />
            </div>
            <p className="text-[12px] text-zinc-500 font-medium leading-relaxed italic max-w-sm">
              重置密码前需要先完成邮箱验证码校验，避免他人绕过账号安全直接修改密码。
            </p>
          </div>
        </div>

        {/* High-Fidelity Background Elements */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-accent/5 blur-[160px] rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '48px 48px' }} />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      </aside>

      {/* Form Side */}
      <main className="flex-grow flex items-center justify-center p-5 sm:p-8 md:p-24 lg:p-40 relative overflow-y-auto">
        <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none lg:block hidden">
          <GeometricLantern variant="spark" className="w-96 h-96 rotate-12" />
        </div>

        <div className="w-full max-w-lg space-y-12 sm:space-y-16 lg:space-y-20 relative z-10 py-6 sm:py-12">
          {/* Header */}
          <header className="space-y-6">
            <div className="w-16 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl lg:hidden mb-12 animate-float">
              <GeometricLantern variant="spark" className="w-8 h-8 fill-current" />
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-1">
              {steps.map((s, i) => (
                <React.Fragment key={s.key}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-500 ${
                        i < currentStepIndex
                          ? 'bg-accent text-white shadow-lg shadow-accent/30'
                          : i === currentStepIndex
                          ? 'bg-black text-white ring-2 ring-accent ring-offset-2'
                          : 'bg-zinc-100 text-zinc-300'
                      }`}
                    >
                      {i < currentStepIndex ? (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`hidden sm:inline whitespace-nowrap text-[9px] font-black uppercase tracking-widest transition-colors ${
                        i <= currentStepIndex ? 'text-zinc-700' : 'text-zinc-200'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-6 sm:w-8 h-0.5 transition-colors duration-500 ${
                        i < currentStepIndex ? 'bg-accent' : 'bg-zinc-100'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter uppercase italic leading-none break-words">
              {t('auth.forgot.title')}.
            </h1>
            <p className="text-zinc-400 font-bold text-base sm:text-lg lg:text-xl leading-relaxed italic max-w-md break-words">
              {t('auth.forgot.subtitle')}
            </p>
          </header>

          {/* Step 1: Identify */}
          <AnimatePresence mode="wait">
            {step === 'identify' && (
              <motion.form
                key="identify"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                onSubmit={onSendCode}
                className="space-y-12"
              >
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">
                      {t('auth.form.email.label')}
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
                      <input
                        {...regIdentify('email')}
                        autoFocus
                        className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-lg italic tracking-tight shadow-xs"
                        placeholder={t('auth.form.email.placeholder')}
                      />
                    </div>
                    <AnimatePresence>
                      {errorsIdentify.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-8 italic"
                        >
                          {/* ERROR: */}{errorsIdentify.email.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={loading || sendingCode}
                    className="w-full py-8 btn-accent rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.6em] transition-all flex items-center justify-center gap-6 shadow-2xl group active:scale-[0.98]"
                  >
                    {sendingCode ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                    ) : (
                      <>
                        {t('auth.forgot.send_code')}{' '}
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* Step 2: Verify */}
            {step === 'verify' && (
              <motion.form
                key="verify"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                onSubmit={onVerifyCode}
                className="space-y-12"
              >
                <div className="space-y-8">
                  <div className="text-sm text-zinc-400 italic font-medium">
                    {'验证码已发送至 ' + verifiedEmail}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">
                      {t('auth.form.code.label')}
                    </label>
                    <input
                      {...regVerify('code')}
                      autoFocus
                      maxLength={6}
                      className="w-full px-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-2xl text-center tracking-[0.5em] shadow-xs"
                      placeholder="000000"
                    />
                    <AnimatePresence>
                      {errorsVerify.code && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-8 italic"
                        >
                          {/* ERROR: */}{errorsVerify.code.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="text-center">
                    {countdown > 0 ? (
                      <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest italic">
                        Re-send available in{' '}
                        <span className="text-accent">{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onSendCode();
                        }}
                        disabled={sendingCode}
                        className="text-[10px] font-black text-accent uppercase tracking-widest italic hover:text-black transition-colors"
                      >
                        {t('auth.forgot.resend')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-8 btn-accent rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.6em] transition-all flex items-center justify-center gap-6 shadow-2xl group active:scale-[0.98]"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                    ) : (
                      <>
                        {t('auth.forgot.verify')}{' '}
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* Step 3: Reset */}
            {step === 'reset' && (
              <motion.form
                key="reset"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                onSubmit={onResetPassword}
                className="space-y-12"
              >
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">
                      {t('auth.form.password.label')}
                    </label>
                    <div className="relative group">
                      <KeyRound className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
                      <input
                        {...regReset('password')}
                        type="password"
                        autoFocus
                        className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-lg italic tracking-tight shadow-xs"
                        placeholder="••••••••"
                      />
                    </div>
                    <AnimatePresence>
                      {errorsReset.password && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[9px] font-black text-red-500 uppercase tracking-tighter italic"
                        >
                          {errorsReset.password.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">
                      {t('auth.form.confirmPassword.label')}
                    </label>
                    <div className="relative group">
                      <KeyRound className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
                      <input
                        {...regReset('confirmPassword')}
                        type="password"
                        className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-lg italic tracking-tight shadow-xs"
                        placeholder="••••••••"
                      />
                    </div>
                    <AnimatePresence>
                      {errorsReset.confirmPassword && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[9px] font-black text-red-500 uppercase tracking-tighter italic"
                        >
                          {errorsReset.confirmPassword.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-8 btn-accent rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.6em] transition-all flex items-center justify-center gap-6 shadow-2xl group active:scale-[0.98]"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white/50" />
                    ) : (
                      <>
                        {t('auth.forgot.reset')}{' '}
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer */}
          <footer className="pt-16 border-t border-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <GeometricLantern variant="terminal" className="w-5 h-5 text-zinc-100" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-200 uppercase tracking-widest italic leading-none break-words">
                  {t('auth.form.username.label')} 状态
                </span>
                <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest italic break-words">
                  初始化阶段：{currentStepIndex + 1} / 3
                </span>
              </div>
            </div>
            <Link
              to="/login"
              className="group flex items-center gap-6 px-10 py-5 bg-zinc-50 border border-zinc-100 rounded-[2rem] hover:bg-black hover:text-white transition-all duration-700 shadow-xs"
            >
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-zinc-300 group-hover:text-zinc-500 uppercase tracking-widest italic leading-none">
                  {t('auth.form.has_node')}
                </span>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">
                  {t('auth.form.init_login')}
                </span>
              </div>
              <div className="w-8 h-8 bg-white border border-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-zinc-900 group-hover:border-zinc-800 transition-all duration-700">
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
