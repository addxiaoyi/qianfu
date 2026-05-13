import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/api/request';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Loader2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT, type TranslationKey } from '@/store/uiStore';

const STORIES: { id: string; badge: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  {
    id: 'philosophy',
    badge: 'CORE_VALUES / ALPHA',
    titleKey: 'auth.story.4.title',
    descKey: 'auth.story.4.desc',
  },
  {
    id: 'ecosystem',
    badge: 'NODE_TRUST / BETA',
    titleKey: 'auth.story.5.title',
    descKey: 'auth.story.5.desc',
  },
];

const Register: React.FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [activeStory, setActiveStory] = useState(0);
  const [agree, setAgree] = useState(false);
  const backendReady = useAuthStore((state) => state.backendReady);
  const navigate = useNavigate();

  const currentStory = STORIES[activeStory];

  const registerSchema = z.object({
    username: z.string().min(3, t('auth.username') + ' min 3 chars'),
    email: z.string().email(t('auth.form.email.placeholder')),
    password: z.string().min(6, t('auth.password') + ' min 6 chars'),
    confirmPassword: z.string(),
    agree: z.boolean().refine(val => val === true, {
      message: t('auth.form.agree')
    }),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('common.error'),
    path: ['confirmPassword'],
  });

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    }
  });



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

      await api.post('/auth/register', values);
      toast({ 
        title: t('auth.register.submit'), 
        description: 'Activation protocol sent to your communication node.' 
      });
      navigate('/verify-code');
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-white selection:bg-accent selection:text-white">
      {/* Visual Side: Cinematic Black */}
      <aside className="hidden lg:flex lg:w-[48%] bg-black p-24 flex-col justify-between relative overflow-hidden shadow-2xl shadow-black/50">
        <div className="relative z-20 space-y-32">
          <Link to="/" className="flex items-center gap-4 group">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all duration-700 shadow-xl shadow-white/5">
                <GeometricLantern variant="spark" className="w-6 h-6 text-black fill-current" />
             </div>
             <div className="flex flex-col -space-y-1">
                <span className="font-black tracking-tighter text-3xl text-white uppercase italic">{t('admin.title')}.</span>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic leading-none">全球网络矩阵</span>
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
                         <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">同步中</span>
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
                    key={i} 
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
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic leading-none">安全协议 v4.0</span>
                 </div>
                 <GeometricLantern variant="data" className="w-4 h-4 text-zinc-800" />
              </div>
              <p className="text-[12px] text-zinc-500 font-medium leading-relaxed italic max-w-sm">
                数据经过端到端加密存储，仅由您本人通过安全令牌访问。所有节点注册均经过多重熵校验以确保身份唯一性。
              </p>
           </div>
        </div>

        {/* High-Fidelity Background Elements */}
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-accent/5 blur-[160px] rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '48px 48px' }} />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      </aside>

      {/* Form Side: Industrial Minimalist */}
      <main className="flex-grow flex items-center justify-center p-12 md:p-24 lg:p-40 relative overflow-y-auto">
        <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none lg:block hidden">
           <GeometricLantern variant="spark" className="w-96 h-96 rotate-12" />
        </div>
        
        <div className="w-full max-w-lg space-y-20 relative z-10 py-12">
          <header className="space-y-6">
            <div className="w-16 h-16 bg-black text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl lg:hidden mb-12 animate-float">
               <GeometricLantern variant="spark" className="w-8 h-8 fill-current" />
            </div>
            <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-zinc-50 border border-zinc-100 rounded-sm text-[10px] font-black uppercase tracking-[0.3em] italic">初始化握手节点</div>
               <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-100" />
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tighter uppercase italic leading-none break-words">{t('auth.register.title')}.</h1>
            <p className="text-zinc-400 font-bold text-base sm:text-lg lg:text-xl leading-relaxed italic max-w-md break-words">
               {t('auth.register.subtitle')}
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
            <div className="space-y-8">
               <div className="space-y-3">
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">{t('auth.form.username.label')}</label>
                  <div className="relative group">
                     <GeometricLantern variant="user" className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
                     <input
                       {...register('username')}
                       autoFocus
                       className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-lg italic tracking-tight shadow-xs"
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
                  <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">{t('auth.form.email.label')}</label>
                  <div className="relative group">
                     <GeometricLantern variant="terminal" className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-100 group-focus-within:text-accent transition-all duration-500" />
                     <input
                       {...register('email')}
                       type="email"
                       className="w-full pl-20 pr-8 py-7 bg-zinc-50/50 border border-transparent rounded-[2.5rem] focus:bg-white focus:border-accent transition-all duration-500 outline-hidden font-black text-lg italic tracking-tight shadow-xs"
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

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">{t('auth.form.password.label')}</label>
                     <input
                       {...register('password')}
                       type="password"
                       className="w-full px-8 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[2.5rem] font-black text-lg outline-hidden transition-all duration-500 shadow-xs"
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
                     <label className="text-[10px] font-black font-mono uppercase tracking-[0.4em] text-zinc-300 italic">{t('admin.review')}</label>
                     <input
                       {...register('confirmPassword')}
                       type="password"
                       className="w-full px-8 py-7 bg-zinc-50/50 border border-transparent focus:bg-white focus:border-accent rounded-[2.5rem] font-black text-lg outline-hidden transition-all duration-500 shadow-xs"
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

            <div className="flex items-center gap-6 py-4 group relative select-none">
               <input type="hidden" {...register('agree')} />
               <button 
                 type="button"
                 onClick={() => setAgree(!agree)}
                 className="flex items-center gap-6 cursor-pointer"
               >
                  <div className={`w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center ${agree ? 'bg-accent border-accent' : 'border-zinc-300'}`}>
                     <GeometricLantern variant="spark" className={`w-4 h-4 text-white transition-opacity ${agree ? 'opacity-100' : 'opacity-0'}`} />
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
                disabled={loading || !agree}
                className="w-full py-8 btn-accent rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.6em] transition-all flex items-center justify-center gap-6 shadow-2xl group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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

          <footer className="pt-16 border-t border-zinc-50 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
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
