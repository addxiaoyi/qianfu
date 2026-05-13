import { useState, useEffect, useCallback } from 'react';

/**
 * Detect if the current device/breakpoint is considered "mobile".
 * Returns a reactive boolean and a few helper values.
 */
export const useMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(() => {
    setRefreshing(true);
    window.location.reload();
  }, []);

  return {
    isMobile,
    viewport,
    isTouchDevice: typeof navigator !== 'undefined' && 'ontouchstart' in window,
    width: viewport.width,
    refreshing,
    refresh,
  };
};

/**
 * Swipe gesture hook — tracks touch start/end for common swipe directions.
 */
export const useSwipe = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold = 50,
) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart) return;
      const xDiff = touchStart.x - e.changedTouches[0].clientX;
      const yDiff = touchStart.y - e.changedTouches[0].clientY;

      if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (Math.abs(xDiff) > threshold) {
          if (xDiff > 0) onSwipeLeft?.();
          else onSwipeRight?.();
        }
      } else {
        if (Math.abs(yDiff) > threshold) {
          if (yDiff > 0) onSwipeUp?.();
          else onSwipeDown?.();
        }
      }
      setTouchStart(null);
    },
    [touchStart, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown],
  );

  return { handleTouchStart, handleTouchEnd };
};

/**
 * Pull-to-refresh hook.
 * Usage:
 *   const { refreshing, onStart, onEnd, onRefresh } = usePullToRefresh(async () => { ... });
 *   <div {...onStart} onRefresh={onRefresh}>...</div>
 */
export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const onStart = useCallback(
    (e: React.TouchEvent) => {
      setTouchStartY(e.touches[0].clientY);
      setPullDistance(0);
    },
    [],
  );

  const onMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY === null) return;
      const y = e.touches[0].clientY;
      const diff = Math.max(0, y - touchStartY);
      setPullDistance(diff);
    },
    [touchStartY],
  );

  const onEnd = useCallback(async () => {
    if (pullDistance >= 80) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
    setTouchStartY(null);
  }, [pullDistance, onRefresh]);

  return { refreshing, onStart, onMove, onEnd, pullDistance };
};
