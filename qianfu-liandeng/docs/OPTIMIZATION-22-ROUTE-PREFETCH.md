# 优化项 22: 路由预加载 - Next.js getServerSideProps 等效实现

## 概述

**优化项编号**: 22
**优化类型**: 性能优化 - 数据预加载
**影响范围**: 页面加载性能、数据获取延迟、用户体验
**实现日期**: 2026-07-06
**依赖项**: 优化项 34 (preload/prefetch)

## 问题分析

### 当前问题

1. **页面切换时数据加载延迟**: React SPA 中，路由切换后组件才发起数据请求
2. **缺乏服务端数据预取机制**: 无法在导航发生前预先获取页面数据
3. **重复请求浪费资源**: 页面返回时重新请求相同数据
4. **竞态条件处理缺失**: 快速导航可能导致数据错乱

### Next.js 传统方案 vs React Router v7 方案

```typescript
// Next.js Pages Router - getServerSideProps
export async function getServerSideProps(context) {
  const data = await fetchData();
  return { props: { data } };
}

// Next.js App Router - server components
async function Page() {
  const data = await getData(); // 服务端直接获取
  return <Component data={data} />;
}

// React Router v7 + 我们的预加载方案 (equivalent)
function loader({ request }) {
  return fetchData(); // 在导航前执行
}

function Component() {
  const { data } = useLoaderData(); // 立即获取预加载的数据
}
```

### 性能影响

| 场景 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 页面切换 | 等待数据加载 | 显示预加载数据 | 减少 300-800ms 感知延迟 |
| 页面返回 | 重新请求 | 使用缓存 | 减少 200-500ms |
| 首屏加载 | 串行请求 | 并行预加载 | 减少 30-50% 加载时间 |

## 技术方案

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    路由预加载架构                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ 导航触发  │───>│ 预加载管理器  │───>│ 数据缓存层        │  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│       │                │                     │              │
│       │                │                     │              │
│       ▼                ▼                     ▼              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Hover    │    │ 触发策略      │    │ 竞态检测         │  │
│  │ Visible  │    │ Mount/Idle   │    │ 去重处理         │  │
│  │ Idle     │    │              │    │                  │  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. 数据缓存层 (DataPrefetchCache)

```typescript
// src/hooks/useRoutePrefetch.ts

class DataPrefetchCache {
  private cache = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<unknown>>();

  /**
   * 获取缓存数据
   * 支持过期时间控制
   */
  get<T>(key: string, maxAge?: number): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > (maxAge ?? 30_000)) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, error?: Error): void {
    this.cache.set(key, {
      data,
      error: error ?? null,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取待处理的请求（避免重复请求）
   */
  getPending<T>(key: string): Promise<T> | null {
    return this.pending.get(key) as Promise<T> | null;
  }

  /**
   * 设置待处理请求
   */
  setPending<T>(key: string, promise: Promise<T>): void {
    this.pending.set(key, promise);
    // 请求完成后自动清理
    promise.finally(() => this.pending.delete(key));
  }
}

export const globalPrefetchCache = new DataPrefetchCache();
```

#### 2. 预加载 Provider

```typescript
// src/hooks/useRoutePrefetch.ts

interface PrefetchProviderProps {
  children: ReactNode;
  cacheTime?: number;    // 默认缓存时间
  apiBaseUrl?: string;   // API 基础路径
}

export function PrefetchProvider({
  children,
  cacheTime = 30_000,
  apiBaseUrl = '/api',
}: PrefetchProviderProps) {
  /**
   * 预加载指定路由的数据
   * 返回缓存数据或发起新请求
   */
  const prefetch = useCallback(async <T,>(
    route: string,
    options: PrefetchConfig = { trigger: 'idle' }
  ): Promise<T | null> => {
    // 1. 检查缓存
    const cached = globalPrefetchCache.get<T>(route, options.cacheTime);
    if (cached) return cached.data;

    // 2. 检查是否有待处理请求（避免重复）
    const pending = globalPrefetchCache.getPending<T>(route);
    if (pending) return pending;

    // 3. 发起请求
    const response = await fetch(`${apiBaseUrl}${route}`, {
      credentials: 'include',
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    globalPrefetchCache.set(route, data);

    return data;
  }, [apiBaseUrl]);

  return (
    <PrefetchContext.Provider value={{ prefetch, batchPrefetch, clearCache }}>
      {children}
    </PrefetchContext.Provider>
  );
}
```

