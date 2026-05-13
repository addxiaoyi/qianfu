import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';

export interface ServerStats {
  onlineNodes: number;
  syncLatency: string;
  avgResponseTime: string;
  availability: string;
}

const fetchServerStats = async (): Promise<ServerStats> => {
  const data = await api.get<ServerStats>('/servers/stats');
  return data;
};

export function useServerStats() {
  return useQuery({
    queryKey: ['server-stats'],
    queryFn: fetchServerStats,
    staleTime: 30_000,
    retry: 2,
    refetchOnWindowFocus: true,
  });
}
