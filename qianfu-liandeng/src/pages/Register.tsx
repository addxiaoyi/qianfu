import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

const STORIES: { id: string; badge: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    id: 'philosophy',
    badge: '服务器内容 / BRAND',
    titleKey: 'auth.story.4.title',
    descKey: 'auth.story.4.desc',
  },
  {
    id: 'ecosystem',
    badge: '平台价值 / COMMUNITY',
    titleKey: 'auth.story.5.title',
    descKey: 'auth.story.5.desc',
  },
];

const Register: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [activeStory, setActiveStory] = useState(0);
  const backendReady = useAuthStore((state) => state.backendReady);
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('[data-register-brand]', { autoAlpha: 0, y: 18, duration: 0.55 })
        .from('[data-register-story]', { autoAlpha: 0, y: 28, duration: 0.7 }, '<0.1')
        .from('[data-register-form]', { autoAlpha: 0, x: 24, duration: 0.65 }, '<0.05');
    });
    return () => media.revert();
  }, { scope: pageRef });

  const currentStory = STORIES[activeStory];

  const registerSchema = z.object({
    username: z.string()
      .min(3, '用户名至少 3 个字符')
      .max(30, '用户名最多 30 个字符')
      .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
    email: z.string().email(t('auth.form.email.placeholder')),
    password: z.string()
      .min(6, '密码至少 6 个字符')
      .max(100, '密码最多 100 个字符')
      .regex(/[a-z]/, '密码必须包含小写字母')
      .regex(/[A-Z]/, '密码必须包含大写字母')
      .regex(/\d/, '密码必须包含数字')
      .regex(/[^a-zA-Z0-9]/, '密码必须包含特殊字符'),
    confirmPassword: z.string(),
    agree: z.boolean().refine(val => val === true, {
      message: t('auth.form.agree')
    }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('common.error'),
    path: ['confirmPassword'],
  });

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      agree: false,
    }
  });

  const watchAgree = watch('agree');



  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStory((prev) => (prev + 1) % STORIES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      if (!backendReady) {
        throw new Error('当前后端不可用，无法完成注册。');
      }

      const payload = isRustV2Enabled()
        ? { email: values.email, password: values.password, display_name: values.username }
        : values;
      const result = await api.post<any>(
        isRustV2Enabled() ? rustV2Path('/auth/register') : '/auth/register',
        payload,
        isRustV2Enabled() ? rustV2RequestOptions : undefined,
      );
      if (result?.pendingVerification !== true) {
        throw new Error('注册未进入邮箱验证流程，请稍后重试。');
      }
      toast({ 
        title: t('auth.register.submit'), 
        description: '邮箱验证码已发送，请完成最后一步验证。'
      });
      navigate(`/verify-code?email=${encodeURIComponent(values.email)}`);
    } catch (err: any) {
      console.error('Registration failed:', err);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: err.message || 'Identity initialization failed. Node may already exist or link is unstable.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={pageRef} className="min-h-[calc(100dvh-5rem)] flex flex-col lg:flex-row bg-[#f7f7f4] selection:bg-accent selection:text-white">
      {/* Visual Side: Cinematic Black */}
      <aside className="hidden lg:flex lg:w-[44%] bg-[#0b0c0e] px-12 py-10 xl:px-16 xl:py-14 flex-col justify-between relative overflow-hidden">
        <div className="relative z-20 space-y-16 xl:space-y-20">
          <Link data-register-brand to="/" className="flex items-center gap-4 group w-fit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
             <div className="w-11 h-11 bg-[#f7f7f4] rounded-xl flex items-center justify-center group-hover:-translate-y-0.5 transition-transform duration-300 shadow-xl shadow-black/20">
                <GeometricLantern variant="spark" className="w-6 h-6 text-black fill-current" />
             </div>
             <div className="flex flex-col -space-y-1">
                <span className="font-black tracking-tighter text-3xl text-white uppercase italic">{t('admin.title')}.</span>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic leading-none">Minecraft 服务器平台</span>
             </div>
          </Link>

          <div data-register-story className="space-y-9 max-w-xl">
             <AnimatePresence mode="wait">
                <motion.div 
                   key={activeStory}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                   transition={{ duration: 0.8, ease: "circOut" }}
                   className="space-y-6"
                >
                   <div className="flex items-center gap-4">
                      <div className="px-4 py-2 border border-zinc-800 bg-zinc-900/50 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 italic">
                         {currentStory.badge}
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                         <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">轮播中</span>
                      </div>
                   </div>
                   <h2 className="text-4xl xl:text-6xl font-black tracking-[-0.055em] leading-[0.96] text-white text-balance break-words">
                      {t(currentStory.titleKey)}
                   </h2>
                   <p className="text-zinc-400 text-base xl:text-lg font-medium leading-relaxed border-l border-zinc-700 pl-6 max-w-lg text-pretty">
                      {t(currentStory.descKey)}
                   </p>
                </motion.div>
             </AnimatePresence>

             <div className="flex gap-3">
                {STORIES.map((_, i) => (
                  <button 
                    type="button"
                    key={i} 
                 onClick={() => setActiveStory(i)}
                    aria-label={`查看注册提示 ${i + 1}`}
                    aria-current={i === activeStory ? 'true' : undefined}
                    className={`h-1.5 rounded-full transition-all duration-1000 ${i === activeStory ? 'w-24 bg-accent shadow-accent' : 'w-6 bg-zinc-900 hover:bg-zinc-800'}`} 
                  />
                ))}
             </div>
          </div>
        </div>

        <div className="relative z-20 pt-8 border-t border-zinc-800/80">
           <div className="p-6 bg-white/[0.035] border border-white/[0.07] rounded-2xl space-y-4 group hover:border-accent/50 transition-colors duration-300">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <GeometricLantern variant="security" className="w-5 h-5 text-zinc-400 group-hover:text-accent transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic leading-none">注册与邮箱校验</span>
                 </div>
                 <GeometricLantern variant="data" className="w-4 h-4 text-zinc-800" />
              </div>
              <p className="text-[12px] text-zinc-500 font-medium leading-relaxed italic max-w-sm">
                注册后会立即发送邮箱验证码，完成验证后即可发布服务器和提交工单。
              </p>
           </div>
        </div>

        {/* High-Fidelity Background Elements */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-accent/5 blur-[160px] rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '48px 48px' }} />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      </aside>

      {/* Form Side: Industrial Minimalist */}
      <main className="flex-grow flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12 xl:px-20 relative overflow-y-auto">
        <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none lg:block hidden">
           <GeometricLantern variant="spark" className="w-96 h-96 rotate-12" />
        </div>
        
        <div data-register-form className="w-full max-w-lg space-y-8 relative z-10">
          <header className="space-y-4">
            <div className="w-16 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl lg:hidden mb-12 animate-float">
               <GeometricLantern variant="spark" className="w-8 h-8 fill-current" />
            </div>
            <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] italic">创建账号</div>
               <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-100" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.055em] leading-none text-zinc-950 text-balance">{t('auth.register.title')}</h1>
            <p className="text-zinc-500 font-medium text-sm sm:text-base leading-7 max-w-md text-pretty">
               {t('auth.register.subtitle')}
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-5">
               <div className="space-y-3">
                  <label htmlFor="register-username" className="text-xs font-semibold tracking-wide text-zinc-600">{t('auth.form.username.label')}</label>
                  <div className="relative group">
                     <GeometricLantern variant="user" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-accent transition-colors duration-200" />
                     <input
                       id="register-username"
                       {...register('username')}
                       autoComplete="username"
                       autoFocus
                       className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-[border-color,box-shadow] duration-200 outline-hidden font-semibold text-base shadow-xs"
                       placeholder={t('auth.form.username.placeholder')}
                     />
                  </div>
                  <AnimatePresence>
                    {errors.username && (
                      <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-8 italic">
                         // ERROR: {errors.username.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
               </div>

               <div className="space-y-3">
                  <label htmlFor="register-email" className="text-xs font-semibold tracking-wide text-zinc-600">{t('auth.form.email.label')}</label>
                  <div className="relative group">
                     <GeometricLantern variant="terminal" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-accent transition-colors duration-200" />
                     <input
                       id="register-email"
                       {...register('email')}
                       type="email"
                       autoComplete="email"
                       className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-[border-color,box-shadow] duration-200 outline-hidden font-semibold text-base shadow-xs"
                       placeholder={t('auth.form.email.placeholder')}
                     />
                  </div>
                  <AnimatePresence>
                    {errors.email && (
                      <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-8 italic">
                         // ERROR: {errors.email.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3">
                     <label htmlFor="register-password" className="text-xs font-semibold tracking-wide text-zinc-600">{t('auth.form.password.label')}</label>
                     <input
                       id="register-password"
                       {...register('password')}
                       type="password"
                       autoComplete="new-password"
                       className="w-full px-4 py-4 bg-white border border-zinc-200 focus:border-accent focus:ring-4 focus:ring-accent/10 rounded-xl font-semibold text-base outline-hidden transition-[border-color,box-shadow] duration-200 shadow-xs"
                       placeholder="••••••••"
                     />
                     <AnimatePresence>
                        {errors.password && (
                          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[9px] font-black text-red-500 uppercase tracking-tighter italic">
                             {errors.password.message}
                          </motion.p>
                        )}
                     </AnimatePresence>
                  </div>
                  <div className="space-y-3">
                     <label htmlFor="register-confirm-password" className="text-xs font-semibold tracking-wide text-zinc-600">确认密码</label>
                     <input
                       id="register-confirm-password"
                       {...register('confirmPassword')}
                       type="password"
                       autoComplete="new-password"
                       className="w-full px-4 py-4 bg-white border border-zinc-200 focus:border-accent focus:ring-4 focus:ring-accent/10 rounded-xl font-semibold text-base outline-hidden transition-[border-color,box-shadow] duration-200 shadow-xs"
                       placeholder="••••••••"
                     />
                     <AnimatePresence>
                        {errors.confirmPassword && (
                          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[9px] font-black text-red-500 uppercase tracking-tighter italic">
                             {errors.confirmPassword.message}
                          </motion.p>
                        )}
                     </AnimatePresence>
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-4 py-1 group relative select-none">
               <input type="hidden" {...register('agree')} />
               <button 
                 type="button"
                 onClick={() => {
                   const nextValue = !watchAgree;
                   setValue('agree', nextValue, { shouldValidate: true, shouldDirty: true });
                 }}
                 className="flex items-center gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
               >
                  <div className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${watchAgree ? 'bg-accent border-accent' : 'border-zinc-300'}`}>
                     <GeometricLantern variant="spark" className={`w-4 h-4 text-white transition-opacity ${watchAgree ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                  <span className="text-[11px] text-zinc-400 font-black leading-relaxed uppercase tracking-widest italic group-hover:text-zinc-600 transition-colors text-left">
                    我已阅读并同意平台《系统协议》
                  </span>
               </button>
               <Link to="/terms" className="text-[11px] text-black font-black underline underline-offset-8 decoration-zinc-100 hover:decoration-accent transition-all">
                 {t('nav.rules')}
               </Link>
            </div>

            <div className="pt-6">
              <button 
                type="submit"
                disabled={loading || !watchAgree}
                className="w-full py-4 btn-accent rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)] group active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-white/50" /> : <>{t('auth.register.submit')} <ChevronRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" /></>}
              </button>
            </div>

            {errors.agree && (
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-14 italic leading-none">
                 // {errors.agree.message}
              </p>
            )}
          </form>

          <footer className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
             <div className="flex items-center gap-4">
                <GeometricLantern variant="terminal" className="w-5 h-5 text-zinc-100" />
                <div className="flex flex-col">
                   <span className="text-[10px] font-black text-zinc-200 uppercase tracking-widest italic leading-none break-words">{t('auth.form.username.label')} 状态</span>
                   <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest italic break-words">初始化阶段：1</span>
                </div>
             </div>
             <Link 
               to="/login" 
               className="group flex items-center gap-6 px-10 py-5 bg-zinc-50 border border-zinc-100 rounded-[2rem] hover:bg-black hover:text-white transition-all duration-700 shadow-xs"
             >
                <div className="flex flex-col items-end">
                   <span className="text-[9px] font-black text-zinc-300 group-hover:text-zinc-500 uppercase tracking-widest italic leading-none">{t('auth.form.has_node')}</span>
                   <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">{t('auth.form.init_login')}</span>
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

export default Register;
