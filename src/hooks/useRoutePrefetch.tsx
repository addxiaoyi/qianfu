/**
 * 路由预加载系统
 * 优化项 22: 预加载Next-fetch - getServerSideProps
 *
 * 在 React Router v7 中实现类似 Next.js getServerSideProps 的数据预加载功能：
 * 1. 路由级数据预加载 (loader)
 * 2. 声明式数据依赖
 * 3. 智能预取策略
 * 4. 竞态条件处理
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// ============================================================
// 类型定义
// ============================================================

/**
 * 数据加载器函数类型
 * 类似于 Next.js 的 getServerSideProps
 */
export type DataLoader<T = unknown> = (args: LoaderArgs) => Promise<T> | T;

/**
 * Loader 参数
 */
export interface LoaderArgs {
  /** 请求参数 */
  params: Record<string, string>;
  /** 请求查询参数 */
  searchParams: URLSearchParams;
  /** 是否为客户端导航 */
  isNavigation: boolean;
  /** 上一页路径 */
  from?: string;
}

/**
 * 预加载状态
 */
export interface PrefetchState<T = unknown> {
  /** 加载状态 */
  status: 'idle' | 'loading' | 'success' | 'error';
  /** 数据 */
  data: T | null;
  /** 错误信息 */
  error: Error | null;
  /** 加载时间戳 */
  timestamp: number | null;
}

/**
 * 预加载配置
 */
export interface PrefetchConfig {
  /** 预加载触发时机 */
  trigger: 'mount' | 'hover' | 'visible' | 'idle';
  /** 延迟预加载(ms) */
  delay?: number;
  /** 缓存时间(ms) */
  cacheTime?: number;
  /** 是否启用竞态检测 */
  raceConditionCheck?: boolean;
}

// ============================================================
// 数据加载上下文
// ============================================================

interface PrefetchContextValue {
  /** 预加载指定路由的数据 */
  prefetch: <T>(route: string, options?: PrefetchConfig) => Promise<T | null>;
  /** 批量预加载 */
  batchPrefetch: (routes: Array<{ route: string; options?: PrefetchConfig }>) => Promise<void>;
  /** 清除缓存 */
  clearCache: (route?: string) => void;
  /** 获取预加载状态 */
  getPrefetchState: <T>(route: string) => PrefetchState<T> | null;
}

const PrefetchContext = createContext<PrefetchContextValue | null>(null);

// ============================================================
// 数据缓存
// ============================================================

interface CacheEntry<T = unknown> {
  data: T | null;
  error: Error | null;
  timestamp: number;
}

export class DataPrefetchCache {
  private cache = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<unknown>>();
  private defaultCacheTime = 30_000; // 30秒
  private readonly maxEntries: number;

