import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/request';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';

export interface ServerStats {
  onlineNodes: number;
  syncLatency: string;
  avgResponseTime: string;
  availability: string;
  totalServers: number;
  totalUsers: number;
  totalPlayers: number;
}

const fetchServerStats = async (): Promise<ServerStats> => {
  if (!isRustV2Enabled()) return api.get<ServerStats>('/servers/stats');
  const data = await api.get<{ totalServers: number; totalUsers: number; onlineNodes: number }>(
    rustV2Path('/public/stats'),
    undefined,
    rustV2RequestOptions,
  );
  return {
    onlineNodes: data.onlineNodes,
    syncLatency: '--',
    avgResponseTime: '--',
    availability: '--',
    totalServers: data.totalServers,
    totalUsers: data.totalUsers,
    totalPlayers: 0,
  };
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
