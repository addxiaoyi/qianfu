import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  LayoutDashboard,
  Home,
  Server,
  BookOpen,
  Users,
  FileText,
  Megaphone,
  Store,
  BriefcaseBusiness,
  ChevronDown,
  Sparkles,
  BadgeCheck,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useT, type TranslationKey } from '@/store/uiStore';
import LanternLogo from '@/components/LanternLogo';

const navLinks: { key: TranslationKey; path: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'nav.home', path: '/', icon: Home },
  { key: 'nav.servers', path: '/servers', icon: Server },
  { key: 'nav.resources', path: '/resources', icon: BookOpen },
  { key: 'nav.team', path: '/team', icon: Users },
  { key: 'nav.rules', path: '/rules', icon: FileText },
  { key: 'nav.promotion', path: '/promotion', icon: Megaphone },
];

const Navbar: React.FC = React.memo(() => {
  const { isAuthenticated, logout } = useAuthStore();
  const t = useT();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [isPromotionOpen, setIsPromotionOpen] = useState(false);
  const resourcesCloseTimer = useRef<number | null>(null);
  const promotionCloseTimer = useRef<number | null>(null);
  const promotionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const resourcesRoot = document.querySelector('[data-resources-menu-root="true"]');
      if (resourcesRoot && !resourcesRoot.contains(target)) {
        closeResourcesMenu();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    return () => {
      if (resourcesCloseTimer.current) window.clearTimeout(resourcesCloseTimer.current);
      if (promotionCloseTimer.current) window.clearTimeout(promotionCloseTimer.current);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isResourcesActive = location.pathname.startsWith('/resources') || location.pathname.startsWith('/marketplace/shop') || location.pathname.startsWith('/seller/');

  const openResourcesMenu = () => {
    if (resourcesCloseTimer.current) {
      window.clearTimeout(resourcesCloseTimer.current);
      resourcesCloseTimer.current = null;
    }
    if (isPromotionOpen) setIsPromotionOpen(false);
    setIsResourcesOpen(true);
  };

  const closeResourcesMenu = () => {
    if (resourcesCloseTimer.current) window.clearTimeout(resourcesCloseTimer.current);
    resourcesCloseTimer.current = window.setTimeout(() => setIsResourcesOpen(false), 180);
  };

  const openPromotionMenu = () => {
    if (promotionCloseTimer.current) {
      window.clearTimeout(promotionCloseTimer.current);
      promotionCloseTimer.current = null;
    }
    if (isResourcesOpen) setIsResourcesOpen(false);
    setIsPromotionOpen(true);
  };

  const closePromotionMenu = () => {
    if (promotionCloseTimer.current) window.clearTimeout(promotionCloseTimer.current);
    promotionCloseTimer.current = window.setTimeout(() => setIsPromotionOpen(false), 180);
  };

  const promoTaskLink = isAuthenticated ? '/promotion/tasks' : '/login';
  const promoClaimsLink = isAuthenticated ? '/promotion/claims' : '/login';

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
            {navLinks.map((link) => {
              if (link.path === '/resources') {
                return (
                  <div
                    key={link.path}
                    data-resources-menu-root="true"
                    className="relative"
                    onMouseEnter={openResourcesMenu}
                    onMouseLeave={closeResourcesMenu}
                    onBlurCapture={(event) => {
                      const next = event.relatedTarget as Node | null;
                      if (next && event.currentTarget.contains(next)) return;
                      closeResourcesMenu();
                    }}
                  >
                    <Link
                      to="/resources"
                      aria-haspopup="menu"
                      aria-expanded={isResourcesOpen}
                      onMouseEnter={openResourcesMenu}
                      onFocus={openResourcesMenu}
                      onBlur={closeResourcesMenu}
                      onClick={() => setIsResourcesOpen(true)}
                      className={`text-sm font-bold transition-all duration-300 relative group ${isResourcesActive ? 'text-accent' : 'text-zinc-400 hover:text-black'}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <link.icon className="w-4 h-4" />
                        {t(link.key)}
                      </span>
                      {isResourcesActive && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full" />}
                    </Link>

                    {isResourcesOpen && (
                      <div
                        tabIndex={-1}
                        className="absolute top-full left-0 mt-3 w-[34rem] rounded-3xl border border-zinc-200 bg-white shadow-2xl p-4 z-[130] animate-in fade-in zoom-in-95 duration-150"
                        onMouseEnter={openResourcesMenu}
                        onMouseLeave={closeResourcesMenu}
                        onBlur={closeResourcesMenu}
                      >
                        <div className="absolute left-8 -top-2 h-3 w-3 rotate-45 border-l border-t border-zinc-200 bg-white" />
                        <div className="mb-4 rounded-2xl bg-gradient-to-r from-zinc-50 to-white px-4 py-3 border border-zinc-100">
                          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400">资源市场</div>
                          <div className="mt-1 text-xs text-zinc-500">资源、店铺、创作空间一体入口</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative">
                          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-zinc-100" />
                          <div className="space-y-3">
                            <div className="px-1 text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 flex items-center gap-2">
                              <Store className="w-3.5 h-3.5" />
                              <span>市场</span>
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Public</span>
                            </div>
                            <Link
                              to="/resources"
                              onClick={() => setIsResourcesOpen(false)}
                              className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-100 px-4 py-3.5 text-zinc-700 hover:border-black hover:bg-zinc-50 hover:text-black transition-all"
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <BookOpen className="w-4 h-4 mt-0.5 text-accent" />
                                <div className="min-w-0">
                                  <div className="text-sm font-bold">资源中心</div>
                                  <div className="text-[11px] leading-5 text-zinc-400">查看全部公开资源</div>
                                </div>
                              </div>
                              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Public</span>
                            </Link>
                            <Link
                              to="/marketplace/shop"
                              onClick={() => setIsResourcesOpen(false)}
                              className="group flex items-start justify-between gap-3 rounded-3xl border-2 border-black px-4 py-5 text-zinc-700 bg-gradient-to-br from-white via-white to-zinc-50 hover:bg-zinc-50 hover:text-black transition-all shadow-sm ring-1 ring-black/5 hover:translate-y-[-1px] relative overflow-hidden"
                            >
                              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-black/0 via-black/10 to-black/0" />
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-3xl bg-black text-white shadow-sm">
                                  <Store className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-bold">个人店铺</div>
                                    <span className="rounded-full bg-black px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-white">Hot</span>
                                  </div>
                                  <div className="text-[11px] leading-5 text-zinc-400">逛市场、看精选、看创作者主页</div>
                                </div>
                              </div>
                              <ChevronDown className="w-4 h-4 mt-1 opacity-40 rotate-[-90deg]" />
                            </Link>
                          </div>

                          <div className="space-y-3">
                            <div className="px-1 text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 flex items-center gap-2">
                              <BriefcaseBusiness className="w-3.5 h-3.5" />
                              <span>我的创作空间</span>
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Pro</span>
                            </div>
                            {isAuthenticated ? (
                              <>
                                <Link
                                  to="/seller/shop"
                                  onClick={() => setIsResourcesOpen(false)}
                                  className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-100 px-4 py-4 text-zinc-700 hover:border-black hover:bg-zinc-50 hover:text-black transition-all"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                                      <BriefcaseBusiness className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-bold">店铺管理</div>
                                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Manage</span>
                                      </div>
                                      <div className="text-[11px] leading-5 text-zinc-400">编辑主页、版本和资产</div>
                                    </div>
                                  </div>
                                  <ChevronDown className="w-4 h-4 mt-1 opacity-40 rotate-[-90deg]" />
                                </Link>

                                <Link
                                  to="/seller/marketplace"
                                  onClick={() => setIsResourcesOpen(false)}
                                  className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-100 px-4 py-4 text-zinc-700 hover:border-black hover:bg-zinc-50 hover:text-black transition-all hover:translate-y-[-1px]"
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                                      <LayoutDashboard className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-bold">卖家中心</div>
                                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Pro</span>
                                      </div>
                                      <div className="text-[11px] leading-5 text-zinc-400">查看商品管理与运营数据</div>
                                    </div>
                                  </div>
                                  <ChevronDown className="w-4 h-4 mt-1 opacity-40 rotate-[-90deg]" />
                                </Link>
                              </>
                            ) : (
                              <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-4 text-xs leading-5 text-amber-800 flex items-start gap-3 shadow-sm">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                                  <Lock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-amber-900">登录后可管理店铺</div>
                                  <div className="mt-1 text-[11px] leading-5 text-amber-700">上传资产、编辑主页、查看版本历史与运营数据。</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              if (link.path === '/promotion') {
                return (
                  <div key={link.path} className="relative" onMouseEnter={openPromotionMenu} onMouseLeave={closePromotionMenu}>
                    <Link
                      to="/promotion"
                      aria-haspopup="menu"
                      aria-expanded={isPromotionOpen}
                      onMouseEnter={openPromotionMenu}
                      onFocus={openPromotionMenu}
                      onClick={() => setIsPromotionOpen(true)}
                      className={`text-sm font-bold transition-all duration-300 relative group ${isActive('/promotion') ? 'text-accent' : 'text-zinc-400 hover:text-black'}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <link.icon className="w-4 h-4" />
                        {t(link.key)}
                      </span>
                      {isActive('/promotion') && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full" />}
                    </Link>

                    {isPromotionOpen && (
                      <div
                        ref={promotionMenuRef}
                        className="absolute top-full left-0 mt-3 w-[26rem] rounded-3xl border border-zinc-200 bg-white shadow-2xl p-4 z-[130] animate-in fade-in zoom-in-95 duration-150"
                        onMouseEnter={openPromotionMenu}
                        onMouseLeave={closePromotionMenu}
                      >
                        <div className="absolute left-8 -top-2 h-3 w-3 rotate-45 border-l border-t border-zinc-200 bg-white" />
                        <div className="mb-4 rounded-2xl bg-gradient-to-r from-amber-50 to-white px-4 py-3 border border-amber-100">
                          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-500">推广中心</div>
                          <div className="mt-1 text-xs text-zinc-500">激励任务、领取审核与规则说明都在这里。</div>
                        </div>

                        <div className="space-y-3">
                          <Link
                            to={promoTaskLink}
                            onClick={() => setIsPromotionOpen(false)}
                            className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-100 px-4 py-4 text-zinc-700 hover:border-black hover:bg-zinc-50 hover:text-black transition-all"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-bold">激励任务</div>
                                  {!isAuthenticated && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">登录后可用</span>}
                                </div>
                                <div className="text-[11px] leading-5 text-zinc-400">参与推广激励，查看任务与奖励说明</div>
                              </div>
                            </div>
                            <ChevronDown className="w-4 h-4 mt-1 opacity-40 rotate-[-90deg]" />
                          </Link>

                          <Link
                            to={promoClaimsLink}
                            onClick={() => setIsPromotionOpen(false)}
                            className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-100 px-4 py-4 text-zinc-700 hover:border-black hover:bg-zinc-50 hover:text-black transition-all"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                                <BadgeCheck className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-bold">领取审核</div>
                                  {!isAuthenticated && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">登录后可用</span>}
                                </div>
                                <div className="text-[11px] leading-5 text-zinc-400">查看领取状态、审核进度与处理结果</div>
                              </div>
                            </div>
                            <ChevronDown className="w-4 h-4 mt-1 opacity-40 rotate-[-90deg]" />
                          </Link>

                          <Link
                            to="/me"
                            onClick={() => setIsPromotionOpen(false)}
                            className="group flex items-start justify-between gap-3 rounded-2xl border border-zinc-100 px-4 py-4 text-zinc-700 hover:border-black hover:bg-zinc-50 hover:text-black transition-all"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 shadow-sm">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold">个人主页</div>
                                <div className="text-[11px] leading-5 text-zinc-400">查看个人信息、奖励记录与相关页面</div>
                              </div>
                            </div>
                            <ChevronDown className="w-4 h-4 mt-1 opacity-40 rotate-[-90deg]" />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-bold transition-all duration-300 relative group ${
                    isActive(link.path) ? 'text-accent' : 'text-zinc-400 hover:text-black'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <link.icon className="w-4 h-4" />
                    {t(link.key)}
                  </span>
                  {isActive(link.path) && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full" />}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="btn-accent flex items-center gap-2 px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg hover:shadow-xl italic transition-all duration-300"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              {t('nav.dashboard')}
            </Link>
          ) : (
            <>
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
            type="button"
            aria-label={isMobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="md:hidden p-2 rounded-xl hover:bg-zinc-50 transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-[120] bg-black/20 backdrop-blur-[2px]" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="border-t border-zinc-100 bg-white/95 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 mb-3">主导航</div>
                  <div className="grid grid-cols-1 gap-2">
                    {navLinks
                      .filter((link) => link.path !== '/resources' && link.path !== '/promotion')
                      .map((link) => (
                        <Link
                          key={link.path}
                          to={link.path === '/rules' ? '/team#community-rules' : link.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all"
                        >
                          <span className="inline-flex items-center gap-3">
                            <link.icon className="w-4 h-4" />
                            {t(link.key)}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Open</span>
                        </Link>
                      ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 mb-3">资源与创作</div>
                  <div className="grid grid-cols-1 gap-2">
                    <Link to="/resources" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all">
                      <span className="inline-flex items-center gap-3"><BookOpen className="w-4 h-4" />资源中心</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Market</span>
                    </Link>
                    <Link to="/marketplace/shop" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all">
                      <span className="inline-flex items-center gap-3"><Store className="w-4 h-4" />个人店铺</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Shop</span>
                    </Link>
                    <Link to="/seller/shop" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all">
                      <span className="inline-flex items-center gap-3"><BriefcaseBusiness className="w-4 h-4" />店铺管理</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Manage</span>
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-400 mb-3">推广中心</div>
                  <div className="grid grid-cols-1 gap-2">
                    <Link to="/promotion/tasks" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all">
                      <span className="inline-flex items-center gap-3"><Sparkles className="w-4 h-4" />激励任务</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Task</span>
                    </Link>
                    <Link to="/promotion/claims" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all">
                      <span className="inline-flex items-center gap-3"><BadgeCheck className="w-4 h-4" />领取审核</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Audit</span>
                    </Link>
                    <Link to="/me" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-black hover:text-black transition-all">
                      <span className="inline-flex items-center gap-3"><Lock className="w-4 h-4" />个人主页</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Me</span>
                    </Link>
                  </div>
                </div>
              </div>

              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center justify-between rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white">
                    <span className="inline-flex items-center gap-3"><LayoutDashboard className="w-4 h-4" />控制台</span>
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
