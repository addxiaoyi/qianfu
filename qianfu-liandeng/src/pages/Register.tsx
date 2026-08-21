import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Check, ChevronRight, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
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
  const storyRef = useRef<HTMLDivElement>(null);

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

  useGSAP(() => {
    if (!storyRef.current) return;
    gsap.fromTo(
      storyRef.current,
      { autoAlpha: 0, x: -14 },
      { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power3.out', clearProps: 'opacity,visibility,transform' },
    );
  }, { scope: pageRef, dependencies: [activeStory] });

  const currentStory = STORIES[activeStory];

  const registerSchema = z.object({
    username: z.string()
      .min(3, '用户名至少 3 个字符')
      .max(30, '用户名最多 30 个字符')
      .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
    email: z.string().email('请输入有效的邮箱地址'),
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
    message: '两次输入的密码不一致',
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
  const watchedPassword = watch('password');
  const passwordRules = [
    { label: '至少 6 个字符', met: watchedPassword.length >= 6 },
    { label: '包含大小写字母', met: /[a-z]/.test(watchedPassword) && /[A-Z]/.test(watchedPassword) },
    { label: '包含数字和特殊字符', met: /\d/.test(watchedPassword) && /[^a-zA-Z0-9]/.test(watchedPassword) },
  ];



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
    <div ref={pageRef} className="min-h-[calc(100dvh-5rem)] bg-white selection:bg-accent selection:text-white lg:grid lg:grid-cols-[minmax(19rem,0.72fr)_minmax(32rem,1.28fr)]">
      <aside className="relative hidden overflow-hidden bg-zinc-950 px-10 py-10 lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-12">
        <div className="relative z-20 space-y-16 xl:space-y-20">
          <Link data-register-brand to="/" className="flex items-center gap-4 group w-fit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
             <div className="w-11 h-11 bg-[#f7f7f4] rounded-xl flex items-center justify-center group-hover:-translate-y-0.5 transition-transform duration-300 shadow-xl shadow-black/20">
                <GeometricLantern variant="spark" className="w-6 h-6 text-black fill-current" />
             </div>
             <div className="flex flex-col -space-y-1">
                <span className="text-xl font-semibold tracking-tight text-white">{t('admin.title')}</span>
                <span className="text-xs text-zinc-500">Minecraft 服务器平台</span>
             </div>
          </Link>

          <div data-register-story className="max-w-md space-y-9">
                <div ref={storyRef} key={activeStory} className="space-y-6">
                   <div className="flex items-center gap-4">
                      <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300">
                         {currentStory.badge}
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                         <span className="text-xs text-zinc-500">平台能力</span>
                      </div>
                   </div>
                   <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
                      {t(currentStory.titleKey)}
                   </h2>
                   <p className="text-zinc-400 text-base xl:text-lg font-medium leading-relaxed border-l border-zinc-700 pl-6 max-w-lg text-pretty">
                      {t(currentStory.descKey)}
                   </p>
                </div>

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

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-black to-transparent" />
      </aside>

      <main className="flex items-center justify-center bg-zinc-50 px-5 py-10 sm:px-8 lg:px-12 xl:px-20">
        <div data-register-form className="relative z-10 w-full max-w-xl rounded-[14px] border border-zinc-200 bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,0.07)] sm:p-9 lg:p-10">
          <header data-ui-reveal className="mb-8 space-y-3">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-[10px] bg-black text-white lg:hidden">
               <GeometricLantern variant="spark" className="w-8 h-8 fill-current" />
            </div>
            <div className="text-sm font-medium text-blue-700">创建免费账号</div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{t('auth.register.title')}</h1>
            <p className="text-zinc-500 font-medium text-sm sm:text-base leading-7 max-w-md text-pretty">
               {t('auth.register.subtitle')}
            </p>
          </header>

          <form data-ui-reveal onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-5">
               <div className="space-y-3">
                  <label htmlFor="register-username" className="text-xs font-semibold tracking-wide text-zinc-600">用户名</label>
                  <div className="relative group">
                     <UserRound aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                     <input
                       id="register-username"
                       {...register('username')}
                       autoComplete="username"
                       autoFocus
                       className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-[border-color,box-shadow] duration-200 outline-hidden font-semibold text-base shadow-xs"
                       placeholder="3-30 个字符"
                     />
                  </div>
                    {errors.username ? (
                      <p role="alert" className="text-sm font-medium text-red-600">
                         {errors.username.message}
                      </p>
                    ) : null}
               </div>

               <div className="space-y-3">
                  <label htmlFor="register-email" className="text-xs font-semibold tracking-wide text-zinc-600">{t('auth.form.email.label')}</label>
                  <div className="relative group">
                     <Mail aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                     <input
                       id="register-email"
                       {...register('email')}
                       type="email"
                       autoComplete="email"
                       className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-[border-color,box-shadow] duration-200 outline-hidden font-semibold text-base shadow-xs"
                       placeholder={t('auth.form.email.placeholder')}
                     />
                  </div>
                    {errors.email ? (
                      <p role="alert" className="text-sm font-medium text-red-600">
                         {errors.email.message}
                      </p>
                    ) : null}
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-3">
                     <label htmlFor="register-password" className="text-xs font-semibold tracking-wide text-zinc-600">{t('auth.form.password.label')}</label>
                     <div className="relative"><LockKeyhole aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" /><input
                       id="register-password"
                       {...register('password')}
                       type="password"
                       autoComplete="new-password"
                       className="w-full rounded-xl border border-zinc-200 bg-white py-4 pl-12 pr-4 text-base font-semibold shadow-xs outline-hidden focus:border-accent focus:ring-4 focus:ring-accent/10"
                       placeholder="••••••••"
                     /></div>
                        {errors.password ? (
                          <p role="alert" className="text-sm font-medium text-red-600">
                             {errors.password.message}
                          </p>
                        ) : null}
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
                        {errors.confirmPassword ? (
                          <p role="alert" className="text-sm font-medium text-red-600">
                             {errors.confirmPassword.message}
                          </p>
                        ) : null}
                  </div>
               </div>
               <div className="grid gap-2 rounded-[10px] bg-zinc-50 p-4 sm:grid-cols-3" aria-label="密码要求">
                 {passwordRules.map((rule) => (
                   <span key={rule.label} className={`flex items-center gap-2 text-xs ${rule.met ? 'text-emerald-700' : 'text-zinc-500'}`}>
                     <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{rule.label}
                   </span>
                 ))}
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
                     <Check aria-hidden="true" className={`h-4 w-4 text-white ${watchAgree ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                  <span className="text-left text-sm text-zinc-600">
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
              <p role="alert" className="pl-9 text-sm font-medium text-red-600">
                 {errors.agree.message}
              </p>
            )}
          </form>

          <footer data-ui-reveal className="mt-8 flex flex-col gap-4 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
             <p className="text-sm text-zinc-500">已有账号？直接登录即可继续管理服务器。</p>
             <Link 
               to="/login" 
               className="group flex items-center gap-3 rounded-[10px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-black hover:text-white"
             >
                <span>去登录</span>
                <ChevronRight className="h-4 w-4" />
             </Link>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Register;
