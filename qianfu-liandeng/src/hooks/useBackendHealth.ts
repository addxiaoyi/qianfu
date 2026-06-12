import { useQuery } from '@tanstack/react-query';

export function useBackendHealth() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('/api/health');
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
