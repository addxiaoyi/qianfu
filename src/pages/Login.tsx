import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api, ApiError, setLocalAuthToken } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronRight, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/ui/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';
import { beginGitHubOAuthLogin, fetchOAuthStatus, type OAuthStatusPayload } from '@/auth/githubOAuth';
import { normalizeUser } from '@/utils/user';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

const Login: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [activeStory, setActiveStory] = useState(0);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatusPayload | null>(null);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('[data-login-brand]', { autoAlpha: 0, y: 18, duration: 0.55 })
        .from('[data-login-story]', { autoAlpha: 0, y: 28, duration: 0.7 }, '<0.1')
        .from('[data-login-form]', { autoAlpha: 0, x: 24, duration: 0.65 }, '<0.05');
    });
    return () => media.revert();
  }, { scope: pageRef });

  const STORIES: { id: string; badge: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
    {
      id: 'redstone',
      badge: '玩法经验 / REDSTONE',
      titleKey: 'auth.story.1.title',
      descKey: 'auth.story.1.desc',
    },
    {
      id: 'villager',
      badge: '服务器运营 / TRADE',
      titleKey: 'auth.story.2.title',
      descKey: 'auth.story.2.desc',
    },
    {
      id: 'nether',
      badge: '世界联通 / NETHER',
      titleKey: 'auth.story.3.title',
      descKey: 'auth.story.3.desc',
    },
  ];

  const currentStory = STORIES[activeStory];

  const loginSchema = z.object({
    identifier: z.string().min(1, t('auth.form.username.placeholder')),
    password: z.string().min(1, t('auth.form.password.placeholder')),
    agree: z.boolean().refine(val => val === true, {
      message: t('auth.form.agree')
    }),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      agree: false
    }
  });

  const watchAgree = watch('agree');

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStory((prev) => (prev + 1) % STORIES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [STORIES.length]);

  useEffect(() => {
    void fetchOAuthStatus()
      .then(setOauthStatus)
      .catch(() => {
        setOauthStatus(null);
      });
  }, []);

  const handleGitHubLogin = () => {
    void (async () => {
      setOauthLoading(true);
      try {
        const status = oauthStatus || (await fetchOAuthStatus());
        if (!status.providers.github.backendEnabled) {
          toast({
            variant: 'destructive',
            title: 'GitHub 登录未配置',
            description: '服务器端 GitHub OAuth 还未启用，请先完成后端 provider 配置。',
          });
          return;
        }
        await beginGitHubOAuthLogin(status);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'GitHub 登录初始化失败',
          description: error instanceof Error ? error.message : 'OAuth bootstrap failed',
        });
      } finally {
        setOauthLoading(false);
      }
    })();
  };

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    try {
      const payload = {
        identifier: data.identifier,
        password: data.password,
      };

      const result = await api.post<any>(
        isRustV2Enabled() ? rustV2Path('/auth/login') : '/auth/login',
        payload,
        isRustV2Enabled() ? rustV2RequestOptions : undefined,
      );
      const authResult = result as Record<string, unknown>;
      const user = normalizeUser(authResult.user ?? result);
      const token = typeof authResult.token === 'string' ? authResult.token : null;
      if (!user) {
        throw new Error('登录响应缺少用户信息');
      }

      if (!user.email_verified) {
        navigate(`/verify-code?email=${encodeURIComponent(user.email)}`);
        return;
      }

      if (token) {
        setLocalAuthToken(token);
      }
      setUser(user);
      toast({
        title: t('auth.status.granted'),
        description: t('auth.status.granted_desc').replace('{user}', user.username),
      });
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err instanceof ApiError && err.data?.error?.code === 'EMAIL_NOT_VERIFIED') {
        toast({
          variant: 'destructive',
          title: '请先完成邮箱验证',
          description: '该账号尚未完成邮箱验证，请前往验证码页面。',
        });
        navigate(`/verify-code?email=${encodeURIComponent(data.identifier)}`);
        return;
      }

      if (err instanceof ApiError && err.status === 502) {
        toast({
          variant: 'destructive',
          title: '后端登录服务未就绪',
          description: '登录接口暂时不可用，请稍后再试。',
        });
        return;
      }

      toast({
        variant: 'destructive',
        title: '登录失败',
        description: err.message || 'Identity verification failed. Please check your credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={pageRef} className="min-h-[calc(100dvh-5rem)] flex flex-col lg:flex-row bg-zinc-50 selection:bg-accent selection:text-white">
      {/* Visual Side: Cinematic Black */}
      <aside className="relative hidden overflow-hidden bg-zinc-950 px-10 py-10 lg:flex lg:w-[34%] lg:flex-col lg:justify-between xl:px-12">
        <div className="relative z-20 space-y-16 xl:space-y-20">
          <Link data-login-brand to="/" className="flex items-center gap-4 group w-fit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
             <div className="w-11 h-11 bg-[#f7f7f4] rounded-xl flex items-center justify-center group-hover:-translate-y-0.5 transition-transform duration-300 shadow-xl shadow-black/20">
                <GeometricLantern variant="spark" className="w-6 h-6 text-black fill-current" />
             </div>
             <div className="flex flex-col -space-y-1">
                <span className="text-xl font-semibold tracking-tight text-white">{t('admin.title')}</span>
                <span className="text-xs text-zinc-500">Minecraft 服务器平台</span>
             </div>
          </Link>

          <div data-login-story className="space-y-9 max-w-xl">
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
                   <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
                      {t(currentStory.titleKey)}
                   </h2>
                   <p className="text-zinc-400 text-base xl:text-lg font-medium leading-relaxed border-l border-zinc-700 pl-6 max-w-lg text-pretty">
                      {t(currentStory.descKey)}
                   </p>
                </motion.div>
             </AnimatePresence>

             <div className="flex gap-3">
                 {STORIES.map((story, i) => (
                   <button 
                    type="button"
                    key={story.id} 
                    onClick={() => setActiveStory(i)}
                    aria-label={`查看登录提示 ${i + 1}`}
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
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic leading-none">登录安全保障</span>
                 </div>
                 <GeometricLantern variant="data" className="w-4 h-4 text-zinc-800" />
              </div>
              <p className="text-[12px] text-zinc-500 font-medium leading-relaxed italic max-w-sm">
                账号登录、验证码和会话通过安全连接传输，异常请求会进入平台风控检查。
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
        
        <div data-login-form className="w-full max-w-md space-y-8 relative z-10">
          <header className="space-y-4">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-[10px] bg-black text-white lg:hidden">
               <GeometricLantern variant="spark" className="w-8 h-8 fill-current" />
            </div>
            <div className="flex items-center gap-4">
               <div className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">登录入口</div>
               <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-100" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{t('auth.login.title')}</h1>
            <p className="text-zinc-500 font-medium text-sm sm:text-base leading-7 max-w-md text-pretty">
               {t('auth.login.subtitle')}
            </p>

            <button
              type="button"
              onClick={handleGitHubLogin}
              disabled={oauthLoading}
              className="w-full mt-5 py-4 rounded-xl bg-zinc-900 text-white font-semibold text-sm hover:bg-zinc-800 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-all flex items-center justify-center gap-3 shadow-[0_12px_32px_rgba(24,24,27,0.16)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {oauthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {oauthLoading ? '初始化 GitHub 登录…' : '使用 GitHub 登录'}
            </button>

          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-5">
               <div className="space-y-3">
                  <label htmlFor="login-identifier" className="text-xs font-semibold tracking-wide text-zinc-600">{t('auth.form.username.label')}</label>
                  <div className="relative group">
                     <GeometricLantern variant="user" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-accent transition-colors duration-200" />
                     <input
                       id="login-identifier"
                       {...register('identifier')}
                       autoComplete="username"
                       autoFocus
                       className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-[border-color,box-shadow] duration-200 outline-hidden font-semibold text-base shadow-xs"
                       placeholder={t('auth.form.username.placeholder')}
                     />
                  </div>
                  <AnimatePresence>
                    {errors.identifier && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-red-600">
                         {errors.identifier.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
               </div>

               <div className="space-y-3">
                  <div className="flex justify-between items-center px-2">
                     <label htmlFor="login-password" className="text-xs font-semibold tracking-wide text-zinc-600">{t('auth.form.password.label')}</label>
                     <Link to="/forgot-password" className="px-2 text-xs font-medium text-zinc-500 hover:text-black">{t('auth.form.recovery')}</Link>
                  </div>
                  <div className="relative group">
                     <GeometricLantern variant="security" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300 group-focus-within:text-accent transition-colors duration-200" />
                     <input
                       id="login-password"
                       {...register('password')}
                       type="password"
                       autoComplete="current-password"
                       className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-xl focus:border-accent focus:ring-4 focus:ring-accent/10 transition-[border-color,box-shadow] duration-200 outline-hidden font-semibold text-base shadow-xs"
                       placeholder={t('auth.form.password.placeholder')}
                     />
                  </div>
                  <AnimatePresence>
                    {errors.password && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-red-600">
                         {errors.password.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
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
                  <span className="text-left text-sm text-zinc-600">
                    {t('auth.form.agree_prefix')}
                  </span>
               </button>
               <Link to="/terms" className="text-[11px] text-black font-black underline underline-offset-8 decoration-zinc-100 hover:decoration-accent transition-all">
                 {t('auth.form.terms')}
               </Link>
               <span className="text-[11px] text-zinc-300">/</span>
               <Link to="/privacy" className="text-[11px] text-black font-black underline underline-offset-8 decoration-zinc-100 hover:decoration-accent transition-all">
                 {t('auth.form.privacy')}
               </Link>
            </div>
               <AnimatePresence>
                 {errors.agree && (
                   <p className="text-sm font-medium text-red-600">
                      {errors.agree.message}
                   </p>
                 )}
               </AnimatePresence>
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 btn-accent rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-3 shadow-[0_14px_36px_rgba(0,0,0,0.16)] group active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-white/50" /> : <>{t('auth.login.submit')} <ChevronRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" /></>}
              </button>
            </div>

          </form>

          <footer className="pt-6 border-t border-zinc-200 flex flex-col gap-4">
             <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   <GeometricLantern variant="terminal" className="w-5 h-5 text-zinc-100" />
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-zinc-200 uppercase tracking-widest italic leading-none">{t('auth.status.guest')}</span>
                      <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest italic">Node Status: Limited</span>
                   </div>
                </div>
                <Link 
                  to="/register" 
                  className="group flex items-center gap-3 rounded-[10px] border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-black hover:text-white"
                >
                   <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-zinc-300 group-hover:text-zinc-500 uppercase tracking-widest italic leading-none">{t('auth.form.new_node')}</span>
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">{t('auth.form.init_reg')}</span>
                   </div>
                   <div className="w-8 h-8 bg-white border border-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-zinc-900 group-hover:border-zinc-800 transition-all duration-700">
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                   </div>
                </Link>
             </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Login;
