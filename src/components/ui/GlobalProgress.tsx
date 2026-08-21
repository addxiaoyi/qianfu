import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

type ProgressMeta = {
  hideGlobalProgress?: boolean;
  showBackgroundProgress?: boolean;
};

type TrackableQuery = {
  meta?: unknown;
  state: { data: unknown };
};

const shouldTrackMutation = (meta: unknown) =>
  !((meta as ProgressMeta | undefined)?.hideGlobalProgress);

const shouldTrackQuery = (query: TrackableQuery) => {
  const meta = query.meta as ProgressMeta | undefined;
  if (meta?.hideGlobalProgress) return false;
  return query.state.data === undefined || meta?.showBackgroundProgress === true;
};

export default function GlobalProgress() {
  const location = useLocation();
  const [routeLoading, setRouteLoading] = useState(false);
  const fetchingCount = useIsFetching({
    predicate: shouldTrackQuery,
  });
  const mutatingCount = useIsMutating({
    predicate: (mutation) => shouldTrackMutation(mutation.options.meta),
  });

  useEffect(() => {
    setRouteLoading(true);
    const timer = window.setTimeout(() => setRouteLoading(false), 600);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  const loading = routeLoading || fetchingCount > 0 || mutatingCount > 0;
  if (!loading) return null;

  return (
    <div
      role="progressbar"
      aria-label="页面正在加载"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1 overflow-hidden bg-white/30"
    >
      <div className="h-full w-1/3 animate-pulse bg-accent shadow-[0_0_14px_rgba(245,158,11,0.8)]" />
    </div>
  );
}
