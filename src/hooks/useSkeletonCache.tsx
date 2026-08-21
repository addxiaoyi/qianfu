/**
 * 骨架屏缓存 Hook
 * 优化项23: 骨架屏缓存 - Loading状态
 *
 * 功能：
 * 1. 缓存骨架屏渲染状态，避免重复创建
 * 2. 支持骨架屏预热，减少首次渲染延迟
 * 3. 提供骨架屏占位符复用
 * 4. 数据获取 + 骨架屏状态管理集成
 */
import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import {
  SkeletonList,
  SkeletonTable,
  SkeletonForm,
  SkeletonStats,
  SkeletonPage,
} from '@/components/ui/Skeleton';

// ============================================================
// 缓存配置
// ============================================================

interface SkeletonCacheConfig {
  /** 缓存大小限制 */
  maxCacheSize?: number;
  /** 缓存过期时间(ms) */
  cacheExpiry?: number;
  /** 是否启用调试日志 */
  debug?: boolean;
}

const DEFAULT_CONFIG: Required<SkeletonCacheConfig> = {
  maxCacheSize: 100,
  cacheExpiry: 5 * 60 * 1000, // 5分钟
  debug: false,
};

// ============================================================
// LRU 缓存实现
// ============================================================

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 移到末尾（最近使用）
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getKeys(): K[] {
    return Array.from(this.cache.keys());
  }
}

// 全局骨架屏缓存实例
const globalSkeletonCache = new LRUCache<string, React.ReactNode>(DEFAULT_CONFIG.maxCacheSize);

// ============================================================
// 骨架屏缓存Hook
// ============================================================

/**
 * 骨架屏缓存Hook
 * @param cacheKey 缓存键
 * @param SkeletonComponent 骨架屏组件
 * @param config 配置
 */
export function useSkeletonCache<T extends React.ComponentType<any>>(
  cacheKey: string,
  SkeletonComponent: T,
  config: SkeletonCacheConfig = {}
): {
  /** 获取缓存的骨架屏 */
  getCached: () => React.ReactNode | null;
  /** 预热缓存 */
  warmup: () => void;
  /** 清除缓存 */
  clear: () => void;
  /** 是否已缓存 */
  isCached: () => boolean;
} {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const warmupped = useRef(false);

  // 获取缓存
  const getCached = useCallback(() => {
    if (globalSkeletonCache.has(cacheKey)) {
      if (finalConfig.debug) {
        /* console.log(`[SkeletonCache] Hit: ${cacheKey}`); */
      }
      return globalSkeletonCache.get(cacheKey);
    }
    return null;
  }, [cacheKey, finalConfig.debug]);

  // 预热缓存
  const warmup = useCallback(() => {
    if (warmupped.current) return;
    warmupped.current = true;

    if (finalConfig.debug) {
      /* console.log(`[SkeletonCache] Warmup: ${cacheKey}`); */
    }

    // 使用requestIdleCallback延迟预热，避免阻塞主线程
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // 缓存骨架屏实例
        const Skeleton = SkeletonComponent as React.ComponentType;
        globalSkeletonCache.set(cacheKey, <Skeleton />);
      });
    }
  }, [cacheKey, SkeletonComponent, finalConfig.debug]);

  // 清除缓存
  const clear = useCallback(() => {
    globalSkeletonCache.clear();
    warmupped.current = false;
    if (finalConfig.debug) {
      /* console.log('[SkeletonCache] Cleared all'); */
    }
  }, [finalConfig.debug]);

  // 检查是否已缓存
  const isCached = useCallback(() => {
    return globalSkeletonCache.has(cacheKey);
  }, [cacheKey]);

  return { getCached, warmup, clear, isCached };
}

// ============================================================
// 骨架屏占位符缓存
// ============================================================

interface PlaceholderConfig {
  /** 行数 */
  rows?: number;
  /** 行高 */
  rowHeight?: number;
  /** 行间距 */
  rowGap?: number;
  /** 是否显示头像占位符 */
  showAvatar?: boolean;
  /** 是否显示操作按钮占位符 */
  showActions?: boolean;
}

const defaultPlaceholderConfig: PlaceholderConfig = {
  rows: 3,
  rowHeight: 16,
  rowGap: 8,
  showAvatar: true,
  showActions: false,
};

/**
 * 生成骨架屏占位符的缓存键
 */
function getPlaceholderKey(config: PlaceholderConfig): string {
  const { rows, rowHeight, rowGap, showAvatar, showActions } = {
    ...defaultPlaceholderConfig,
    ...config,
  };
  return `placeholder-${rows}-${rowHeight}-${rowGap}-${showAvatar}-${showActions}`;
}

/**
 * 预创建的骨架屏占位符缓存
 */
const placeholderCache = new LRUCache<string, React.ReactNode>(20);

/**
 * 骨架屏占位符Hook
 * @param config 配置
 */
