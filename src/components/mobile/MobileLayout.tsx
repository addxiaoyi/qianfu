import React, { type ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';
import { cn } from '../../utils/cn';

const ICP_LINK = 'https://beian.miit.gov.cn/';
const ICP_LABEL = '苏ICP备2026025306号-2';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  onBack?: () => void;
  hideNav?: boolean;
  onRefresh?: () => void;
}

/**
 * MobileLayout provides a mobile-first container:
 * - Safe-area padding for iOS notch
 * - Bottom nav (conditional)
 * - Slide-in page transitions
 * - Pull-to-refresh safe zone
 */
const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  title,
  onBack,
  hideNav = false,
  onRefresh,
}) => {
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = React.useState(0);
  const [topOffset, setTopOffset] = React.useState(0);
  const touchStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshEnabled = typeof onRefresh === 'function';

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(
        target.closest(
          'input, textarea, select, [contenteditable="true"], .tox, .ProseMirror',
        ),
      );
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isInteractiveTarget(event.target)) {
        touchStartYRef.current = null;
        setPullDistance(0);
        return;
      }

      if ((contentEl.scrollTop ?? 0) <= 0) {
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
        setPullDistance(0);
      } else {
        touchStartYRef.current = null;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const y = event.touches[0]?.clientY;
      if (typeof y !== 'number') return;
      const diff = Math.max(0, y - touchStartYRef.current);

      if (diff > 0 && event.cancelable) {
        // Prevent browser native pull-to-refresh, which feels like random page reload on forms.
        event.preventDefault();
      }

      setPullDistance(diff);
    };

    const handleTouchEnd = () => {
      if (refreshEnabled && pullDistanceRef.current >= 80 && onRefresh) {
        onRefresh();
      }
      setPullDistance(0);
      touchStartYRef.current = null;
    };

    contentEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    contentEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    contentEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      contentEl.removeEventListener('touchstart', handleTouchStart);
      contentEl.removeEventListener('touchmove', handleTouchMove);
      contentEl.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, refreshEnabled]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    contentEl.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    const updateTopOffset = () => {
      const top = Math.max(0, Math.round(rootRef.current?.getBoundingClientRect().top ?? 0));
      setTopOffset((current) => (current === top ? current : top));
    };

    updateTopOffset();

    const resizeObserver = new ResizeObserver(updateTopOffset);
    if (rootRef.current?.parentElement) {
      resizeObserver.observe(rootRef.current.parentElement);
    }
    resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(() => {
      window.requestAnimationFrame(updateTopOffset);
    });
    mutationObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    window.addEventListener('resize', updateTopOffset);
    window.addEventListener('orientationchange', updateTopOffset);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateTopOffset);
      window.removeEventListener('orientationchange', updateTopOffset);
    };
  }, []);

  const shellHeight = topOffset > 0 ? `calc(100svh - ${topOffset}px)` : '100svh';

  return (
    <div
      ref={rootRef}
      className="relative flex flex-col overflow-hidden bg-zinc-50 text-zinc-900"
      style={{ height: shellHeight, minHeight: shellHeight }}
    >
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {refreshEnabled && pullDistance > 0 && (
          <motion.div
            className="fixed top-0 left-0 right-0 flex items-center justify-center z-50"
            style={{
              y: pullDistance * 0.5,
              opacity: Math.max(0, 1 - pullDistance / 100),
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: Math.max(0, 1 - pullDistance / 100) }}
            exit={{ opacity: 0 }}
          >
            <div className="w-10 h-10 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
            <p className="ml-3 text-xs text-zinc-400 font-medium">刷新中...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App header */}
      <div
        className={cn(
          'min-h-16 shrink-0 border-b border-zinc-200 bg-white/95 px-4 pb-3 shadow-sm backdrop-blur',
          onBack ? 'flex items-end gap-2' : 'flex items-end justify-between',
        )}
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        {onBack && (
          <motion.button type="button"
            whileTap={{ scale: 0.9 }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-zinc-100"
            onClick={onBack}
            aria-label="返回"
          >
            <ArrowLeft className="h-5 w-5 text-zinc-700" />
          </motion.button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">
            千服
          </div>
          <div className="truncate text-lg font-black tracking-tight text-zinc-950">
            {title || '千服联灯'}
          </div>
        </div>
        {!onBack && (
          <Link
            to="/me/settings"
            className="ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50 text-zinc-700 active:bg-zinc-100"
            aria-label="打开设置"
          >
            <Settings className="h-5 w-5" />
          </Link>
        )}
      </div>

      {/* Page content */}
      <motion.div
        ref={contentRef}
        data-mobile-scroll-root="true"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
        )}
        style={{
          paddingBottom: !hideNav ? 'calc(1rem + env(safe-area-inset-bottom))' : '1rem',
          overscrollBehaviorY: 'none',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-4"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Bottom navigation */}
      {!hideNav && (
        <motion.div
          className="relative z-40 shrink-0 border-t border-zinc-200/80 bg-white"
          style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        >
          <div className="absolute inset-x-0 -top-8 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          <div className="border-b border-zinc-100 px-4 py-1 text-center">
            <a
              href={ICP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[6px] font-normal leading-3 text-[#e9e7e7] underline decoration-[#e9e7e7] underline-offset-1 transition-colors hover:text-zinc-500 hover:decoration-zinc-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {ICP_LABEL}
            </a>
          </div>
          <MobileBottomNav />
        </motion.div>
      )}
    </div>
  );
};

export default MobileLayout;