  constructor(maxEntries = 50) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  /**
   * 获取缓存数据
   */
  get<T>(key: string, maxAge?: number): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const maxCacheTime = maxAge ?? this.defaultCacheTime;
    if (Date.now() - entry.timestamp > maxCacheTime) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry as CacheEntry<T>;
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, error?: Error): void {
    this.cache.delete(key);
    while (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      data,
      error: error ?? null,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取待处理的请求
   */
  getPending<T>(key: string): Promise<T> | null {
    return (this.pending.get(key) as Promise<T> | undefined) ?? null;
  }

  /**
   * 设置待处理的请求
   */
  setPending<T>(key: string, promise: Promise<T>): void {
    this.pending.delete(key);
    while (this.pending.size >= this.maxEntries) {
      const oldestKey = this.pending.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.pending.delete(oldestKey);
    }
    this.pending.set(key, promise);
    const clearPending = () => {
      if (this.pending.get(key) === promise) {
        this.pending.delete(key);
      }
    };
    promise.then(clearPending, clearPending);
  }

  /**
   * 清除缓存
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
      this.pending.delete(key);
    } else {
      this.cache.clear();
      this.pending.clear();
    }
  }

  /**
   * 设置默认缓存时间
   */
  setDefaultCacheTime(ms: number): void {
    this.defaultCacheTime = ms;
  }
}

// 全局缓存实例
export const globalPrefetchCache = new DataPrefetchCache();

// ============================================================
// 数据预加载 Provider
// ============================================================

interface PrefetchProviderProps {
  children: ReactNode;
  /** 全局缓存时间(ms) */
  cacheTime?: number;
  /** API 基础 URL */
  apiBaseUrl?: string;
}

export function PrefetchProvider({
  children,
  cacheTime = 30_000,
  apiBaseUrl = '/api',
}: PrefetchProviderProps) {
  // 设置默认缓存时间
  useEffect(() => {
    globalPrefetchCache.setDefaultCacheTime(cacheTime);
  }, [cacheTime]);

  /**
   * 预加载指定路由的数据
   */
  const prefetch = useCallback(async <T,>(
    route: string,
    options: PrefetchConfig = { trigger: 'idle' }
  ): Promise<T | null> => {
    const { delay = 0, cacheTime: customCacheTime } = options;

    // 检查缓存
    const cached = globalPrefetchCache.get<T>(route, customCacheTime);
    if (cached) {
      return cached.data;
    }

    // 检查是否有待处理的请求
    const pending = globalPrefetchCache.getPending<T>(route);
    if (pending) {
      return pending;
    }

    // 延迟预加载
    const doPrefetch = async (): Promise<T | null> => {
      try {
        // 构建 API URL
        const url = route.startsWith('/api/')
          ? route
          : `${apiBaseUrl}${route}`;

        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`预加载失败: ${response.status}`);
        }

        const data = await response.json();
        globalPrefetchCache.set(route, data);
        return data;
      } catch (error) {
        globalPrefetchCache.set(route, null, error as Error);
        return null;
      }
    };

    if (delay > 0) {
      return new Promise((resolve) => {
        setTimeout(async () => {
          const promise = doPrefetch() as Promise<T>;
          globalPrefetchCache.setPending(route, promise);
          const result = await promise;
          resolve(result);
        }, delay);
      });
    } else {
      const promise = doPrefetch() as Promise<T>;
      globalPrefetchCache.setPending(route, promise);
      return promise;
    }
  }, [apiBaseUrl]);

  /**
   * 批量预加载
   */
  const batchPrefetch = useCallback(async (
    routes: Array<{ route: string; options?: PrefetchConfig }>
  ): Promise<void> => {
    await Promise.allSettled(
      routes.map(({ route, options }) => prefetch(route, options))
    );
  }, [prefetch]);

  /**
   * 清除缓存
   */
  const clearCache = useCallback((route?: string): void => {
    globalPrefetchCache.clear(route);
  }, []);

  /**
   * 获取预加载状态
   */
  const getPrefetchState = useCallback(<T,>(route: string): PrefetchState<T> | null => {
    const cached = globalPrefetchCache.get<T>(route);
    if (!cached) return null;

    return {
      status: cached.error ? 'error' : 'success',
      data: cached.data,
      error: cached.error,
      timestamp: cached.timestamp,
    };
  }, []);

  const value: PrefetchContextValue = {
    prefetch,
    batchPrefetch,
    clearCache,
    getPrefetchState,
  };

  return (
    <PrefetchContext.Provider value={value}>
      {children}
    </PrefetchContext.Provider>
  );
}

// ============================================================
// Hooks
// ============================================================

/**
 * 使用预加载上下文
 */
export function usePrefetchContext(): PrefetchContextValue {
  const context = useContext(PrefetchContext);
  if (!context) {
    throw new Error('usePrefetchContext must be used within PrefetchProvider');
  }
  return context;
}

/**
 * 预加载 Hook
 * 用于在组件中触发数据预加载
 *
 * @example
 * const { prefetch } = usePrefetch();
 * prefetch('/api/user/profile');
 */
export function usePrefetch() {
  return usePrefetchContext();
}

/**
 * 预加载状态 Hook
 * 获取指定路由的预加载状态
 */
export function usePrefetchState<T>(route: string): PrefetchState<T> {
  const { getPrefetchState } = usePrefetchContext();
  const [state, setState] = useState<PrefetchState<T>>({
    status: 'idle',
    data: null,
    error: null,
    timestamp: null,
  });

  useEffect(() => {
    const cached = getPrefetchState<T>(route);
    if (cached) {
      setState(cached);
    }
  }, [route, getPrefetchState]);

  return state;
}

/**
 * 声明式预加载 Hook
 * 类似于 React Query 的 useQuery，用于声明式数据获取
 *
 * @example
 * const { data, isLoading, prefetch } = usePrefetchQuery({
 *   key: 'user-profile',
 *   route: '/api/user/profile',
 *   staleTime: 60_000,
 * });
 */
