import { useQuery } from '@tanstack/react-query';

import { resolveBackendHealthUrl } from '@/utils/backendHealthUrl';

const healthUrl = resolveBackendHealthUrl(
  import.meta.env.VITE_API_URL,
  typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  String(import.meta.env.VITE_API_V2 || '').toLowerCase() === 'true',
);

export function useBackendHealth() {
  const healthQuery = useQuery({
    queryKey: ['health', healthUrl],
    queryFn: async () => {
      const response = await fetch(healthUrl, { credentials: 'include' });
      return response.ok;
    },
    staleTime: 15_000,
    retry: 1,
  });

  const backendReady = healthQuery.data ?? true;
  const backendDegraded = !healthQuery.isLoading && (!backendReady || healthQuery.isError);

  return {
    ...healthQuery,
    backendReady,
    backendDegraded,
  };
}
