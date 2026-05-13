import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Zap, Globe, Cpu, ChevronRight, X } from 'lucide-react';
import GeometricLantern from '@/components/icons/GeometricLantern';
import { useT } from '@/store/uiStore';
import { api } from '@/api/request';

const ServerPortal: React.FC = () => {
  const { uuid } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const t = useT();
  
  const [status, setStatus] = useState<'initializing' | 'authenticating' | 'granted' | 'denied'>('initializing');
  const [server, setServer] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate high-fidelity handshake process
    const sequence = async () => {
      // Step 1: Initializing
      await new Promise(r => setTimeout(r, 800));
      setProgress(25);
      setStatus('authenticating');

      // Step 2: Authenticate with token
      try {
        await new Promise(r => setTimeout(r, 1500));
        setProgress(60);

        if (!token || token === 'invalid') {
          throw new Error('ACCESS_DENIED');
        }

        const data = await api.get<any>(`/public/servers/${uuid}`);
        setServer(data);
        setProgress(100);
        setStatus('granted');
      } catch (err) {
        setStatus('denied');
      }
    };

    sequence();
  }, [uuid, token]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-accent selection:text-white flex flex-col items-center justify-center p-12 relative overflow-hidden">
      {/* Background Cinematic Elements */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-accent/20 blur-[180px] rounded-full animate-pulse" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        <AnimatePresence mode="wait">
          {status === 'initializing' || status === 'authenticating' ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-12"
            >
              <div className="space-y-4">
                 <div className="w-24 h-24 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center mx-auto mb-8 relative group">
                    <GeometricLantern variant="spark" className="w-10 h-10 text-accent animate-spin-slow" />
                    <div className="absolute inset-0 rounded-[2rem] border-2 border-accent/20 animate-ping" />
                 </div>
                 <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter uppercase italic break-words">握手初始化中...</h1>
                 <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-[10px] italic break-words">协议：安全深层链接 v4.2</p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-accent shadow-[0_0_15px_rgba(var(--ui-accent-rgb),0.5)] transition-all duration-500"
                    />
                 </div>
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-zinc-600 italic">
                    <span>{t('portal.authenticating')}</span>
                    <span>{progress}%</span>
                 </div>
              </div>
            </motion.div>
          ) : status === 'granted' ? (
            <motion.div 
              key="granted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12"
            >
              <div className="flex flex-col lg:flex-row gap-12">
                 {/* Left: Identity Card */}
                 <div className="lg:w-1/3 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[4rem] p-12 space-y-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                       <GeometricLantern variant="security" className="w-32 h-32" />
                    </div>
                    
                    <div className="space-y-6">
                       <div className="px-4 py-1 bg-accent text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-sm italic w-fit">
                          {t('portal.status.granted')}
                       </div>
                       <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic leading-none break-words">{server?.name}</h2>
                       <div className="flex items-center gap-4 text-zinc-500 text-[10px] font-black uppercase tracking-widest italic">
                          <ShieldCheck className="w-4 h-4 text-green-500" /> {t('portal.status.secure')}
                       </div>
                    </div>

                    <div className="space-y-6 pt-10 border-t border-white/5">
                       <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-zinc-600 uppercase italic">端点 IP</span>
                          <span className="text-sm font-bold font-mono italic">{server?.ip}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-zinc-600 uppercase italic">版本号</span>
                          <span className="text-sm font-bold font-mono italic">{server?.version}</span>
                       </div>
                    </div>

                    <button className="w-full py-6 bg-white text-black rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] hover:bg-accent hover:text-white transition-all italic active:scale-95 shadow-2xl">
                       初始化加入
                    </button>
                 </div>

                 {/* Right: Technical Diagnostics */}
                 <div className="flex-grow space-y-12 py-8">
                    <header className="space-y-2">
                       <div className="flex items-center gap-4">
                          <Zap className="w-5 h-5 text-accent" />
                          <h3 className="text-[11px] font-black uppercase tracking-[0.6em] text-zinc-500 italic leading-none">{t('portal.diag.stream')}</h3>
                       </div>
                       <p className="text-lg text-zinc-400 font-bold italic leading-relaxed">
                          您的身份矩阵已成功映射至节点集群 #{uuid?.slice(0, 8)}。
                       </p>
                    </header>

                    <div className="grid grid-cols-2 gap-8">
                       {[
                         { label: t('portal.diag.latency'), value: '14MS', icon: <Globe className="w-4 h-4" /> },
                         { label: t('portal.diag.load'), value: server?.load, icon: <Cpu className="w-4 h-4" /> },
                         { label: t('portal.diag.security'), value: server?.security, icon: <ShieldCheck className="w-4 h-4" /> },
                         { label: t('portal.diag.uptime'), value: server?.uptime, icon: <GeometricLantern variant="activity" className="w-4 h-4" /> },
                       ].map(item => (
                         <div key={item.label} className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] space-y-4 group hover:bg-white/[0.05] transition-all duration-500">
                            <div className="flex items-center justify-between">
                               <div className="p-3 bg-white/5 rounded-xl text-zinc-500 group-hover:text-accent transition-colors">{item.icon}</div>
                               <span className="text-xl font-black font-mono italic text-white">{item.value}</span>
                            </div>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">{item.label}</p>
                         </div>
                       ))}
                    </div>

                    <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                       <div className="flex items-center gap-4 text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {t('portal.diag.tunnel')}
                       </div>
                       <Link to="/servers" className="text-[10px] font-black text-zinc-400 hover:text-white uppercase tracking-widest transition-colors italic flex items-center gap-2 break-words">
                          {t('portal.diag.terminate')} <X className="w-4 h-4" />
                       </Link>
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="denied"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-12"
            >
              <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] border border-red-500/20 flex items-center justify-center mx-auto relative">
                 <GeometricLantern variant="alert" className="w-10 h-10 text-red-500" />
                 <div className="absolute inset-0 rounded-[2rem] border-2 border-red-500/20 animate-ping" />
              </div>
              <div className="space-y-4">
                 <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black tracking-tighter uppercase italic text-red-500 break-words">{t('portal.status.denied')}</h1>
                 <p className="text-zinc-500 text-base sm:text-lg lg:text-xl font-bold italic max-w-lg mx-auto break-words">
                    {t('portal.status.invalid_token')}
                 </p>
              </div>
              <Link 
                to="/servers" 
                className="inline-flex items-center gap-6 px-16 py-8 bg-white text-black rounded-[3rem] font-black text-[12px] uppercase tracking-[0.5em] hover:bg-red-500 hover:text-white transition-all italic active:scale-95"
              >
                 {t('portal.action.return')} <ChevronRight className="w-5 h-5" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Footer */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-10 flex items-center gap-12">
         <GeometricLantern variant="terminal" className="w-5 h-5" />
         <div className="w-32 h-[1px] bg-white" />
         <span className="text-[10px] font-black uppercase tracking-[0.6em] italic">{t('portal.footer.ver')}</span>
         <div className="w-32 h-[1px] bg-white" />
         <GeometricLantern variant="network" className="w-5 h-5" />
      </div>
    </div>
  );
};

export default ServerPortal;