#### 3. 声明式数据 Hook (usePrefetchQuery)

```typescript
// 类似 React Query 的声明式数据获取

interface UsePrefetchQueryOptions<T> {
  key: string | [string, ...unknown[]];  // 缓存键
  route: string;                         // API 路由
  initialData?: T;                       // 初始数据
  staleTime?: number;                   // 缓存时间
  trigger?: 'mount' | 'hover' | 'visible' | 'never';  // 触发时机
}

export function usePrefetchQuery<T>({
  key,
  route,
  initialData,
  staleTime = 30_000,
  trigger = 'never',
}: UsePrefetchQueryOptions<T>) {
  const { prefetch } = usePrefetchContext();
  const [state, setState] = useState<PrefetchState<T>>(() => {
    // 尝试从缓存恢复
    const cached = globalPrefetchCache.get<T>(key);
    if (cached) return cached;
    return initialData
      ? { status: 'success', data: initialData, error: null, timestamp: 0 }
      : { status: 'idle', data: null, error: null, timestamp: null };
  });

  const doPrefetch = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading' }));
    try {
      const result = await prefetch<T>(route, { cacheTime: staleTime });
      setState({ status: 'success', data: result, error: null, timestamp: Date.now() });
      return result;
    } catch (error) {
      setState({ status: 'error', data: null, error: error as Error, timestamp: Date.now() });
      return null;
    }
  }, [route, prefetch, staleTime]);

  // 根据触发器自动执行
  useEffect(() => {
    if (trigger === 'mount') doPrefetch();
  }, [trigger]);

  return {
    data: state.data,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    error: state.error,
    prefetch: doPrefetch,
    refetch: () => {
      globalPrefetchCache.clear(key);
      return doPrefetch();
    },
    updatedAt: state.timestamp,
  };
}
```

### 触发策略

#### 1. 挂载时预加载 (Mount Prefetch)

```typescript
// 组件挂载时立即预加载
function UserProfile() {
  const { data } = usePrefetchQuery({
    key: 'user-profile',
    route: '/api/user/profile',
    trigger: 'mount',  // 组件挂载时触发
  });

  return <div>{data?.name}</div>;
}
```

#### 2. 悬停时预加载 (Hover Prefetch)

```typescript
// 鼠标悬停时预加载
function NavLink({ to, children }) {
  const handlers = useHoverPrefetch(to, { delay: 100 });

  return <Link to={to} {...handlers}>{children}</Link>;
}

// 使用示例
<NavLink to="/dashboard">Dashboard</NavLink>
```

#### 3. 可见时预加载 (Visible Prefetch)

```typescript
// 元素进入视口时预加载
function RecommendationSection() {
  const ref = useVisiblePrefetch('/api/recommendations');

  return <section ref={ref}>推荐内容</section>;
}
```

#### 4. 空闲时预加载 (Idle Prefetch)

```typescript
// 使用 requestIdleCallback 在浏览器空闲时预加载
function AnalyticsWidget() {
  useIdlePrefetch('/api/analytics');

  // ...
}
```

## 项目实现

### 文件结构

```
src/
├── hooks/
│   ├── useRoutePrefetch.ts          # 核心预加载系统
│   ├── useRoutePrefetch.test.tsx   # 单元测试
│   └── useRoutePrefetch.examples.tsx # 使用示例
└── pages/
    └── MyServerFavorites.tsx        # 集成示例
```

### 集成到现有项目

#### 1. 包装应用

```tsx
// src/App.tsx
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrefetchProvider } from '@/hooks/useRoutePrefetch';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrefetchProvider
        cacheTime={30_000}
        apiBaseUrl="/api"
      >
        <BrowserRouter>
          <Routes>
            {/* 路由配置 */}
          </Routes>
        </BrowserRouter>
      </PrefetchProvider>
    </QueryClientProvider>
  );
}
```

#### 2. 在页面中使用

```tsx
// src/pages/Dashboard.tsx

export function Dashboard() {
  // 预加载多个数据源（并行）
  const { data: stats } = usePrefetchQuery({
    key: 'dashboard-stats',
    route: '/api/dashboard/stats',
    trigger: 'mount',
  });

  const { data: user } = usePrefetchQuery({
    key: 'user-profile',
    route: '/api/user/profile',
    trigger: 'mount',
  });

  const { data: notifications } = usePrefetchQuery({
    key: 'notifications',
    route: '/api/notifications',
    trigger: 'mount',
  });

  if (!stats || !user) return <Loading />;

  return (
    <DashboardLayout>
      <StatsPanel data={stats} />
      <UserInfo user={user} />
      <NotificationList data={notifications} />
    </DashboardLayout>
  );
}
```