export interface UsePrefetchQueryOptions<T = unknown> {
  /** 缓存键 */
  key: string | [string, ...unknown[]];
  /** API 路由 */
  route: string;
  /** 初始数据 */
  initialData?: T;
  /** 缓存时间 */
  staleTime?: number;
  /** 是否立即加载 */
  immediate?: boolean;
  /** 预加载触发器 */
  trigger?: 'mount' | 'hover' | 'visible' | 'never';
}

export interface UsePrefetchQueryResult<T = unknown> {
  /** 数据 */
  data: T | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误状态 */
  isError: boolean;
  /** 错误对象 */
  error: Error | null;
  /** 预加载函数 */
  prefetch: () => Promise<T | null>;
  /** 手动触发刷新 */
  refetch: () => Promise<T | null>;
  /** 上次更新时间戳 */
  updatedAt: number | null;
}

export function usePrefetchQuery<T = unknown>({
  key,
  route,
  initialData,
  staleTime = 30_000,
  immediate = false,
  trigger = 'never',
}: UsePrefetchQueryOptions<T>): UsePrefetchQueryResult<T> {
  const { prefetch, getPrefetchState } = usePrefetchContext();
  const cacheKey = Array.isArray(key) ? key.join(':') : key;
  const [state, setState] = useState<PrefetchState<T>>(() => {
    // 尝试从缓存恢复
    const cached = getPrefetchState<T>(cacheKey);
    if (cached) return cached;
    if (initialData) {
      return { status: 'success', data: initialData, error: null, timestamp: 0 };
    }
    return { status: 'idle', data: null, error: null, timestamp: null };
  });

  /**
   * 执行预加载
   */
  const doPrefetch = useCallback(async (): Promise<T | null> => {
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      const result = await prefetch<T>(route, {
        trigger: 'idle',
        cacheTime: staleTime,
      });

      setState({
        status: 'success',
        data: result,
        error: null,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      setState({
        status: 'error',
        data: null,
        error: error as Error,
        timestamp: Date.now(),
      });
      return null;
    }
  }, [route, prefetch, staleTime]);

  /**
   * 刷新数据
   */
  const refetch = useCallback(async (): Promise<T | null> => {
    globalPrefetchCache.clear(cacheKey);
    return doPrefetch();
  }, [cacheKey, doPrefetch]);

  // 触发预加载
  useEffect(() => {
    if (immediate) {
      doPrefetch();
    }
  }, [immediate, doPrefetch]);

  // 根据触发器自动预加载
  useEffect(() => {
    if (trigger === 'never' || trigger === 'hover' || trigger === 'visible') {
      return;
    }

    if (trigger === 'mount') {
      doPrefetch();
    }
  }, [trigger, doPrefetch]);

  return {
    data: state.data,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    error: state.error,
    prefetch: doPrefetch,
    refetch,
    updatedAt: state.timestamp,
  };
}

/**
 * 鼠标悬停预加载 Hook
 * 当鼠标悬停在元素上时触发预加载
 *
 * @example
 * const handlers = useHoverPrefetch('/api/dashboard');
 * <Link to="/dashboard" {...handlers}>Dashboard</Link>
 */
export function useHoverPrefetch(
  route: string,
  options?: Omit<PrefetchConfig, 'trigger'>
) {
  const { prefetch } = usePrefetchContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    // 延迟 100ms 后预加载，避免快速滑过时的不必要请求
    timerRef.current = setTimeout(() => {
      prefetch(route, { ...options, trigger: 'hover' });
    }, 100);
  }, [route, prefetch, options]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseEnter,
    onMouseLeave,
  };
}

/**
 * 可见性预加载 Hook
 * 当元素进入视口时触发预加载
 *
 * @example
 * const handlers = useVisiblePrefetch('/api/recommendations');
 * <div {...handlers}>推荐内容</div>
 */
export function useVisiblePrefetch<T extends HTMLElement = HTMLElement>(
  route: string,
  options?: Omit<PrefetchConfig, 'trigger'>,
  enabled = true,
) {
  const { prefetch } = usePrefetchContext();
  const ref = useRef<T>(null);
  const hasPrefetched = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPrefetched.current) {
            hasPrefetched.current = true;
            prefetch(route, { ...options, trigger: 'visible' });
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [route, prefetch, options, enabled]);

  return ref;
}

