import React, { type ReactNode, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MobileBottomNav from './MobileBottomNav';
import { cn } from '../../utils/cn';

interface MobileLayoutProps {
  children: ReactNode;
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
  onBack,
  hideNav = false,
  onRefresh,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = React.useState(0);
  const touchStartYRef = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartYRef.current = e.touches[0].clientY;
      setPullDistance(0);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const y = e.touches[0].clientY;
    const diff = Math.max(0, y - touchStartYRef.current);
    setPullDistance(diff);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullDistance >= 80) {
      // Trigger reload — in a real app this would call a refresh callback
      window.location.reload();
    }
    setPullDistance(0);
    touchStartYRef.current = null;
  }, [pullDistance]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col relative">
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {pullDistance > 0 && (
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

      {/* Safe top area for notches */}
      <div
        className={cn(
          'bg-white shadow-sm',
          onBack ? 'flex items-center px-4' : 'px-4 py-3',
        )}
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        {onBack && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="w-12 h-12 flex items-center justify-center -ml-2 active:bg-zinc-100 rounded-full"
            onClick={onBack}
          >
            <svg
              className="w-6 h-6 text-zinc-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
        )}
      </div>

      {/* Page content */}
      <motion.div
        ref={contentRef}
        className={cn(
          'flex-1 overflow-y-auto',
          !hideNav ? 'pb-20' : '',
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={
              children
                ? React.isValidElement(children)
                  ? String((children as React.ReactElement).key ?? (children as React.ReactElement).type)
                  : 'content'
                : 'content'
            }
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
          className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200/80"
          style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        >
          <MobileBottomNav />
        </motion.div>
      )}
    </div>
  );
};

export default MobileLayout;
