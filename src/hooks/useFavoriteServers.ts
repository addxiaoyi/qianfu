/**
 * useFavoriteServers - 服务器收藏 Hooks (集成预加载优化)
 * 优化项 302: 用户偏好 - 服务器收藏功能
 * 优化项 22: 预加载Next-fetch - getServerSideProps
 *
 * 提供统一的收藏服务器数据获取接口，支持：
 * - 获取当前用户的收藏服务器列表
 * - 收藏/取消收藏服务器
 * - 获取单个服务器的收藏状态
 * - 预加载优化 (路由预取)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/request';
import { isRustV2Enabled, rustV2Path, rustV2RequestOptions } from '@/api/rustV2';
import type { FavoriteServer, FavoriteServersResponse } from '@/types/api';
import { usePrefetchQuery, useHoverPrefetch, usePrefetch } from './useRoutePrefetch';

// ============================================================
// API 函数
// ============================================================

/**
 * 获取收藏服务器列表
 */
const fetchFavoriteServers = async (page: number = 1, limit: number = 20): Promise<FavoriteServersResponse> => {
  if (!isRustV2Enabled()) return api.get<FavoriteServersResponse>('/me/favorites', { page, limit });
  const servers = await api.get<Array<Record<string, unknown>>>(rustV2Path('/me/favorites'), { limit, offset: (page - 1) * limit }, rustV2RequestOptions);
  return servers.map((server) => ({
    id: String(server.id),
    name: String(server.name || '未命名服务器'),
    ip: String(server.host || ''),
    version: server.edition ? String(server.edition) : null,
    image: server.cover_url ? String(server.cover_url) : null,
    players: 0,
    online: Boolean(server.probe_reachable),
    favoritedAt: String(server.created_at || ''),
  }));
};

/**
 * 获取服务器收藏状态
 */
const fetchFavoriteState = async (serverId: string | number): Promise<{ favorited: boolean }> => {
  return api.get<{ favorited: boolean }>(isRustV2Enabled() ? rustV2Path(`/servers/${serverId}/favorite-state`) : `/servers/${serverId}/favorite-state`, undefined, isRustV2Enabled() ? rustV2RequestOptions : undefined);
};

/**
 * 切换收藏状态
 */
const toggleFavorite = async (serverId: string | number): Promise<{ favorited: boolean }> => {
  return api.post<{ favorited: boolean }>(isRustV2Enabled() ? rustV2Path(`/servers/${serverId}/favorite`) : `/servers/${serverId}/favorite`, {}, isRustV2Enabled() ? rustV2RequestOptions : undefined);
};

// ============================================================
// Hooks
// ============================================================

/**
 * 收藏服务器列表 Hook
 * @param page 页码
 * @param limit 每页数量
 */
export function useFavoriteServers(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['favorite-servers', page, limit],
    queryFn: () => fetchFavoriteServers(page, limit),
    staleTime: 30_000, // 30秒
  });
}

/**
 * 单个服务器收藏状态 Hook
 * @param serverId 服务器ID
 */
export function useServerFavoriteState(serverId: string | number | undefined) {
  return useQuery({
    queryKey: ['server-favorite-state', serverId],
    queryFn: () => fetchFavoriteState(serverId!),
    enabled: !!serverId,
    staleTime: 60_000, // 1分钟
  });
}

/**
 * 切换收藏状态 Hook
 * @param serverId 服务器ID
 */
export function useToggleFavorite(serverId: string | number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => toggleFavorite(serverId!),
    onMutate: async () => {
      // 乐观更新：立即反转状态
      await queryClient.cancelQueries({ queryKey: ['server-favorite-state', serverId] });
      await queryClient.cancelQueries({ queryKey: ['favorite-servers'] });

      const previousState = queryClient.getQueryData(['server-favorite-state', serverId]);

      queryClient.setQueryData(['server-favorite-state', serverId], (old: { favorited: boolean } | undefined) => ({
        favorited: !old?.favorited,
      }));

      return { previousState };
    },
    onError: (_err, _variables, context) => {
      // 错误时回滚
      if (context?.previousState) {
        queryClient.setQueryData(['server-favorite-state', serverId], context.previousState);
      }
    },
    onSettled: () => {
      // 重新获取最新数据
      queryClient.invalidateQueries({ queryKey: ['server-favorite-state', serverId] });
      queryClient.invalidateQueries({ queryKey: ['favorite-servers'] });
    },
  });
}