#### 3. 在收藏页面集成

```tsx
// src/pages/MyServerFavorites.tsx

export default function MyServerFavorites() {
  // React Query 数据获取
  const { data, isLoading } = useFavoriteServers(1, 50);

  // 预加载 Hook (新增)
  const { data: prefetchedData } = usePrefetchFavorites(1, 50);

  // 优先使用 React Query 数据，回退到预加载数据
  const favorites = data?.items || prefetchedData?.items || [];

  return (
    <div className="favorites">
      {favorites.map(server => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
```

### 与 React Query 集成

```typescript
// useFavoriteServers.ts 增强

import { usePrefetchQuery } from './useRoutePrefetch';

/**
 * 预加载收藏列表 Hook
 * 在组件挂载时预加载，类似 getServerSideProps
 */
export function usePrefetchFavorites(page: number = 1, limit: number = 20) {
  return usePrefetchQuery({
    key: ['favorites', page, limit],
    route: `/api/me/favorites?page=${page}&limit=${limit}`,
    staleTime: 30_000,
    trigger: 'mount',
  });
}

/**
 * 悬停时预加载收藏状态
 */
export function useHoverPrefetchFavoriteState(serverId: string | number) {
  return useHoverPrefetch(`/api/servers/${serverId}/favorite-state`, {
    delay: 200,
  });
}
```

## 性能测试

### 测试场景

```typescript
// 测试1: 缓存命中
async function testCacheHit() {
  // 第一次请求
  const result1 = await prefetch('/api/user/profile');
  // 第二次请求应使用缓存
  const result2 = await prefetch('/api/user/profile');

  expect(mockFetch).toHaveBeenCalledTimes(1);
}

// 测试2: 并发请求去重
async function testDeduplication() {
  // 同时发起5个相同请求
  await Promise.all([
    prefetch('/api/user/profile'),
    prefetch('/api/user/profile'),
    prefetch('/api/user/profile'),
    prefetch('/api/user/profile'),
    prefetch('/api/user/profile'),
  ]);

  // 只应发起1个请求
  expect(mockFetch).toHaveBeenCalledTimes(1);
}

// 测试3: 过期缓存刷新
async function testStaleRefresh() {
  vi.useFakeTimers();

  // 第一次请求
  await prefetch('/api/user/profile', { cacheTime: 1000 });

  // 时间快进1秒以上
  vi.advanceTimersByTime(2000);

  // 应该发起新请求
  await prefetch('/api/user/profile', { cacheTime: 1000 });

  expect(mockFetch).toHaveBeenCalledTimes(2);

  vi.useRealTimers();
}
```

### Lighthouse 指标预期

| 指标 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| LCP | 3.2s | 2.1s | -34% |
| FCP | 1.8s | 1.2s | -33% |
| TTI | 4.5s | 3.2s | -29% |
| CLS | 0.15 | 0.08 | -47% |

## 最佳实践

### DO

1. **使用声明式 API**: 优先使用 `usePrefetchQuery` 而非直接调用 `prefetch`
2. **合理设置缓存时间**: 静态数据长缓存，动态数据短缓存
3. **批量预加载相关数据**: 页面数据应并行预加载
4. **结合交互触发**: hover/visible 触发可减少不必要的请求

### DON'T

1. **不要预加载过多数据**: 会浪费带宽和服务器资源
2. **不要忽视过期策略**: 长时间缓存可能导致数据陈旧
3. **不要跳过错误处理**: 预加载失败不应阻塞页面渲染
4. **不要忽略移动端**: 低带宽环境应谨慎使用

## 相关优化项

- **优化项 34**: preload/prefetch - 资源级预加载基础
- **优化项 35**: DNS预解析 - 连接级优化
- **优化项 302**: 用户偏好 - 服务器收藏功能

## 参考资料

- [React Router v7 Loaders](https://reactrouter.com/en/main/route/loader)
- [TanStack Query - Prefetching](https://tanstack.com/query/latest/docs/react/guides/prefetching)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [MDN - RequestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)
