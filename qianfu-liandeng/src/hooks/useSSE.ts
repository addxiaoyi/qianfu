import { safeJsonParse } from '@/utils/json';
/**
 * SSE (Server-Sent Events) 客户端 Hook
 * 优化项 24: 实时订阅 - Server-Sent Events
 *
 * 功能:
 * - 建立和管理 SSE 连接
 * - 自动重连
 * - 事件订阅
 * - 连接状态管理
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const MAX_CHAT_MESSAGES = 200;
export const MAX_PROGRESS_TASKS = 100;
const PROGRESS_TTL_MS = 10 * 60 * 1000;
const TERMINAL_PROGRESS_TTL_MS = 60 * 1000;

export interface ProgressEntry {
  data: unknown;
  updatedAt: number;
  expiresAt: number;
}

export function isTerminalProgressEvent(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const event = data as { done?: unknown; status?: unknown };
  if (event.done === true) return true;
  return ['completed', 'complete', 'finished', 'failed', 'error', 'timeout', 'expired']
    .includes(String(event.status || '').toLowerCase());
}

export function pruneProgressEntries(
  entries: Map<string, ProgressEntry>,
  now = Date.now(),
): Map<string, ProgressEntry> {
  const next = new Map(entries);
  for (const [taskId, entry] of next) {
    if (entry.expiresAt <= now) next.delete(taskId);
  }

  if (next.size <= MAX_PROGRESS_TASKS) return next;
  const oldest = [...next.entries()]
    .sort(([, left], [, right]) => left.updatedAt - right.updatedAt);
  for (const [taskId] of oldest.slice(0, next.size - MAX_PROGRESS_TASKS)) {
    next.delete(taskId);
  }
  return next;
}

export interface SSEEvent {
  event: string;
  data: unknown;
  id?: string;
  lastEventId?: string;
}

export interface SSEOptions {
  /** SSE 连接地址 */
  url: string;
  /** 订阅的频道 */
  channels?: string[];
  /** 用户 ID (已登录用户) */
  userId?: string;
  /** 客户端 ID (匿名用户) */
  clientId?: string;
  /** 自动重连 (默认: true) */
  autoReconnect?: boolean;
  /** 重连间隔 (默认: 3000ms) */
  reconnectInterval?: number;
  /** 最大重连次数 (默认: 10) */
  maxReconnectAttempts?: number;
  /** 是否立即连接 (默认: true) */
  immediate?: boolean;
}

export interface SSEState {
  /** 连接状态 */
  connected: boolean;
  /** 连接 ID */
  connectionId: string | null;
  /** 错误信息 */
  error: string | null;
  /** 重连次数 */
  reconnectAttempts: number;
  /** 最后接收事件时间 */
  lastEventTime: Date | null;
}

export interface UseSSEReturn {
  /** SSE 状态 */
  state: SSEState;
  /** 发送事件 */
  sendEvent: (channel: string, event: string, data: unknown) => void;
  /** 断开连接 */
  disconnect: () => void;
  /** 重新连接 */
  reconnect: () => void;
  /** 订阅事件 */
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  /** 事件历史 */
  events: Map<string, unknown[]>;
}

/**
 * SSE Hook
 *
 * @example
 * ```tsx
 * function NotificationComponent() {
 *   const { state, subscribe } = useSSE({
 *     url: '/api/sse/connect',
 *     userId: 'user_123',
 *     channels: ['notification'],
 *   });
 *
 *   useEffect(() => {
 *     const unsubscribe = subscribe('notification', (data) => {
 *       // console.log('New notification:', data);
 *       // 显示通知
 *     });
 *     return unsubscribe;
 *   }, []);
 *
 *   if (!state.connected) {
 *     return <div>连接中...</div>;
 *   }
 *
 *   return <div>已连接: {state.connectionId}</div>;
 * }
 * ```
 */