// ============================================================
// 预加载优化 Hooks (新增)
// ============================================================

/**
 * 预加载收藏列表 Hook
 * 使用 usePrefetchQuery 实现类似 Next.js getServerSideProps 的效果
 *
 * @example
 * // 在组件中使用
 * function FavoritesPage() {
 *   const { data, isLoading, isPrefetching } = usePrefetchFavorites();
 *   // ...
 * }
 */
export function usePrefetchFavorites(page: number = 1, limit: number = 20) {
  const route = `/api/me/favorites?page=${page}&limit=${limit}`;

  return usePrefetchQuery<FavoriteServersResponse>({
    key: ['favorites', page, limit],
    route,
    staleTime: 30_000,
    trigger: 'mount', // 组件挂载时预加载
    immediate: true,
  });
}

/**
 * 预加载收藏状态 Hook
 *
 * @example
 * function ServerCard({ serverId }) {
 *   const { data: favorited } = usePrefetchFavoriteState(serverId);
 *   return <HeartIcon filled={favorited} />;
 * }
 */
export function usePrefetchFavoriteState(serverId: string | number | undefined) {
  const route = serverId ? `/api/servers/${serverId}/favorite-state` : '';

  return usePrefetchQuery<{ favorited: boolean }>({
    key: ['favorite-state', serverId],
    route,
    staleTime: 60_000,
    trigger: 'never', // 由外部控制触发时机
  });
}

/**
 * 批量预加载 Hook
 * 用于在页面切换前预加载多个相关数据
 *
 * @example
 * // 在布局组件中使用
 * function AppLayout() {
 *   useBatchPrefetchFavorites();
 *   return <Outlet />;
 * }
 */
export function useBatchPrefetchFavorites() {
  const { prefetch } = usePrefetch();

  return {
    prefetch: () => {
      return Promise.all([
        // 预加载收藏列表
        prefetch('/api/me/favorites?page=1&limit=20'),
        // 预加载收藏统计
        prefetch('/api/me/favorites/count'),
        // 预加载最近收藏
        prefetch('/api/me/favorites/recent?limit=5'),
      ]);
    },
  };
}

// ============================================================
// 交互式预加载 Hooks (新增)
// ============================================================

/**
 * 悬停时预加载收藏列表
 * 用于导航菜单项
 *
 * @example
 * function NavMenu() {
 *   const hoverHandlers = useHoverPrefetchFavorites();
 *   return <Link to="/favorites" {...hoverHandlers}>我的收藏</Link>;
 * }
 */
export function useHoverPrefetchFavorites() {
  return useHoverPrefetch('/api/me/favorites?page=1&limit=20', {
    delay: 100,
  });
}

/**
 * 悬停时预加载服务器收藏状态
 * 用于服务器卡片
 *
 * @example
 * function ServerCard({ server }) {
 *   const handlers = useHoverPrefetchFavoriteState(server.id);
 *   return (
 *     <div {...handlers}>
 *       <HeartIcon />
 *     </div>
 *   );
 * }
 */
export function useHoverPrefetchFavoriteState(serverId: string | number) {
  return useHoverPrefetch(`/api/servers/${serverId}/favorite-state`, {
    delay: 200,
  });
}

// ============================================================
// 便捷导出
// ============================================================

export { fetchFavoriteServers, fetchFavoriteState, toggleFavorite };
export type { FavoriteServer, FavoriteServersResponse };
