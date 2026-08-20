import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useT, type TranslationKey } from '@/store/uiStore';
import LanternLogo from '@/components/ui/LanternLogo';
import GeometricLantern, { type LanternVariant } from '@/components/ui/GeometricLantern';

const navLinks: { key: TranslationKey; path: string; iconVariant: LanternVariant }[] = [
  { key: 'nav.home', path: '/', iconVariant: 'spark' },
  { key: 'nav.servers', path: '/servers', iconVariant: 'server' },
  { key: 'nav.news', path: '/news', iconVariant: 'broadcast' },
  { key: 'nav.resources', path: '/resources', iconVariant: 'data' },
  { key: 'nav.team', path: '/team', iconVariant: 'user' },
];

const Navbar: React.FC = React.memo(() => {
  const { isAuthenticated, logout, user } = useAuthStore();
  const t = useT();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !mobileMenuRef.current) return;
      const focusable = Array.from(mobileMenuRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileMenuRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const isAdmin = String(user?.role || '').toUpperCase() === 'ADMIN';

  return (
    <nav className="sticky top-0 z-[100] w-full bg-white/80 backdrop-blur-md border-b border-zinc-100 h-16">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <LanternLogo size={36} animate className="group-hover:scale-110 transition-transform duration-500 drop-shadow-sm" />
              <div className="absolute inset-0 rounded-xl bg-accent opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-md" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-black tracking-tighter italic text-black">{t('admin.title')}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-300">QianFu</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-bold transition-all duration-300 relative group ${
                    isActive(link.path) ? 'text-accent' : 'text-zinc-400 hover:text-black'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <GeometricLantern variant={link.iconVariant} className="w-4 h-4" />
                    {t(link.key)}
                  </span>
                  {isActive(link.path) && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full" />}
                </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  data-admin-entry="navbar"
                  className="hidden items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-700 transition hover:border-black hover:text-black lg:inline-flex"
                >
                  <GeometricLantern variant="settings" className="h-3.5 w-3.5" />
                  管理后台
                </Link>
              )}
              <Link
                to="/dashboard"
                className="btn-accent flex items-center gap-2 px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg hover:shadow-xl italic transition-all duration-300"
              >
                <GeometricLantern variant="network" className="w-3.5 h-3.5" />
                {t('nav.dashboard')}
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/dashboard"
                className="hidden items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-600 transition hover:border-black hover:text-black lg:inline-flex"
              >
                <GeometricLantern variant="user" className="h-3.5 w-3.5" />
                访客预览
              </Link>
              <Link
                to="/login"
                className="text-sm font-bold text-zinc-400 hover:text-black transition-colors duration-300"
              >
                {t('nav.login')}
              </Link>
              <Link
                to="/register"
                className="px-5 py-2 btn-accent text-[11px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg italic transition-all duration-300"
              >
                {t('nav.register')}
              </Link>
            </>
          )}
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
              }}
              className="hidden md:inline-flex px-5 py-2 rounded-xl border border-zinc-200 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:bg-zinc-50 hover:text-black transition-all"
            >
              退出登录
            </button>
          )}
          <button
            ref={mobileMenuButtonRef}
            type="button"
            aria-label={isMobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="md:hidden p-2 rounded-xl hover:bg-zinc-50 transition-colors"
          >
            <GeometricLantern variant={isMobileMenuOpen ? 'close' : 'menu'} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-[120] bg-black/20 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="关闭导航菜单" onClick={() => setIsMobileMenuOpen(false)} />
          <div ref={mobileMenuRef} role="dialog" aria-modal="true" aria-label="移动端导航" className="relative max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-zinc-100 bg-white/95 shadow-2xl">
            <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 mb-3">主导航</div>
                  <div className="grid grid-cols-1 gap-2">
                    {navLinks
                      .filter((link) => link.path !== '/resources')
                      .map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all"
                        >
                          <span className="inline-flex items-center gap-3">
                            <GeometricLantern variant={link.iconVariant} className="w-4 h-4" />
                            {t(link.key)}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Open</span>
                        </Link>
                      ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 mb-3">公开资源</div>
                  <div className="grid grid-cols-1 gap-2">
                    <Link to="/resources" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all">
                      <span className="inline-flex items-center gap-3"><GeometricLantern variant="data" className="w-4 h-4" />资源中心</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Public</span>
                    </Link>
                  </div>
                </div>
              </div>

              {isAuthenticated ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" data-admin-entry="navbar" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-black bg-black px-4 py-3 text-sm font-bold text-white">
                      <span className="inline-flex items-center gap-3"><GeometricLantern variant="settings" className="w-4 h-4" />管理后台</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Admin</span>
                    </Link>
                  )}
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white">
                    <span className="inline-flex items-center gap-3"><GeometricLantern variant="network" className="w-4 h-4" />控制台</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Panel</span>
                  </Link>
                  <button type="button" onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all">
                    退出登录
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="rounded-2xl border border-zinc-200 px-4 py-3 text-center text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all">登录</Link>
                  <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="rounded-2xl bg-black px-4 py-3 text-center text-sm font-bold text-white">注册</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
});

export default Navbar;
