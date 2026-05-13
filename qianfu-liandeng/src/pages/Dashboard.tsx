import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Link, useLocation, Routes, Route } from 'react-router-dom';
import MyServers from './MyServers';
import Profile from './Profile';
import TicketList from './TicketList';
import TicketCreate from './TicketCreate';
import Billing from './Billing';
import { motion } from 'framer-motion';
import StatusWrapper from '@/components/StatusWrapper';
import { toast } from '@/hooks/use-toast';
import GeometricLantern from '@/components/icons/GeometricLantern';
import ThreeDHeadShowcase from '@/components/ThreeDHeadShowcase';
import { useT, type TranslationKey } from '@/store/uiStore';
import { api } from '@/api/request';


const Dashboard: React.FC = () => {
  const t = useT();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const isLocked = !!(user && !user.email_verified);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const handleCheckIn = async () => {
     if (checkingIn || checkedIn) return;
     setCheckingIn(true);
     try {
       await api.post('/user/checkin');
       setCheckedIn(true);
       toast({ title: t('auth.status.granted'), description: t('dash.checkin.xp_reward') });
     } catch {
       toast({ title: t('common.error'), description: '签到失败，请稍后再试', variant: 'destructive' });
     } finally {
       setCheckingIn(false);
     }
  };

  const menu: { nameKey: TranslationKey; path: string; variant: any }[] = [
    { nameKey: 'dash.menu.overview', path: '/dashboard', variant: 'spark' },
    { nameKey: 'dash.menu.servers', path: '/dashboard/servers', variant: 'network' },
    { nameKey: 'dash.menu.tickets', path: '/dashboard/tickets', variant: 'activity' },
    { nameKey: 'dash.menu.billing', path: '/dashboard/billing', variant: 'payment' },
    { nameKey: 'dash.menu.profile', path: '/dashboard/profile', variant: 'settings' },
  ];

  const xp = user?.experience_points || 0;
  const progress = xp % 100;

  return (
    <StatusWrapper isLocked={isLocked}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col md:flex-row gap-6 lg:gap-10 min-h-[calc(100vh-200px)] bg-white">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-3 sm:space-y-4">
          <div className="rounded-[1.75rem] border border-zinc-100 bg-white p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
             <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center font-mono text-xl font-black shadow-lg shrink-0">
                   {user?.username?.[0]}
                </div>
                <div className="min-w-0 space-y-1">
                   <div className="font-semibold truncate text-sm text-zinc-900">{user?.username}</div>
                   <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-[0.24em]">ID: {user?.id.slice(0,8)}</div>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2 mt-4">
               <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-3 py-2">
                 <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">等级</div>
                 <div className="mt-1 text-sm font-semibold text-zinc-900">Lv.{user?.level || 1}</div>
               </div>
               <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-3 py-2">
                 <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">余额</div>
                 <div className="mt-1 text-sm font-semibold text-zinc-900">¥ {user?.balance || '0.00'}</div>
               </div>
             </div>
          </div>

          <ThreeDHeadShowcase username={user?.username} />

          <div className="rounded-[1.75rem] border border-zinc-100 bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
            <div className="space-y-1 flex flex-row md:flex-col overflow-x-auto md:overflow-visible pb-1 md:pb-0 gap-2 md:gap-1">
               {menu.map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <Link 
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 sm:px-5 py-3 rounded-2xl text-xs font-semibold uppercase tracking-[0.24em] transition-all whitespace-nowrap ${
                        active ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <GeometricLantern variant={item.variant} className="w-4 h-4" />
                      {t(item.nameKey)}
                    </Link>
                  );
               })}
            </div>
          </div>

          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-2xl border border-zinc-200 bg-white text-xs font-semibold uppercase tracking-[0.24em] text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <GeometricLantern variant="alert" className="w-4 h-4" />
            {t('dash.logout')}
          </button>
        </aside>

        {/* Main Content */}
        <motion.div 
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-grow min-w-0 rounded-[2rem] border border-zinc-100 bg-white p-5 sm:p-6 lg:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.04)]"
        >
          <Routes>
            <Route index element={
               <div className="space-y-6 sm:space-y-8 lg:space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                     {/* XP Progress Card */}
                     <div className="lg:col-span-2 space-y-4 sm:space-y-5">
                        <header className="flex items-center justify-between gap-3">
                           <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.level_progress')}</h2>
                           <span className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 bg-zinc-50 border border-zinc-100 px-3 py-1 rounded-full whitespace-nowrap">Lv.{user?.level || 1}</span>
                        </header>
                        <div className="p-5 sm:p-6 md:p-8 border border-zinc-100 rounded-[2rem] bg-zinc-50/40 space-y-6 sm:space-y-8 shadow-sm">
                           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div className="space-y-2">
                                 <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tighter break-words">
                                    {xp} <span className="text-base sm:text-lg font-bold text-zinc-400 italic">XP</span>
                                 </div>
                                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('dash.xp.remaining').replace('{xp}', String(100 - (xp % 100)))}</p>
                              </div>
                              <div className="relative w-20 h-20">
                                 <svg className="w-full h-full -rotate-90">
                                    <circle cx="40" cy="40" r="36" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                                    <circle cx="40" cy="40" r="36" fill="transparent" stroke="currentColor" strokeWidth="8" strokeDasharray={226} strokeDashoffset={226 - (226 * ((user?.experience_points || 0) % 100)) / 100} className="text-accent transition-all duration-1000" />
                                 </svg>
                                 <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono">
                                    {progress}%
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-4">
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                 <motion.div 
                                   initial={{ width: 0 }}
                                   animate={{ width: `${progress}%` }}
                                   className="h-full bg-accent" 
                                 />
                              </div>
                               <button 
                                 onClick={handleCheckIn}
                                 disabled={checkedIn || checkingIn}
                                 className="w-full py-4 btn-accent text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-[0.2em] shadow-xl shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
                               >
                                  {checkingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : checkedIn ? t('dash.checkin.claimed') : (
                                    <>
                                      <GeometricLantern variant="spark" className="w-3.5 h-3.5" /> {t('dash.checkin.now')} +25 XP
                                    </>
                                  )}
                               </button>
                           </div>
                        </div>
                     </div>

                     {/* Wallet Brief */}
                     <div className="space-y-4 sm:space-y-5">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.financial_status')}</h2>
                        <div className="p-5 sm:p-6 lg:p-8 bg-black text-white rounded-[2rem] space-y-6 shadow-lg">
                           <div className="space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-white/55">余额</div>
                              <div className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono tracking-tighter break-words">¥ {user?.balance || '0.00'}</div>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                              <Link to="/payment" className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all gap-2">
                                 <GeometricLantern variant="spark" className="w-5 h-5 text-white" />
                                 <span className="text-[9px] font-black uppercase tracking-widest">充值</span>
                              </Link>
                              <Link to="/dashboard/billing" className="flex flex-col items-center justify-center p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all gap-2">
                                 <ChevronRight className="w-5 h-5 text-white" />
                                 <span className="text-[9px] font-black uppercase tracking-widest">{t('dash.financial.billing')}</span>
                              </Link>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Quick Access Section */}
                  <div className="space-y-4 sm:space-y-5">
                     <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.services_shortcuts')}</h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                        {[
                           { nameKey: 'dash.shortcuts.publish', sub: '发布服务器', variant: 'network' as const, link: '/editor' },
                           { nameKey: 'dash.shortcuts.ticket', sub: '提交工单', variant: 'activity' as const, link: '/dashboard/tickets/new' },
                           { nameKey: 'dash.shortcuts.ads', sub: '购买推广', variant: 'payment' as const, link: '/promotion' },
                           { nameKey: 'dash.menu.profile', sub: '账号设置', variant: 'settings' as const, link: '/dashboard/profile' },
                        ].map(item => (
                           <Link 
                             key={item.nameKey}
                             to={item.link}
                             className="p-6 sm:p-8 border border-border rounded-2xl bg-white hover:border-accent transition-all group"
                           >
                              <div className="w-12 h-12 bg-muted rounded-xl mb-4 sm:mb-6 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                                 <GeometricLantern variant={item.variant} className="w-5 h-5" />
                              </div>
                              <div className="text-sm font-black uppercase tracking-tight">{t(item.nameKey as any)}</div>
                              <div className="text-[9px] text-muted-foreground font-black uppercase tracking-widest mt-1">{item.sub}</div>
                           </Link>
                        ))}
                     </div>
                  </div>

                   {/* Activity Feed Section */}
                   <div className="space-y-6">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{t('dash.activity.title')}</h2>
                      <div className="space-y-3 sm:space-y-4">
                         {[
                            { type: '协议', desc: t('dash.activity.sync'), time: '2 分钟前', variant: 'spark' as const },
                            { type: '节点接入', desc: t('dash.activity.handshake'), time: '15 分钟前', variant: 'network' as const },
                            { type: '安全', desc: t('dash.activity.firewall'), time: '1 小时前', variant: 'settings' as const },
                         ].map((log, i) => (
                            <div key={i} className="rounded-[1.5rem] border border-zinc-100 bg-white p-4 sm:p-5 flex items-start justify-between gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.03)]">
                               <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                                  <div className="w-10 h-10 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-center shrink-0">
                                     <GeometricLantern variant={log.variant} className="w-4 h-4 text-zinc-500" />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                     <div className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400">{log.type}</div>
                                     <div className="text-sm font-medium text-zinc-900 leading-6">{log.desc}</div>
                                  </div>
                               </div>
                               <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase italic whitespace-nowrap">{log.time}</span>
                            </div>
                         ))}
                      </div>
                   </div>
               </div>
            } />
            <Route path="servers" element={<MyServers />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/new" element={<TicketCreate />} />
            <Route path="billing" element={<Billing />} />
            <Route path="profile" element={<Profile />} />
          </Routes>
        </motion.div>
      </div>
    </StatusWrapper>
  );
};

export default Dashboard;