export function useSSE(options: SSEOptions): UseSSEReturn {
  const {
    url,
    channels = ['notification'],
    userId,
    clientId,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    immediate = true,
  } = options;

  // 状态
  const [state, setState] = useState<SSEState>({
    connected: false,
    connectionId: null,
    error: null,
    reconnectAttempts: 0,
    lastEventTime: null,
  });

  // 事件历史
  const [events, setEvents] = useState<Map<string, unknown[]>>(new Map());

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventListenersRef = useRef(new Map<EventSource, Array<[string, EventListener]>>());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionsRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const mountedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const optionsRef = useRef({
    url,
    channels,
    userId,
    clientId,
    autoReconnect,
    reconnectInterval,
    maxReconnectAttempts,
  });
  optionsRef.current = {
    url,
    channels,
    userId,
    clientId,
    autoReconnect,
    reconnectInterval,
    maxReconnectAttempts,
  };

  const cleanupEventSource = useCallback((eventSource: EventSource) => {
    const listeners = eventListenersRef.current.get(eventSource) ?? [];
    for (const [eventName, listener] of listeners) {
      eventSource.removeEventListener(eventName, listener);
    }
    eventListenersRef.current.delete(eventSource);
    eventSource.onerror = null;
    eventSource.close();
  }, []);

  /**
   * 构建 SSE 连接 URL
   */
  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    const {
      url: currentUrl,
      userId: currentUserId,
      clientId: currentClientId,
      channels: currentChannels,
    } = optionsRef.current;

    if (currentUserId) {
      params.set('userId', currentUserId);
    }
    if (currentClientId) {
      params.set('clientId', currentClientId);
    }
    if (currentChannels.length > 0) {
      params.set('channels', currentChannels.join(','));
    }

    const queryString = params.toString();
    return queryString ? `${currentUrl}?${queryString}` : currentUrl;
  }, []);

  /**
   * 处理事件
   */
  const handleEvent = useCallback((eventName: string, data: unknown) => {
    if (!mountedRef.current) return;

    setState(prev => ({ ...prev, lastEventTime: new Date() }));

    // 记录事件历史
    setEvents(prev => {
      const newEvents = new Map(prev);
      const eventList = [...(newEvents.get(eventName) || []), data].slice(-100);
      newEvents.set(eventName, eventList);
      return newEvents;
    });

    // 触发订阅回调
    const callbacks = subscriptionsRef.current.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[SSE] Error in ${eventName} handler:`, error);
        }
      });
    }
  }, []);

  /**
   * 连接 SSE
   */
  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    // 清除已有连接
    if (eventSourceRef.current) {
      cleanupEventSource(eventSourceRef.current);
    }

    const fullUrl = buildUrl();
    const eventSource = new EventSource(fullUrl);
    eventSourceRef.current = eventSource;

    // 连接成功
    const addListener = (eventName: string, listener: EventListener) => {
      eventSource.addEventListener(eventName, listener);
      const listeners = eventListenersRef.current.get(eventSource) ?? [];
      listeners.push([eventName, listener]);
      eventListenersRef.current.set(eventSource, listeners);
    };

    addListener('connected', (event) => {
      if (!mountedRef.current || eventSource !== eventSourceRef.current) return;
      reconnectAttemptsRef.current = 0;
      try {
        const data = (() => { try { return JSON.parse((event as MessageEvent).data); } catch { return null; } })();
        setState(prev => ({
          ...prev,
          connected: true,
          connectionId: data.connectionId,
          error: null,
          reconnectAttempts: 0,
        }));
      } catch {
        setState(prev => ({
          ...prev,
          connected: true,
          error: null,
        }));
      }
    });

    // 心跳
    addListener('heartbeat', (event) => {
      try {
        (() => { try { return JSON.parse((event as MessageEvent).data); } catch { return null; } })();
      } catch {
        // ignore parse error for heartbeat
      }
    });

    // 错误处理
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);

      if (!mountedRef.current || eventSource !== eventSourceRef.current) return;

      if (eventSource.readyState === EventSource.CLOSED) {
        const currentOptions = optionsRef.current;
        const currentAttempts = reconnectAttemptsRef.current;
        setState(prev => ({
          ...prev,
          connected: false,
          error: 'Connection closed',
        }));

        // 自动重连
        if (currentOptions.autoReconnect && currentAttempts < currentOptions.maxReconnectAttempts) {
          const attempts = currentAttempts + 1;
          reconnectAttemptsRef.current = attempts;
          setState(prev => ({ ...prev, reconnectAttempts: attempts }));

          console.log(`[SSE] Reconnecting in ${currentOptions.reconnectInterval}ms... (attempt ${attempts})`);

          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, currentOptions.reconnectInterval);
        } else if (currentAttempts >= currentOptions.maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached',
          }));
        }
      }
    };

    // 监听所有频道事件
    optionsRef.current.channels.forEach(channel => {
      addListener(channel, (event) => {
        try {
          const data = safeJsonParse((event as MessageEvent).data);
          handleEvent(channel, data);
        } catch (error) {
          console.error(`[SSE] Error parsing ${channel} event:`, error);
        }
      });
    });

  }, [buildUrl, cleanupEventSource, handleEvent]);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (eventSourceRef.current) {
      cleanupEventSource(eventSourceRef.current);
      eventSourceRef.current = null;
    }

    if (!mountedRef.current) return;

    setState({
      connected: false,
      connectionId: null,
      error: null,
      reconnectAttempts: 0,
      lastEventTime: null,
    });
  }, [cleanupEventSource]);

  /**
   * 重新连接
   */
  const reconnect = useCallback(() => {
    setState(prev => ({ ...prev, reconnectAttempts: 0 }));
    disconnect();
    connect();
  }, [disconnect, connect]);

  /**
   * 订阅事件
   */
  const subscribe = useCallback((event: string, callback: (data: unknown) => void) => {
    const callbacks = subscriptionsRef.current.get(event) || new Set();
    callbacks.add(callback);
    subscriptionsRef.current.set(event, callbacks);

    // 返回取消订阅函数
    return () => {
      const eventCallbacks = subscriptionsRef.current.get(event);
      if (eventCallbacks) {
        eventCallbacks.delete(callback);
        if (eventCallbacks.size === 0) {
          subscriptionsRef.current.delete(event);
        }
      }
    };
  }, []);

  /**
   * 发送事件到服务器 (需要服务器支持)
   */
  const sendEvent = useCallback(async (channel: string, event: string, data: unknown) => {
    const { userId: currentUserId, clientId: currentClientId } = optionsRef.current;
    try {
      await fetch('/api/sse/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          clientId: currentClientId,
          event: channel,
            data: {
              type: event,
              ...(typeof data === 'object' && data !== null ? data : { value: data }),
            },
        }),
      });
    } catch (error) {
      console.error('[SSE] Failed to send event:', error);
    }
  }, []);

  // 初始化连接
  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
      subscriptionsRef.current.clear();
    };
  }, [connect, disconnect, immediate]);

  return {
    state,
    sendEvent,
    disconnect,
    reconnect,
    subscribe,
    events,
  };
}

/**
 * 通知 Hook
 * 用于订阅系统通知
 */
export function useNotifications(options: Pick<SSEOptions, 'url' | 'userId' | 'clientId' | 'autoReconnect'>) {
  const { subscribe, state } = useSSE({
    ...options,
    channels: ['notification'],
    immediate: true,
  });

  const [notifications, setNotifications] = useState<unknown[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe('notification', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 50));
    });

    return unsubscribe;
  }, [subscribe]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    clearNotifications,
    connected: state.connected,
  };
}

/**
 * 进度 Hook
 * 用于订阅任务进度更新
 */
export function useProgress(options: Pick<SSEOptions, 'url' | 'clientId' | 'autoReconnect'>) {
  const { subscribe, state } = useSSE({
    ...options,
    channels: ['progress'],
    immediate: true,
  });

  const [progress, setProgress] = useState<Map<string, ProgressEntry>>(new Map());

  useEffect(() => {
    const unsubscribe = subscribe('progress', (data: any) => {
      const taskId = String(data?.taskId || '').trim();
      if (!taskId) return;
      const updatedAt = Date.now();
      const terminal = isTerminalProgressEvent(data);
      setProgress(prev => {
        const newProgress = new Map(prev);
        newProgress.set(taskId, {
          data,
          updatedAt,
          expiresAt: updatedAt + (terminal ? TERMINAL_PROGRESS_TTL_MS : PROGRESS_TTL_MS),
        });
        return pruneProgressEntries(newProgress, updatedAt);
      });
    });

    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress(prev => pruneProgressEntries(prev));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const getProgress = useCallback((taskId: string) => {
    return progress.get(taskId)?.data;
  }, [progress]);

  const clearProgress = useCallback((taskId?: string) => {
    if (taskId) {
      setProgress(prev => {
        const newProgress = new Map(prev);
        newProgress.delete(taskId);
        return newProgress;
      });
    } else {
      setProgress(new Map());
    }
  }, []);

  return {
    progress,
    getProgress,
    clearProgress,
    connected: state.connected,
  };
}

/**
 * 客服消息 Hook
 * 用于订阅客服消息
 */
export function useChatMessages(options: Pick<SSEOptions, 'url' | 'userId' | 'autoReconnect'>) {
  const { subscribe, state } = useSSE({
    ...options,
    channels: ['chat'],
    immediate: true,
  });

  const [messages, setMessages] = useState<unknown[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe('chat', (data: any) => {
      if (data.done) {
        // 消息流结束
        return;
      }
      setMessages(prev => [...prev, data].slice(-MAX_CHAT_MESSAGES));
    });

    return unsubscribe;
  }, [subscribe]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    clearMessages,
    connected: state.connected,
  };
}
