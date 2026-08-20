/**
 * useRoutePrefetch 单元测试
 * 优化项 22: 预加载Next-fetch - getServerSideProps
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as React from 'react';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// 导入待测试的模块
import {
  PrefetchProvider,
  usePrefetch,
  usePrefetchQuery,
  usePrefetchState,
  useHoverPrefetch,
  useIdlePrefetch,
  PrefetchLink,
  PrefetchBatch,
  PrefetchBoundary,
  globalPrefetchCache,
} from './useRoutePrefetch';

// ============================================================
// 辅助函数
// ============================================================

function createMockResponse<T>(data: T, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  } as Response;
}

function setupMockFetch() {
  mockFetch.mockReset();
  return mockFetch;
}

// ============================================================
// PrefetchProvider 测试
// ============================================================

describe('PrefetchProvider', () => {
  beforeEach(() => {
    globalPrefetchCache.clear();
    setupMockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该提供预加载上下文', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => usePrefetch(), { wrapper });

    expect(result.current).toBeDefined();
    expect(typeof result.current.prefetch).toBe('function');
    expect(typeof result.current.batchPrefetch).toBe('function');
    expect(typeof result.current.clearCache).toBe('function');
    expect(typeof result.current.getPrefetchState).toBe('function');
  });

  it('应该预加载数据并缓存', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockFetch.mockResolvedValue(createMockResponse(mockData));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => usePrefetch(), { wrapper });

    await act(async () => {
      const data = await result.current.prefetch('/api/test');
      expect(data).toEqual(mockData);
    });

    // 验证数据被缓存
    const cached = globalPrefetchCache.get('/api/test');
    expect(cached).toBeTruthy();
    expect(cached?.data).toEqual(mockData);
  });

  it('应该避免重复请求', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockFetch.mockResolvedValue(createMockResponse(mockData));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => usePrefetch(), { wrapper });

    await act(async () => {
      // 并行调用两次预加载
      await Promise.all([
        result.current.prefetch('/api/test'),
        result.current.prefetch('/api/test'),
      ]);
    });

    // fetch 应该只被调用一次
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('应该批量预加载多个路由', async () => {
    mockFetch
      .mockResolvedValueOnce(createMockResponse({ id: 1 }))
      .mockResolvedValueOnce(createMockResponse({ id: 2 }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => usePrefetch(), { wrapper });

    await act(async () => {
      await result.current.batchPrefetch([
        { route: '/api/test1' },
        { route: '/api/test2' },
      ]);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('应该清除缓存', async () => {
    const mockData = { id: 1 };
    mockFetch.mockResolvedValue(createMockResponse(mockData));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => usePrefetch(), { wrapper });

    await act(async () => {
      await result.current.prefetch('/api/test');
    });

    let cached = globalPrefetchCache.get('/api/test');
    expect(cached).toBeTruthy();

    await act(async () => {
      result.current.clearCache('/api/test');
    });

    cached = globalPrefetchCache.get('/api/test');
    expect(cached).toBeNull();
  });
});

// ============================================================
// usePrefetchQuery 测试
// ============================================================

describe('usePrefetchQuery', () => {
  beforeEach(() => {
    globalPrefetchCache.clear();
    setupMockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该立即加载数据 when immediate=true', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockFetch.mockResolvedValue(createMockResponse(mockData));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() =>
      usePrefetchQuery({
        key: 'test',
        route: '/api/test',
        trigger: 'mount',
        immediate: true,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isError).toBe(false);
  });

  it('应该设置初始数据', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() =>
      usePrefetchQuery({
        key: 'test',
        route: '/api/test',
        initialData: { id: 0, name: 'Initial' },
      }),
      { wrapper }
    );

    expect(result.current.data).toEqual({ id: 0, name: 'Initial' });
    expect(result.current.isLoading).toBe(false);
  });

  it('应该处理错误', async () => {
    mockFetch.mockResolvedValue(createMockResponse({ error: 'Not found' }, false));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() =>
      usePrefetchQuery({
        key: 'test',
        route: '/api/test',
        trigger: 'mount',
        immediate: true,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('refetch 应该重新获取数据', async () => {
    mockFetch
      .mockResolvedValueOnce(createMockResponse({ id: 1 }))
      .mockResolvedValueOnce(createMockResponse({ id: 2 }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() =>
      usePrefetchQuery({
        key: 'test',
        route: '/api/test',
        trigger: 'mount',
        immediate: true,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 });
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 2 });
    });
  });
});

// ============================================================
// useHoverPrefetch 测试
// ============================================================

describe('useHoverPrefetch', () => {
  beforeEach(() => {
    globalPrefetchCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('应该返回 onMouseEnter 和 onMouseLeave 事件处理', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => useHoverPrefetch('/api/test'), { wrapper });

    expect(typeof result.current.onMouseEnter).toBe('function');
    expect(typeof result.current.onMouseLeave).toBe('function');
  });
});

// ============================================================
// usePrefetchState 测试
// ============================================================

describe('usePrefetchState', () => {
  beforeEach(() => {
    globalPrefetchCache.clear();
    setupMockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该获取预加载状态', async () => {
    const mockData = { id: 1 };
    mockFetch.mockResolvedValue(createMockResponse(mockData));

    // 先预加载数据
    globalPrefetchCache.set('/api/test', mockData);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => usePrefetchState('/api/test'), { wrapper });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toEqual(mockData);
  });
});

// ============================================================
// globalPrefetchCache 测试
// ============================================================

describe('globalPrefetchCache', () => {
  beforeEach(() => {
    globalPrefetchCache.clear();
  });

  it('应该存储和获取数据', () => {
    globalPrefetchCache.set('/api/test', { id: 1 });
    const cached = globalPrefetchCache.get('/api/test');

    expect(cached).toBeTruthy();
    expect(cached?.data).toEqual({ id: 1 });
  });

  it('应该处理数据过期', () => {
    globalPrefetchCache.set('/api/test', { id: 1 });

    // 模拟时间流逝 (超过 30 秒缓存时间)
    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);
    vi.useRealTimers();

    const cached = globalPrefetchCache.get('/api/test', 30_000);
    expect(cached).toBeNull();
  });

  it('应该存储错误状态', () => {
    const error = new Error('Test error');
    globalPrefetchCache.set('/api/test', null, error);
    const cached = globalPrefetchCache.get('/api/test');

    expect(cached?.error).toBe(error);
  });

  it('应该追踪待处理的请求', async () => {
    const promise = Promise.resolve({ id: 1 });
    globalPrefetchCache.setPending('/api/test', promise as Promise<unknown>);

    const pending = globalPrefetchCache.getPending('/api/test');
    expect(pending).toBe(promise);

    await act(async () => {
      await promise;
    });
  });

  it('should clear all cache when no key provided', () => {
    globalPrefetchCache.set('/api/test1', { id: 1 });
    globalPrefetchCache.set('/api/test2', { id: 2 });

    globalPrefetchCache.clear();

    expect(globalPrefetchCache.get('/api/test1')).toBeNull();
    expect(globalPrefetchCache.get('/api/test2')).toBeNull();
  });
});

// ============================================================
// PrefetchBoundary 测试
// ============================================================

describe('PrefetchBoundary', () => {
  beforeEach(() => {
    globalPrefetchCache.clear();
    setupMockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该显示 fallback when loading', async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // 永不解决

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    render(
      <PrefetchBoundary
        route="/api/test"
        fallback={<div>Loading...</div>}
      >
        {(data) => <div>Data: {JSON.stringify(data)}</div>}
      </PrefetchBoundary>,
      { wrapper }
    );

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('应该在数据加载后显示内容', async () => {
    const mockData = { id: 1 };
    mockFetch.mockResolvedValue(createMockResponse(mockData));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    render(
      <PrefetchBoundary
        route="/api/test"
        fallback={<div>Loading...</div>}
      >
        {(data) => <div>Data: {JSON.stringify(data)}</div>}
      </PrefetchBoundary>,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText(/Data/)).toBeTruthy();
    });
  });
});

// ============================================================
// 性能测试
// ============================================================

describe('性能测试', () => {
  beforeEach(() => {
    globalPrefetchCache.clear();
    setupMockFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('应该避免并发请求相同资源', async () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(createMockResponse({ id: 1 })), 100))
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PrefetchProvider>{children}</PrefetchProvider>
    );

    const { result } = renderHook(() => usePrefetch(), { wrapper });

    // 同时触发多个预加载请求
    await act(async () => {
      const promises = Array.from({ length: 5 }, () =>
        result.current.prefetch('/api/test')
      );
      await Promise.all(promises);
    });

    // fetch 应该只被调用一次
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
