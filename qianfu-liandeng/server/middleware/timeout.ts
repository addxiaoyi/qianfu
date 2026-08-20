/**
 * 请求超时中间件 - 统一超时控制
 * 优化项 42: 请求超时统一
 *
 * 功能:
 * - 统一管理所有请求的超时时间
 * - 支持按路由/方法配置不同超时
 * - 超时后优雅关闭请求并返回错误
 * - 防止资源泄漏
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';

// ============================================================
// Types - 超时配置
// ============================================================

export interface TimeoutConfig {
  /** 默认超时时间(ms) */
  default: number;
  /** 各路由超时配置(ms) */
  routes: RouteTimeoutConfig[];
  /** 是否启用超时 */
  enabled: boolean;
  /** 超时响应状态码 */
  statusCode: number;
  /** 超时错误消息 */
  message: string;
  /** 超时错误码 */
  code: string;
  /** 是否在超时后终止请求 */
  killTimeout: boolean;
  /** 是否记录超时日志 */
  logTimeout: boolean;
  /** 响应头名称 - 发送超时时间 */
  headerTimeout: string;
  /** 响应头名称 - 发送剩余时间 */
  headerRemaining: string;
}

export interface RouteTimeoutConfig {
  /** 路由路径(支持通配符) */
  path: string;
  /** HTTP方法, 空数组表示所有方法 */
  methods?: string[];
  /** 超时时间(ms) */
  timeout: number;
  /** 是否覆盖默认配置 */
  override?: boolean;
}

// 路由超时配置的默认值
export const defaultTimeoutConfig: TimeoutConfig = {
  default: 30000, // 30秒
  routes: [
    // 健康检查快速响应
    { path: '/health', timeout: 5000 },
    { path: '/api/health', timeout: 5000 },
    { path: '/metrics', timeout: 5000 },

    // 登录相关快速失败
    { path: '/api/auth/login', timeout: 10000 },
    { path: '/api/auth/verify', timeout: 10000 },

    // 常规API请求
    { path: '/api/*', timeout: 30000 },

    // 文件上传/下载 - 需要更长超时
    { path: '/api/upload*', timeout: 120000 },
    { path: '/api/download*', timeout: 120000 },

    // 管理后台操作
    { path: '/api/admin/*', timeout: 60000 },

    // WebSocket 保持连接
    { path: '/ws', timeout: 0 }, // 0表示不超时
  ],
  enabled: true,
  statusCode: 504,
  message: '请求超时，请稍后重试',
  code: 'REQUEST_TIMEOUT',
  killTimeout: true,
  logTimeout: true,
  headerTimeout: 'X-Response-Timeout',
  headerRemaining: 'X-Response-Remaining',
};

// ============================================================
// TimeoutError - 超时错误类
// ============================================================

export class TimeoutError extends Error {
  status = 504;
  code: string;
  timeout: number;
  path: string;
  method: string;

  constructor(message: string, timeout: number, path: string, method: string) {
    super(message);
    this.name = 'TimeoutError';
    this.code = defaultTimeoutConfig.code;
    this.timeout = timeout;
    this.path = path;
    this.method = method;
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      timeout: this.timeout,
      path: this.path,
      method: this.method,
    };
  }
}

// ============================================================
// TimeoutStore - 超时状态管理
// ============================================================

class TimeoutStore {
  private activeRequests: Map<string, {
    startTime: number;
    timeout: number;
    timer?: NodeJS.Timeout;
    request: Request;
    response: Response;
  }> = new Map();

  private requestCounter = 0;

  /**
   * 注册请求，开始计时
   */
  register(request: Request, response: Response, timeout: number): string {
    const id = `${Date.now()}-${++this.requestCounter}`;
    const startTime = Date.now();

    this.activeRequests.set(id, {
      startTime,
      timeout,
      request,
      response,
    });

    return id;
  }