/**
 * 空闲时预加载 Hook
 * 使用 requestIdleCallback 在浏览器空闲时预加载
 *
 * @example
 * useIdlePrefetch('/api/analytics', { priority: 'low' });
 */
export function useIdlePrefetch(
  route: string,
  options?: Omit<PrefetchConfig, 'trigger'>,
  enabled = true,
) {
  const { prefetch } = usePrefetchContext();

  useEffect(() => {
    if (!enabled) return;
    const schedulePrefetch = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          prefetch(route, { ...options, trigger: 'idle' });
        }, { timeout: 5000 });
      } else {
        // Fallback for Safari
        setTimeout(() => {
          prefetch(route, { ...options, trigger: 'idle' });
        }, 200);
      }
    };

    schedulePrefetch();
  }, [route, prefetch, options, enabled]);
}

// ============================================================
// 组件
// ============================================================

/**
 * 智能预加载 Link 组件
 * 支持 hover/visible/idle 预加载策略
 *
 * @example
 * <PrefetchLink to="/dashboard" prefetch="hover">
 *   Dashboard
 * </PrefetchLink>
 */
interface PrefetchLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** 目标路径 */
  to: string;
  /** 预加载策略 */
  prefetch?: 'hover' | 'visible' | 'idle' | 'none';
  /** 替换历史记录 */
  replace?: boolean;
  children: ReactNode;
}

export function PrefetchLink({
  to,
  prefetch = 'hover',
  replace = false,
  children,
  onMouseEnter,
  onMouseLeave,
  ...props
}: PrefetchLinkProps) {
  const navigate = useNavigate();
  const hoverHandlers = useHoverPrefetch(to);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(to, { replace });
  };

  // 可见性预加载
  const visibleRef = useVisiblePrefetch<HTMLAnchorElement>(to, undefined, prefetch === 'visible');

  // 空闲预加载
  useIdlePrefetch(to, undefined, prefetch === 'idle');

  // 根据预加载策略组合事件处理
  const handlers: Record<string, React.EventHandler<React.SyntheticEvent>> = {};

  if (prefetch === 'hover') {
    handlers.onMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
      hoverHandlers.onMouseEnter();
      onMouseEnter?.(e);
    };
    handlers.onMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
      hoverHandlers.onMouseLeave();
      onMouseLeave?.(e);
    };
  }

  return (
    <a
      ref={prefetch === 'visible' ? visibleRef : undefined}
      href={to}
      onClick={handleClick}
      {...handlers}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * 批量预加载触发器组件
 * 在组件挂载时批量预加载数据
 *
 * @example
 * <PrefetchBatch
 *   routes={[
 *     { route: '/api/user/profile' },
 *     { route: '/api/notifications' },
 *   ]}
 * />
 */
interface PrefetchBatchProps {
  routes: Array<{
    route: string;
    options?: PrefetchConfig;
  }>;
  trigger?: 'mount' | 'visible';
  children?: ReactNode;
}

export function PrefetchBatch({ routes, trigger = 'mount' }: PrefetchBatchProps) {
  const { batchPrefetch } = usePrefetchContext();

  // mount 时预加载
  useEffect(() => {
    if (trigger === 'mount') {
      batchPrefetch(routes);
    }
  }, [routes, trigger, batchPrefetch]);

  // visible 时预加载
  useEffect(() => {
    if (trigger === 'visible') {
      batchPrefetch(routes);
    }
  }, [routes, trigger, batchPrefetch]);

  return null;
}

/**
 * 预加载边界组件
 * 在数据加载完成前显示 loading 状态
 *
 * @example
 * <PrefetchBoundary route="/api/dashboard" fallback={<Loading />}>
 *   {(data) => <Dashboard data={data} />}
 * </PrefetchBoundary>
 */
interface PrefetchBoundaryProps<T = unknown> {
  route: string;
  fallback?: ReactNode;
  children: (data: T) => ReactNode;
}

export function PrefetchBoundary<T = unknown>({
  route,
  fallback = null,
  children,
}: PrefetchBoundaryProps<T>) {
  const { data, isLoading } = usePrefetchQuery<T>({
    key: route,
    route,
    trigger: 'mount',
  });

  if (isLoading || !data) {
    return <>{fallback}</>;
  }

  return <>{children(data)}</>;
}
