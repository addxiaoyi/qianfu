import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api, ApiError, setLocalAuthToken } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronRight, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';
import { beginGitHubOAuthLogin, fetchOAuthStatus, type OAuthStatusPayload } from '@/auth/githubOAuth';
import { normalizeUser } from '@/utils/user';

const Login: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [activeStory, setActiveStory] = useState(0);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<OAuthStatusPayload | null>(null);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

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

      const result = await api.post<any>('/auth/login', payload, { skipCsrf: true });
      const user = normalizeUser((result as any)?.user ?? result);
      const token = (result as any)?.token;
      if (token) {
        setLocalAuthToken(token);
      }
      if (!user) {
        throw new Error('登录响应缺少用户信息');
      }

      setUser(user);
      toast({
        title: t('auth.status.granted'),
        description: t('auth.status.granted_desc').replace('{user}', user.username),
      });

      if (!user.email_verified) {
        navigate(`/verify-code?email=${encodeURIComponent(user.email)}`);
      } else {
        navigate('/dashboard');
      }
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-white selection:bg-accent selection:text-white">
      {/* Visual Side: Cinematic Black */}
      <aside className="hidden lg:flex lg:w-[48%] bg-black p-24 flex-col justify-between relative overflow-hidden shadow-2xl shadow-black/50">
        <div className="relative z-20 space-y-32">
          <Link to="/" className="flex items-center gap-4 group">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all duration-700 shadow-xl shadow-white/5">
                <GeometricLantern variant="spark" className="w-6 h-6 text-black fill-current" />
             </div>
             <div className="flex flex-col -space-y-1">
                <span className="font-black tracking-tighter text-2xl sm:text-3xl text-white uppercase italic">{t('admin.title')}.</span>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic leading-none">Minecraft 服务器平台</span>
             </div>
          </Link>

          <div className="space-y-16 max-w-xl">
             <AnimatePresence mode="wait">
                <motion.div 
                   key={activeStory}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                   transition={{ duration: 0.8, ease: "circOut" }}
                   className="space-y-10"
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
                   <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-none text-white uppercase italic break-words">
                      {t(currentStory.titleKey)}
                   </h2>
                   <p className="text-zinc-500 text-xl font-medium leading-relaxed italic border-l-2 border-zinc-800 pl-8 max-w-lg">
                      "{t(currentStory.descKey)}"
                   </p>
                </motion.div>
             </AnimatePresence>

             <div className="flex gap-3">
                 {STORIES.map((story, i) => (
                   <button 
                    type="button"
                    key={story.id} 
                    onClick={() => setActiveStory(i)}
                    className={`h-1.5 rounded-full transition-all duration-1000 ${i === activeStory ? 'w-24 bg-accent shadow-accent' : 'w-6 bg-zinc-900 hover:bg-zinc-800'}`} 
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
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic leading-none">登录安全保障</span>
                 </div>
                 <GeometricLantern variant="data" className="w-4 h-4 text-zinc-800" />
              </div>
              <p className="text-[12px] text-zinc-500 font-medium leading-relaxed italic max-w-sm">
                账号登录、验证码和会话都经过加密校验，异常登录会被平台风控拦截。
              </p>
           </div>
        </div>

        {/* High-Fidelity Background Elements */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-accent/5 blur-[160px] rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '48px 48px' }} />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      </aside>

      {/* Form Side: Industrial Minimalist */}
      <main className="flex-grow flex items-center justify-center p-5 sm:p-8 md:p-24 lg:p-40 relative overflow-y-auto">
        <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none lg:block hidden">
           <GeometricLantern variant="spark" className="w-96 h-96 rotate-12" />
        </div>
        
        <div className="w-full max-w-lg space-y-12 sm:space-y-16 lg:space-y-20 relative z-10 py-6 sm:py-12">
          <header className="space-y-6">
            <div className="w-16 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl lg:hidden mb-12 animate-float">
               <GeometricLantern variant="spark" className="w-8 h-8 fill-current" />
            </div>
            <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] italic">登录入口</div>
               <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-100" />
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter uppercase italic leading-none break-words">{t('auth.login.title')}.</h1>
            <p className="text-zinc-400 font-bold text-base sm:text-lg lg:text-xl leading-relaxed italic max-w-md">
               {t('auth.login.subtitle')}
            </p>

            <button
              type="button"
              onClick={handleGitHubLogin}
              disabled={oauthLoading}
              className="w-full mt-8 py-5 rounded-[1.5rem] bg-zinc-900 text-white font-black uppercase tracking-[0.35em] text-[10px] hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {oauthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {oauthLoading ? '初始化 GitHub 登录…' : '使用 GitHub 登录'}
            </button>

          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
            <div className="space-y-8">
               <div className="space-y-3">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">{t('auth.form.username.label')}</label>
                  <div className="relative group">
                     <GeometricLantern variant="user" className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
                     <input
                       {...register('identifier')}
                       autoComplete="username"
                       autoFocus
                       className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-lg italic tracking-tight shadow-xs"
                       placeholder={t('auth.form.username.placeholder')}
                     />
                  </div>
                  <AnimatePresence>
                    {errors.identifier && (
                      <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-8 italic">
                         // ERROR: {errors.identifier.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
               </div>

               <div className="space-y-3">
                  <div className="flex justify-between items-center px-2">
                     <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">{t('auth.form.password.label')}</label>
                     <Link to="/forgot-password" className="text-[10px] font-black text-zinc-300 hover:text-black uppercase tracking-widest transition-colors italic px-2">{t('auth.form.recovery')}</Link>
                  </div>
                  <div className="relative group">
                     <GeometricLantern variant="security" className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
                     <input
                       {...register('password')}
                       type="password"
                       autoComplete="current-password"
                       className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-lg italic tracking-tight shadow-xs"
                       placeholder={t('auth.form.password.placeholder')}
                     />
                  </div>
                  <AnimatePresence>
                    {errors.password && (
                      <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-8 italic">
                         // ERROR: {errors.password.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
               </div>
            </div>

            <div className="flex items-center gap-6 py-4 group relative select-none">
               <input type="hidden" {...register('agree')} />
               <button 
                 type="button"
                 onClick={() => {
                   const nextValue = !watchAgree;
                   setValue('agree', nextValue, { shouldValidate: true, shouldDirty: true });
                 }}
                 className="flex items-center gap-6 cursor-pointer"
               >
                  <div className={`w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center ${watchAgree ? 'bg-accent border-accent' : 'border-zinc-300'}`}>
                     <GeometricLantern variant="spark" className={`w-4 h-4 text-white transition-opacity ${watchAgree ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                  <span className="text-[11px] text-zinc-400 font-black leading-relaxed uppercase tracking-widest italic group-hover:text-zinc-600 transition-colors text-left">
                    {t('auth.form.agree')}
                  </span>
               </button>
               <Link to="/terms" className="text-[11px] text-black font-black underline underline-offset-8 decoration-zinc-100 hover:decoration-accent transition-all">
                 {t('nav.rules')}
               </Link>
            </div>
               <AnimatePresence>
                 {errors.agree && (
                   <p className="text-[10px] font-black text-red-500 uppercase tracking-widest pl-14 italic leading-none">
                      // {errors.agree.message}
                   </p>
                 )}
               </AnimatePresence>
            <div className="pt-6">
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-8 btn-accent rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.6em] transition-all flex items-center justify-center gap-6 shadow-2xl group active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-white/50" /> : <>{t('auth.login.submit')} <ChevronRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" /></>}
              </button>
            </div>

          </form>

          <footer className="pt-16 border-t border-zinc-50 flex flex-col gap-4">
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
                  className="group flex items-center gap-4 px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-[1.5rem] hover:bg-black hover:text-white transition-all duration-700 shadow-xs"
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