  /**
   * 设置超时定时器
   */
  setTimer(id: string, callback: () => void): void {
    const record = this.activeRequests.get(id);
    if (record && record.timeout > 0) {
      record.timer = setTimeout(() => {
        callback();
      }, record.timeout);
    }
  }

  /**
   * 获取请求剩余时间
   */
  getRemainingTime(id: string): number {
    const record = this.activeRequests.get(id);
    if (!record) return 0;

    const elapsed = Date.now() - record.startTime;
    return Math.max(0, record.timeout - elapsed);
  }

  /**
   * 取消请求
   */
  unregister(id: string): void {
    const record = this.activeRequests.get(id);
    if (record?.timer) {
      clearTimeout(record.timer);
    }
    this.activeRequests.delete(id);
  }

  /**
   * 获取活跃请求数
   */
  getActiveCount(): number {
    return this.activeRequests.size;
  }

  /**
   * 获取所有活跃请求详情
   */
  getActiveRequests(): Array<{
    id: string;
    path: string;
    method: string;
    elapsed: number;
    timeout: number;
  }> {
    const now = Date.now();
    return Array.from(this.activeRequests.entries()).map(([id, record]) => ({
      id,
      path: record.request.path,
      method: record.request.method,
      elapsed: now - record.startTime,
      timeout: record.timeout,
    }));
  }

  /**
   * 清理所有活跃请求
   */
  clear(): void {
    for (const record of this.activeRequests.values()) {
      if (record.timer) {
        clearTimeout(record.timer);
      }
    }
    this.activeRequests.clear();
  }
}

// 全局超时存储
const timeoutStore = new TimeoutStore();

// ============================================================
// 辅助函数
// ============================================================

/**
 * 匹配路由配置
 */