export function useSkeletonPlaceholder(config: PlaceholderConfig = {}) {
  const finalConfig = { ...defaultPlaceholderConfig, ...config };
  const cacheKey = getPlaceholderKey(finalConfig);

  const placeholder = useMemo(() => {
    // 检查缓存
    const cached = placeholderCache.get(cacheKey);
    if (cached) return cached;

    // 创建新的占位符
    const { rows, rowHeight, showAvatar, showActions } = finalConfig;
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < rows; i++) {
      elements.push(
        <div key={i} className="flex items-center gap-4">
          {showAvatar && (
            <div
              className="w-12 h-12 rounded-full bg-zinc-100 animate-pulse flex-shrink-0"
              style={{ height: rowHeight * 3 }}
            />
          )}
          <div className="flex-1 space-y-2">
            <div
              className="h-4 bg-zinc-100 rounded animate-pulse"
              style={{ width: `${70 + Math.random() * 30}%` }}
            />
            <div
              className="h-3 bg-zinc-50 rounded animate-pulse"
              style={{ width: `${40 + Math.random() * 40}%` }}
            />
          </div>
          {showActions && (
            <div className="w-20 h-8 bg-zinc-100 rounded-lg animate-pulse" />
          )}
        </div>
      );
    }

    const placeholderEl = (
      <div className="space-y-4">
        {elements}
      </div>
    );

    // 缓存
    placeholderCache.set(cacheKey, placeholderEl);
    return placeholderEl;
  }, [cacheKey, finalConfig]);

  return placeholder;
}

// ============================================================
// 骨架屏预热工具
// ============================================================

interface WarmupOptions {
  /** 预热哪些骨架屏 */
  types: ('card' | 'table' | 'list' | 'form' | 'stats')[];
  /** 延迟预热时间(ms) */
  delay?: number;
  /** 完成后回调 */
  onComplete?: () => void;
}

const warmupTasks: Map<string, () => void> = new Map();

/**
 * 批量预热骨架屏
 */
export function warmupSkeletons(options: WarmupOptions): () => void {
  const { types, delay = 100, onComplete } = options;
  const timeoutId = setTimeout(() => {
    types.forEach((type) => {
      if (!warmupTasks.has(type)) {
        // 触发预热
        warmupTasks.set(type, () => {
          // 骨架屏预热逻辑
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            requestIdleCallback(() => {
              warmupTasks.delete(type);
            }, { timeout: 1000 });
          }
        });
      }
    });
    onComplete?.();
  }, delay);

  return () => clearTimeout(timeoutId);
}

/**
 * 清除所有预热任务
 */
export function clearWarmupTasks(): void {
  warmupTasks.clear();
}

// ============================================================
// 数据获取 + 骨架屏集成Hook
// ============================================================

export type SkeletonType = 'card' | 'list' | 'table' | 'form' | 'stats' | 'page';

interface UseAsyncDataOptions<T> {
  /** 唯一键 */
  key: string;
  /** 数据获取函数 */
  fetcher: () => Promise<T>;
  /** 是否立即加载 */
  immediate?: boolean;
  /** 缓存时间(ms) */
  cacheTime?: number;
}

interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  skeletonType: SkeletonType;
}

/**
 * 数据获取 + 骨架屏状态管理
 * @param options 配置
 */
export function useAsyncDataWithSkeleton<T>(options: UseAsyncDataOptions<T>): AsyncDataState<T> & {
  skeleton: React.ReactNode;
  refresh: () => Promise<void>;
  setSkeletonType: (type: SkeletonType) => void;
} {
  const { key, fetcher, immediate = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);
  const [skeletonType, setSkeletonType] = useState<SkeletonType>('list');

  // 根据类型获取骨架屏
  const skeleton = useMemo(() => {
    switch (skeletonType) {
      case 'card':
        return <SkeletonList rows={5} />;
      case 'table':
        return <SkeletonTable columns={4} rows={8} />;
      case 'form':
        return <SkeletonForm groups={3} fieldsPerGroup={2} />;
      case 'stats':
        return <SkeletonStats cards={4} />;
      case 'page':
        return <SkeletonPage type="dashboard" />;
      case 'list':
      default:
        return <SkeletonList rows={8} showAvatar showAction />;
    }
  }, [skeletonType]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [immediate, fetchData, key]);

  return {
    data,
    loading,
    error,
    skeletonType,
    skeleton,
    refresh: fetchData,
    setSkeletonType,
  };
}

// ============================================================
// 全局骨架屏缓存状态
// ============================================================

interface GlobalSkeletonState {
  warmupComplete: boolean;
  cachedTypes: Set<string>;
}

const globalSkeletonState: GlobalSkeletonState = {
  warmupComplete: false,
  cachedTypes: new Set(),
};

/**
 * 获取全局骨架屏状态
 */
export function getGlobalSkeletonState(): Readonly<GlobalSkeletonState> {
  return { ...globalSkeletonState };
}

/**
 * 标记骨架屏类型已缓存
 */
export function markSkeletonTypeCached(type: string): void {
  globalSkeletonState.cachedTypes.add(type);
}

// ============================================================
// 调试工具
// ============================================================

export function getSkeletonCacheStats(): {
  size: number;
  maxSize: number;
  keys: string[];
} {
  return {
    size: globalSkeletonCache.size(),
    maxSize: DEFAULT_CONFIG.maxCacheSize,
    keys: globalSkeletonCache.getKeys(),
  };
}
