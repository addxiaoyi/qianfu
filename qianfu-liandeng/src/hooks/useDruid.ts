/**
 * Druid 数据查询 React Query Hooks
 *
 * 提供对 Apache Druid 数据的类型安全查询
 */

import { useQuery } from '@tanstack/react-query';
import {
  druidClient,
  type ServerMetrics,
  type RevenueMetrics,
  type UserActivity,
  type ServerEvent,
} from '@/lib/druid-client';

// 查询配置
const DEFAULT_STALE_TIME = 30_000; // 30秒
const DEFAULT_REFETCH_INTERVAL = 60_000; // 1分钟

/**
 * 服务器实时指标
 * 自动刷新间隔: 30秒
 */
export function useServerMetrics(enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'server-metrics'],
    queryFn: () => druidClient.getServerMetrics(),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: 30_000,
    retry: 2,
    enabled,
  });
}

/**
 * 区域分布统计
 */
export function useRegionDistribution(enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'region-distribution'],
    queryFn: () => druidClient.getRegionDistribution(),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    enabled,
  });
}

/**
 * 游戏类型分布
 */
export function useGameTypeDistribution(enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'game-type-distribution'],
    queryFn: () => druidClient.getGameTypeDistribution(),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    enabled,
  });
}

/**
 * 收入指标
 */
export function useRevenueMetrics(days: number = 7, enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'revenue', days],
    queryFn: () => druidClient.getRevenueMetrics(days),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    enabled: enabled && days > 0,
  });
}

/**
 * 日收入趋势
 */
export function useDailyRevenue(days: number = 30, enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'daily-revenue', days],
    queryFn: () => druidClient.getDailyRevenue(days),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    enabled: enabled && days > 0,
  });
}

/**
 * 用户活跃度
 */
export function useUserActivity(days: number = 7, enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'user-activity', days],
    queryFn: () => druidClient.getUserActivity(days),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    enabled: enabled && days > 0,
  });
}

/**
 * 实时事件流
 */
export function useRealtimeEvents(limit: number = 100, enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'realtime-events', limit],
    queryFn: () => druidClient.getRealtimeEvents(limit),
    staleTime: 10_000, // 10秒
    refetchInterval: 15_000, // 15秒刷新
    enabled: enabled && limit > 0,
  });
}

/**
 * 每小时统计
 */
export function useHourlyStats(days: number = 1, enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'hourly-stats', days],
    queryFn: () => druidClient.getHourlyStats(days),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    enabled: enabled && days > 0,
  });
}

/**
 * Top 服务器
 */
export function useTopServers(limit: number = 10, enabled: boolean = true) {
  return useQuery({
    queryKey: ['druid', 'top-servers', limit],
    queryFn: () => druidClient.getTopServers(limit),
    staleTime: DEFAULT_STALE_TIME,
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    enabled: enabled && limit > 0,
  });
}

/**
 * 综合仪表盘数据
 * 一次获取多个关键指标
 * @deprecated 建议使用单独的 hook + useInViewport 按需加载
 */
export function useDashboardMetrics(enabled: boolean = true) {
  const serverMetrics = useServerMetrics(enabled);
  const regionDistribution = useRegionDistribution(enabled);
  const revenue = useRevenueMetrics(7, enabled);
  const hourlyStats = useHourlyStats(1, enabled);

  return {
    serverMetrics,
    regionDistribution,
    revenue,
    hourlyStats,
    isLoading:
      serverMetrics.isLoading ||
      regionDistribution.isLoading ||
      revenue.isLoading ||
      hourlyStats.isLoading,
    isError:
      serverMetrics.isError ||
      regionDistribution.isError ||
      revenue.isError ||
      hourlyStats.isError,
  };
}