function matchRoute(path: string, method: string, routes: RouteTimeoutConfig[]): RouteTimeoutConfig | null {
  for (const route of routes) {
    // 路径匹配 (支持通配符)
    const pathPattern = route.path
      .replace(/\*/g, '.*')
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${pathPattern}$`);

    if (regex.test(path)) {
      // 检查方法匹配
      if (!route.methods || route.methods.length === 0 || route.methods.includes(method)) {
        return route;
      }
    }
  }
  return null;
}

/**
 * 获取请求的超时时间
 */
function getTimeout(path: string, method: string, config: TimeoutConfig): number {
  if (!config.enabled) return 0;

  const matchedRoute = matchRoute(path, method, config.routes);
  if (matchedRoute) {
    return matchedRoute.timeout;
  }

  return config.default;
}

/**
 * 检查路径是否应跳过超时处理
 */
function shouldSkip(path: string, methods: string[]): boolean {
  // 静态资源和WebSocket等特殊路径可能需要特殊处理
  const skipPaths = ['/favicon.ico', '/robots.txt'];
  return skipPaths.includes(path);
}

// ============================================================
// 主中间件
// ============================================================

export function createTimeoutMiddleware(config: Partial<TimeoutConfig> = {}): RequestHandler {
  const finalConfig: TimeoutConfig = {
    ...defaultTimeoutConfig,
    ...config,
    routes: [...defaultTimeoutConfig.routes, ...(config.routes || [])],
  };

  return (req: Request, res: Response, next: NextFunction) => {
    // 跳过特定路径
    if (shouldSkip(req.path, ['GET'])) {
      return next();
    }

    // 获取该请求的超时时间
    const timeout = getTimeout(req.path, req.method, finalConfig);

    // 0超时表示不设置超时
    if (timeout === 0) {
      // 设置超时响应头但不启用超时
      res.setHeader(finalConfig.headerTimeout, 'none');
      res.setHeader(finalConfig.headerRemaining, 'unlimited');
      return next();
    }

    // 注册请求
    const requestId = timeoutStore.register(req, res, timeout);

    // 设置超时响应头
    res.setHeader(finalConfig.headerTimeout, String(timeout));

    // 设置超时处理
    timeoutStore.setTimer(requestId, () => {
      // 检查响应是否已发送
      if (res.headersSent) {
        // 如果响应已开始发送，尝试终止连接
        if (finalConfig.killTimeout && res.socket) {
          res.socket.destroy();
        }
        timeoutStore.unregister(requestId);
        return;
      }

      // 记录超时日志
      if (finalConfig.logTimeout) {
        console.warn(
          `[TIMEOUT] Request timeout: ${req.method} ${req.path} ` +
          `(timeout: ${timeout}ms, requestId: ${requestId})`
        );
      }

      // 发送超时响应
      const timeoutError = new TimeoutError(
        finalConfig.message,
        timeout,
        req.path,
        req.method
      );

      res.status(finalConfig.statusCode).json(timeoutError.toJSON());
      timeoutStore.unregister(requestId);
    });

    // 监听响应完成以清理
    res.on('finish', () => {
      timeoutStore.unregister(requestId);
    });

    res.on('close', () => {
      timeoutStore.unregister(requestId);
    });

    // 定期更新剩余时间头
    const remainingInterval = setInterval(() => {
      if (res.headersSent) {
        clearInterval(remainingInterval);
        return;
      }
      const remaining = timeoutStore.getRemainingTime(requestId);
      res.setHeader(finalConfig.headerRemaining, String(remaining));
    }, 1000);

    res.on('finish', () => clearInterval(remainingInterval));
    res.on('close', () => clearInterval(remainingInterval));

    next();
  };
}

// 导出默认中间件实例
export const timeoutMiddleware = createTimeoutMiddleware();

// ============================================================
// 便捷函数
// ============================================================

/**
 * 为特定路由创建超时中间件
 */
export function createRouteTimeout(path: string, timeout: number, methods?: string[]): RequestHandler {
  return createTimeoutMiddleware({
    routes: [{ path, timeout, methods }],
  });
}

/**
 * 获取超时存储实例 (用于监控)
 */
export function getTimeoutStore(): TimeoutStore {
  return timeoutStore;
}

/**
 * 获取当前活跃请求数
 */
export function getActiveRequestCount(): number {
  return timeoutStore.getActiveCount();
}

/**
 * 获取所有活跃请求
 */
export function getActiveRequests(): ReturnType<TimeoutStore['getActiveRequests']> {
  return timeoutStore.getActiveRequests();
}

// ============================================================
// 与现有安全中心的集成
// ============================================================

/**
 * 获取超时配置 (用于安全中心)
 */
export function getTimeoutConfig(): TimeoutConfig {
  return { ...defaultTimeoutConfig };
}

/**
 * 更新超时配置
 */
export function updateTimeoutConfig(updates: Partial<TimeoutConfig>): TimeoutConfig {
  Object.assign(defaultTimeoutConfig, updates);
  return { ...defaultTimeoutConfig };
}

/**
 * 添加路由超时配置
 */
export function addRouteTimeout(route: RouteTimeoutConfig): void {
  defaultTimeoutConfig.routes.push(route);
}

/**
 * 移除路由超时配置
 */
export function removeRouteTimeout(path: string): void {
  const index = defaultTimeoutConfig.routes.findIndex(r => r.path === path);
  if (index !== -1) {
    defaultTimeoutConfig.routes.splice(index, 1);
  }
}

// ============================================================
// 预定义超时配置工厂
// ============================================================

export const TimeoutPresets = {
  /** 快速响应 - 5秒 */
  fast: (): Partial<TimeoutConfig> => ({
    default: 5000,
  }),

  /** 标准响应 - 30秒 */
  standard: (): Partial<TimeoutConfig> => ({
    default: 30000,
  }),

  /** 长时操作 - 2分钟 */
  longRunning: (): Partial<TimeoutConfig> => ({
    default: 120000,
  }),

  /** 严格模式 - 15秒 */
  strict: (): Partial<TimeoutConfig> => ({
    default: 15000,
  }),

  /** 开发模式 - 60秒 */
  development: (): Partial<TimeoutConfig> => ({
    default: 60000,
    logTimeout: false, // 开发环境减少日志
  }),
};
