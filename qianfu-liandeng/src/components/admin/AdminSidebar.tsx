import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useT, type TranslationKey } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/hooks/use-toast';
import LanternLogo from '@/components/LanternLogo';
import GeometricLantern from '@/components/icons/GeometricLantern';

const AdminSidebar: React.FC = React.memo(() => {
  const { pathname } = useLocation();
  const t = useT();
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const sidebarItems: { key: TranslationKey; path: string; variant: any; tag: string }[] = [
    { key: 'admin.index', path: '/admin', variant: 'spark', tag: 'CORE' },
    { key: 'admin.users', path: '/admin-users', variant: 'user', tag: 'AUTH' },
    { key: 'admin.review', path: '/admin-review', variant: 'security', tag: 'NODE' },
    { key: 'admin.tickets', path: '/admin-tickets', variant: 'activity', tag: 'HELP' },
    { key: 'admin.reports', path: '/admin-reports', variant: 'alert', tag: 'LAW' },
    { key: 'admin.audit', path: '/admin-audit', variant: 'terminal', tag: 'LOG' },
    { key: 'admin.stats', path: '/admin-audit-stats', variant: 'data', tag: 'DATA' },
    { key: 'admin.moderation', path: '/admin-moderation', variant: 'security', tag: 'FILTER' },
    { key: 'admin.network', path: '/admin-port5555', variant: 'network', tag: 'SYS' },
    { key: 'admin.treasury', path: '/admin-qianfu', variant: 'payment', tag: 'FIN' },
  ];

  return (
    <aside className="w-80 border-r border-zinc-100 min-h-[calc(100svh-4rem)] flex flex-col p-8 bg-white/50 backdrop-blur-xl relative z-50">
      {/* Brand & Status */}
      <div className="mb-12 space-y-4">
         <div className="flex items-center gap-4 group cursor-default">
            <div className="relative">
               <LanternLogo size={40} animate className="group-hover:scale-110 transition-transform duration-500" />
               <div className="absolute inset-0 rounded-xl bg-accent opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-md" />
            </div>
            <div className="flex flex-col leading-none">
               <span className="text-base font-black tracking-tighter uppercase italic text-accent">{t('admin.title')}</span>
               <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-300">{t('admin.console')}</span>
            </div>
         </div>
         <div className="flex items-center gap-2 pl-1">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 italic">Auth: {t('admin.status')}</span>
         </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-grow space-y-2">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.path;

          return (
            <Link 
              key={item.path}
              to={item.path}
              className={`group flex items-center justify-between px-6 py-4 rounded-2xl transition-all duration-500 relative overflow-hidden ${
                isActive 
                  ? 'nav-active' 
                  : 'text-zinc-400 hover:bg-accent-subtle hover:text-accent'
              }`}
            >
              <div className="flex items-center gap-4 relative z-10">
                <GeometricLantern 
                   variant={item.variant}
                   className={`w-4 h-4 transition-transform duration-500 group-hover:scale-110 ${isActive ? 'text-white' : 'text-zinc-300 group-hover:text-accent'}`} 
                />
                <div className="flex flex-col -space-y-1">
                   <span className="text-[11px] font-black uppercase tracking-[0.1em]">
                      {t(item.key)}
                   </span>
                   <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-white/40' : 'text-zinc-200 group-hover:text-accent-med'}`}>
                      / {item.tag}
                   </span>
                </div>
              </div>
              {isActive && (
                <motion.div layoutId="sidebar-active" className="relative z-10">
                   <ChevronRight className="w-3 h-3 text-white/50" />
                 </motion.div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer Section */}
      <div className="mt-auto pt-8 border-t border-zinc-50 space-y-6">
        <div className="flex items-center justify-between px-4">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">Latency</span>
              <span className="text-[10px] font-black font-mono text-green-500 italic">2.4ms</span>
           </div>
           <GeometricLantern variant="activity" className="w-4 h-4 text-zinc-100" />
        </div>
        <button 
          onClick={() => {
            logout();
            toast({ title: 'Logged out', description: 'Session cleared successfully.' });
            navigate('/');
          }}
          className="w-full flex items-center justify-between px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-red-400 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 italic"
        >
          <div className="flex items-center gap-4">
             <GeometricLantern variant="alert" className="w-4 h-4" />
             {t('admin.logout')}
          </div>
        </button>
      </div>
    </aside>
  );
});

export default AdminSidebar;
