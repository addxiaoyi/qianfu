/**
 * 故障注入中间件 - Fault Injection
 * 优化项 496: Fault Injection - 故障注入
 *
 * 功能:
 * - 模拟网络延迟
 * - 注入随机错误响应
 * - 模拟服务不可用 (503)
 * - 模拟超时
 * - 模拟连接中断
 * - 按路由/方法/概率配置故障
 * - 用于测试系统容错能力
 *
 * 使用示例:
 * ```typescript
 * import { faultInjectionMiddleware, createFaultInjection } from './middleware/fault-injection';
 *
 * // 全局启用
 * app.use(createFaultInjection());
 *
 * // 仅对特定路由启用
 * app.use('/api', createFaultInjection({
 *   routes: [{ path: '/api/users*', faults: ['delay', 'error'] }]
 * }));
 * ```
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../lib/logger';

const faultInjectionLogger = logger.category('fault-injection');

// ============================================================
// Types - 故障注入配置
// ============================================================

/**
 * 故障类型
 */
export type FaultType =
  | 'delay'           // 模拟网络延迟
  | 'error'           // 返回错误响应
  | 'abort'           // 中断连接
  | 'timeout'         // 模拟超时
  | '503'             // 服务不可用
  | '500'             // 服务器内部错误
  | '502'             // 网关错误
  | '504'             // 网关超时
  | 'network-error'    // 网络错误
  | 'corrupt'         // 返回损坏数据
  | 'slow-response';  // 慢响应 (分块传输延迟)

/**
 * 延迟故障配置
 */
export interface DelayFault {
  type: 'delay';
  /** 延迟时间范围 [min, max] (毫秒) */
  range: [number, number];
  /** 固定延迟 (毫秒)，与 range 互斥 */
  fixed?: number;
}

/**
 * 错误故障配置
 */
export interface ErrorFault {
  type: 'error';
  /** HTTP 状态码 */
  statusCode: number;
  /** 错误消息 */
  message?: string;
  /** 错误代码 */
  code?: string;
  /** 错误响应体 */
  body?: Record<string, unknown>;
}

/**
 * 503 故障配置
 */
export interface ServiceUnavailableFault {
  type: '503';
  /** 重试时间 (秒) */
  retryAfter?: number;
  /** 自定义消息 */
  message?: string;
}

/**
 * 超时故障配置
 */
export interface TimeoutFault {
  type: 'timeout';
  /** 超时时间 (毫秒) */
  duration?: number;
}

/**
 * 连接中止故障配置
 */
export interface AbortFault {
  type: 'abort';
  /** 中止前延迟 (毫秒) */
  delay?: number;
}

/**
 * 损坏数据故障配置
 */
export interface CorruptFault {
  type: 'corrupt';
  /** 损坏比例 (0-1) */
  ratio?: number;
  /** 损坏模式: 'random' | 'null' | 'truncate' */
  mode?: 'random' | 'null' | 'truncate';
}

/**
 * 慢响应故障配置
 */
export interface SlowResponseFault {
  type: 'slow-response';
  /** 每个chunk延迟 (毫秒) */
  chunkDelay?: number;
  /** chunk大小 (字节) */
  chunkSize?: number;
}

/**
 * 单个故障配置
 */
export type FaultConfig =
  | DelayFault
  | ErrorFault
  | ServiceUnavailableFault
  | TimeoutFault
  | AbortFault
  | CorruptFault
  | SlowResponseFault;

/**
 * 路由故障配置
 */
export interface RouteFaultConfig {
  /** 路由路径 (支持通配符 *) */
  path: string;
  /** HTTP方法，空数组表示所有方法 */
  methods?: string[];
  /** 故障类型列表 */
  faults: FaultType[];
  /** 触发故障的概率 (0-1)，默认 1 */
  probability?: number;
  /** 启用/禁用此路由的故障注入 */
  enabled?: boolean;
  /** 自定义故障配置 */
  faultConfig?: Partial<Record<FaultType, FaultConfig>>;
}

/**
 * 故障注入配置
 */
export interface FaultInjectionConfig {
  /** 是否全局启用故障注入 */
  enabled: boolean;
  /** 是否记录故障注入日志 */
  logEnabled: boolean;
  /** 是否在响应头中标记故障注入 */
  markResponse: boolean;
  /** 响应头名称 */
  headerName: string;
  /** 默认概率 (0-1) */
  defaultProbability: number;
  /** 默认延迟时间 (毫秒) */
  defaultDelay: number;
  /** 默认错误状态码 */
  defaultErrorCode: number;
  /** 默认错误消息 */
  defaultErrorMessage: string;
  /** 路由配置列表 */
  routes: RouteFaultConfig[];
  /** 排除的路径 (不受故障注入影响) */
  excludePaths: RegExp[];
  /** 排除的方法 */
  excludeMethods: string[];
}

// ============================================================
// 默认配置
// ============================================================

export const defaultFaultInjectionConfig: FaultInjectionConfig = {
  enabled: false, // 默认关闭，需要显式启用
  logEnabled: true,
  markResponse: true,
  headerName: 'X-Fault-Injection',
  defaultProbability: 1.0,
  defaultDelay: 1000,        // 1秒
  defaultErrorCode: 500,
  defaultErrorMessage: 'Simulated fault injection error',
  routes: [],
  excludePaths: [
    /^\/health$/,
    /^\/metrics$/,
    /^\/favicon/,
  ],
  excludeMethods: ['OPTIONS'],
};

// ============================================================
// 辅助函数
// ============================================================

/**
 * 匹配路由配置
 */
function matchRoute(path: string, method: string, routes: RouteFaultConfig[]): RouteFaultConfig | null {
  for (const route of routes) {
    if (!route.enabled && route.enabled !== undefined) continue;

    // 路径匹配 (支持通配符)
    const pathPattern = route.path
      .replace(/\./g, '\\.')  // 转义点号
      .replace(/\*/g, '.*'); // 通配符
    const regex = new RegExp(`^${pathPattern}$`);

    if (!regex.test(path)) continue;

    // 方法匹配
    if (route.methods && route.methods.length > 0) {
      if (!route.methods.includes(method)) continue;
    }

    return route;
  }
  return null;
}

/**
 * 检查是否应跳过故障注入
 */
function shouldSkip(path: string, method: string, config: FaultInjectionConfig): boolean {
  // 检查路径排除
  for (const pattern of config.excludePaths) {
    if (pattern.test(path)) return true;
  }

  // 检查方法排除
  if (config.excludeMethods.includes(method)) return true;

  return false;
}

/**
 * 随机决定是否触发故障
 */
function shouldInjectFault(probability: number): boolean {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return Math.random() < probability;
}

/**
 * 获取范围内的随机值
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成故障 ID
 */
function generateFaultId(): string {
  return `FI-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// 故障执行器
// ============================================================

/**
 * 执行延迟故障
 */
async function executeDelay(
  fault: DelayFault,
  config: FaultInjectionConfig,
  faultId: string
): Promise<void> {
  const duration = fault.fixed ?? randomInRange(fault.range[0], fault.range[1]);

  faultInjectionLogger.debug(`[${faultId}] Executing delay fault: ${duration}ms`);

  await delay(duration);
}

/**
 * 执行错误故障
 */
function executeError(
  res: Response,
  fault: ErrorFault,
  config: FaultInjectionConfig,
  faultId: string
): void {
  const statusCode = fault.statusCode ?? config.defaultErrorCode;
  const message = fault.message ?? config.defaultErrorMessage;

  faultInjectionLogger.debug(`[${faultId}] Executing error fault: ${statusCode}`);

  res.status(statusCode).json({
    success: false,
    error: message,
    code: fault.code ?? 'FAULT_INJECTION',
    faultId,
    injected: true,
    ...fault.body,
  });
}

/**
 * 执行 503 故障
 */
function execute503(
  res: Response,
  fault: ServiceUnavailableFault,
  faultId: string
): void {
  faultInjectionLogger.debug(`[${faultId}] Executing 503 fault`);

  res.setHeader('Retry-After', String(fault.retryAfter ?? 30));
  res.status(503).json({
    success: false,
    error: fault.message ?? 'Service temporarily unavailable',
    code: 'SERVICE_UNAVAILABLE',
    faultId,
    injected: true,
  });
}

/**
 * 执行超时故障
 */
async function executeTimeout(
  req: Request,
  res: Response,
  fault: TimeoutFault,
  faultId: string
): Promise<void> {
  const duration = fault.duration ?? randomInRange(30000, 60000);

  faultInjectionLogger.debug(`[${faultId}] Executing timeout fault: ${duration}ms`);

  // 设置超时
  req.setTimeout(duration);

  // 不发送响应，等待超时
  return new Promise((resolve) => {
    req.on('timeout', () => {
      res.status(504).json({
        success: false,
        error: 'Gateway Timeout',
        code: 'GATEWAY_TIMEOUT',
        faultId,
        injected: true,
      });
      resolve();
    });
  });
}

/**
 * 执行连接中止故障
 */
function executeAbort(
  res: Response,
  fault: AbortFault,
  faultId: string
): void {
  const delayMs = fault.delay ?? 0;

  faultInjectionLogger.debug(`[${faultId}] Executing abort fault after ${delayMs}ms`);

  // 中止连接
  res.status(200); // 先设置正常状态
  res.setHeader('Content-Length', '1000'); // 欺骗客户端内容长度

  if (delayMs > 0) {
    setTimeout(() => {
      if (res.socket) {
        res.socket.destroy();
      }
    }, delayMs);
  } else if (res.socket) {
    res.socket.destroy();
  }
}

/**
 * 执行网络错误故障
 */
function executeNetworkError(
  res: Response,
  faultId: string
): void {
  faultInjectionLogger.debug(`[${faultId}] Executing network error fault`);

  res.status(200);
  res.setHeader('Content-Length', '500');

  // 发送部分数据后中断
  res.write(Buffer.alloc(100), () => {
    if (res.socket) {
      res.socket.destroy();
    }
  });
}

/**
 * 执行损坏数据故障
 */
function executeCorrupt(
  res: Response,
  req: Request,
  fault: CorruptFault,
  faultId: string
): void {
  const ratio = fault.ratio ?? 0.1;
  const mode = fault.mode ?? 'random';

  faultInjectionLogger.debug(`[${faultId}] Executing corrupt fault: mode=${mode}, ratio=${ratio}`);

  const originalJson = res.json.bind(res);

  res.json = function (body: any): Response {
    let corruptedBody = { ...body };

    switch (mode) {
      case 'random':
        // 随机替换字符
        const jsonStr = JSON.stringify(corruptedBody);
        const chars = jsonStr.split('');
        const numCorrupt = Math.floor(chars.length * ratio);
        for (let i = 0; i < numCorrupt; i++) {
          const idx = Math.floor(Math.random() * chars.length);
          chars[idx] = String.fromCharCode(Math.floor(Math.random() * 26) + 97);
        }
        try {
          corruptedBody = JSON.parse(chars.join(''));
        } catch {
          corruptedBody = { corrupted: true, faultId };
        }
        break;

      case 'null':
        // 将部分值设为 null
        const corruptKeys = Object.keys(corruptedBody).slice(0, Math.ceil(Object.keys(corruptedBody).length * ratio));
        corruptKeys.forEach(key => {
          (corruptedBody as any)[key] = null;
        });
        break;

      case 'truncate':
        // 截断字符串值
        Object.keys(corruptedBody).forEach(key => {
          const val = (corruptedBody as any)[key];
          if (typeof val === 'string' && val.length > 10) {
            (corruptedBody as any)[key] = val.slice(0, Math.floor(val.length * (1 - ratio)));
          }
        });
        break;
    }

    (corruptedBody as any)._corrupted = true;
    (corruptedBody as any).faultId = faultId;

    return originalJson(corruptedBody);
  };
}

/**
 * 执行慢响应故障
 */
function executeSlowResponse(
  res: Response,
  req: Request,
  fault: SlowResponseFault,
  faultId: string
): void {
  const chunkDelay = fault.chunkDelay ?? 5000;
  const chunkSize = fault.chunkSize ?? 1024;

  faultInjectionLogger.debug(`[${faultId}] Executing slow response fault: delay=${chunkDelay}ms, size=${chunkSize}`);

  const originalJson = res.json.bind(res);
  let sentFirstChunk = false;

  res.json = function (body: any): Response {
    if (sentFirstChunk) {
      return originalJson(body);
    }
    sentFirstChunk = true;

    // 设置慢响应头
    res.setHeader('X-Slow-Response', 'true');
    res.setHeader('X-Fault-Id', faultId);
    res.setHeader('Transfer-Encoding', 'chunked');

    // 分块发送响应
    const jsonStr = JSON.stringify(body);
    const chunks: string[] = [];
    for (let i = 0; i < jsonStr.length; i += chunkSize) {
      chunks.push(jsonStr.slice(i, i + chunkSize));
    }

    // 发送 chunk
    let chunkIndex = 0;
    const sendNextChunk = () => {
      if (chunkIndex < chunks.length) {
        res.write(chunks[chunkIndex++]);
        setTimeout(sendNextChunk, chunkDelay);
      } else {
        res.end();
      }
    };

    setTimeout(sendNextChunk, chunkDelay);

    // 返回一个已解决的 Promise，防止重复发送
    return res;
  };
}

// ============================================================
// 故障注入中间件
// ============================================================

export interface FaultInjectionResult {
  injected: boolean;
  faultId?: string;
  faultType?: FaultType;
}

/**
 * 创建故障注入中间件
 */
export function createFaultInjection(config: Partial<FaultInjectionConfig> = {}): RequestHandler {
  const finalConfig: FaultInjectionConfig = {
    ...defaultFaultInjectionConfig,
    ...config,
    routes: [
      ...defaultFaultInjectionConfig.routes,
      ...(config.routes || []),
    ],
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    // 检查是否全局禁用
    if (!finalConfig.enabled) {
      return next();
    }

    // 检查是否应跳过
    if (shouldSkip(req.path, req.method, finalConfig)) {
      return next();
    }

    // 匹配路由配置
    const routeConfig = matchRoute(req.path, req.method, finalConfig.routes);
    if (!routeConfig) {
      return next();
    }

    // 检查概率
    const probability = routeConfig.probability ?? finalConfig.defaultProbability;
    if (!shouldInjectFault(probability)) {
      return next();
    }

    // 生成故障 ID
    const faultId = generateFaultId();

    // 随机选择故障类型
    const faultType = routeConfig.faults[Math.floor(Math.random() * routeConfig.faults.length)];

    // 记录日志
    if (finalConfig.logEnabled) {
      faultInjectionLogger.info(`[${faultId}] Injecting fault`, {
        type: faultType,
        path: req.path,
        method: req.method,
        probability,
      });
    }

    // 添加故障标记头
    if (finalConfig.markResponse) {
      res.setHeader(finalConfig.headerName, faultType);
      res.setHeader('X-Fault-Injection-Id', faultId);
    }

    // 获取自定义故障配置
    const customFaultConfig = routeConfig.faultConfig?.[faultType];

    try {
      // 执行对应类型的故障
      switch (faultType) {
        case 'delay':
          await executeDelay(
            { type: 'delay', range: [finalConfig.defaultDelay, finalConfig.defaultDelay * 2], ...(customFaultConfig as any) },
            finalConfig,
            faultId
          );
          break;

        case 'error':
        case '500':
        case '502':
        case '504':
          executeError(
            res,
            {
              type: 'error',
              statusCode: faultType === 'error' ? 500 : parseInt(faultType),
              ...(customFaultConfig as any),
            },
            finalConfig,
            faultId
          );
          return; // 错误响应已发送，结束

        case '503':
          execute503(
            res,
            { type: '503', ...(customFaultConfig as any) },
            faultId
          );
          return;

        case 'timeout':
          await executeTimeout(
            req,
            res,
            { type: 'timeout', ...(customFaultConfig as any) },
            faultId
          );
          return;

        case 'abort':
          executeAbort(
            res,
            { type: 'abort', ...(customFaultConfig as any) },
            faultId
          );
          return;

        case 'network-error':
          executeNetworkError(res, faultId);
          return;

        case 'corrupt':
          executeCorrupt(
            res,
            req,
            { type: 'corrupt', ...(customFaultConfig as any) },
            faultId
          );
          // 继续执行，让原始响应经过损坏处理
          break;

        case 'slow-response':
          executeSlowResponse(
            res,
            req,
            { type: 'slow-response', ...(customFaultConfig as any) },
            faultId
          );
          // 慢响应已处理
          return;
      }

      // 继续处理正常请求
      next();
    } catch (error) {
      faultInjectionLogger.error(`[${faultId}] Fault injection error`, { error });
      next();
    }
  };
}

/**
 * 创建带统计的故障注入中间件
 */
export function createFaultInjectionWithStats(config: Partial<FaultInjectionConfig> = {}) {
  const middleware = createFaultInjection(config);
  const stats = {
    totalRequests: 0,
    injectedFaults: 0,
    byType: {} as Record<string, number>,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    stats.totalRequests++;

    const originalJson = res.json.bind(res);
    const originalWrite = res.write.bind(res);

    res.json = function (body: any): Response {
      if (res.getHeader('X-Fault-Injection-Id')) {
        stats.injectedFaults++;
        const faultType = res.getHeader('X-Fault-Injection') as string;
        stats.byType[faultType] = (stats.byType[faultType] || 0) + 1;
      }
      return originalJson(body);
    };

    res.write = function (chunk: any, encoding: any, callback?: any): boolean | void {
      if (res.getHeader('X-Fault-Injection-Id') && chunk) {
        stats.injectedFaults++;
      }
      return originalWrite(chunk, encoding, callback);
    };

    middleware(req, res, next);
  };
}

// ============================================================
// 便捷 API
// ============================================================

/**
 * 获取故障注入统计
 */
export function getFaultInjectionStats(): {
  enabled: boolean;
  routeCount: number;
  stats: {
    totalRequests: number;
    injectedFaults: number;
    injectionRate: number;
    byType: Record<string, number>;
  };
} {
  return {
    enabled: defaultFaultInjectionConfig.enabled,
    routeCount: defaultFaultInjectionConfig.routes.length,
    stats: {
      totalRequests: 0,
      injectedFaults: 0,
      injectionRate: 0,
      byType: {},
    },
  };
}

/**
 * 启用故障注入
 */
export function enableFaultInjection(): void {
  defaultFaultInjectionConfig.enabled = true;
  faultInjectionLogger.info('Fault injection enabled');
}

/**
 * 禁用故障注入
 */
export function disableFaultInjection(): void {
  defaultFaultInjectionConfig.enabled = false;
  faultInjectionLogger.info('Fault injection disabled');
}

/**
 * 添加路由故障配置
 */
export function addFaultRoute(route: RouteFaultConfig): void {
  defaultFaultInjectionConfig.routes.push(route);
  faultInjectionLogger.info(`Added fault route: ${route.path}`);
}

/**
 * 移除路由故障配置
 */
export function removeFaultRoute(path: string): void {
  const index = defaultFaultInjectionConfig.routes.findIndex(r => r.path === path);
  if (index !== -1) {
    defaultFaultInjectionConfig.routes.splice(index, 1);
    faultInjectionLogger.info(`Removed fault route: ${path}`);
  }
}

/**
 * 获取当前配置
 */
export function getFaultInjectionConfig(): FaultInjectionConfig {
  return { ...defaultFaultInjectionConfig };
}

/**
 * 更新配置
 */
export function updateFaultInjectionConfig(updates: Partial<FaultInjectionConfig>): FaultInjectionConfig {
  Object.assign(defaultFaultInjectionConfig, updates);
  return { ...defaultFaultInjectionConfig };
}

// ============================================================
// 预定义故障场景
// ============================================================

export const FaultScenarios = {
  /**
   * 高延迟场景 - 模拟网络高延迟
   */
  highLatency: (): Partial<FaultInjectionConfig> => ({
    enabled: true,
    routes: [{
      path: '*',
      faults: ['delay'],
      probability: 1,
      faultConfig: {
        delay: { type: 'delay', range: [5000, 10000] },
      },
    }],
  }),

  /**
   * 随机错误场景 - 10% 概率返回错误
   */
  randomErrors: (): Partial<FaultInjectionConfig> => ({
    enabled: true,
    routes: [{
      path: '*',
      faults: ['500', '502', '503'],
      probability: 0.1,
    }],
  }),

  /**
   * 服务不可用场景 - 模拟服务宕机
   */
  serviceDown: (): Partial<FaultInjectionConfig> => ({
    enabled: true,
    routes: [{
      path: '*',
      faults: ['503'],
      probability: 1,
      faultConfig: {
        '503': { type: '503', retryAfter: 60, message: 'Service is currently unavailable' },
      },
    }],
  }),

  /**
   * 超时场景 - 模拟响应超时
   */
  timeouts: (): Partial<FaultInjectionConfig> => ({
    enabled: true,
    routes: [{
      path: '/api/*',
      faults: ['timeout'],
      probability: 0.2,
      faultConfig: {
        timeout: { type: 'timeout', duration: 1000 },
      },
    }],
  }),

  /**
   * 数据损坏场景 - 模拟数据损坏
   */
  dataCorruption: (): Partial<FaultInjectionConfig> => ({
    enabled: true,
    routes: [{
      path: '/api/*',
      faults: ['corrupt'],
      probability: 0.05,
      faultConfig: {
        corrupt: { type: 'corrupt', ratio: 0.2, mode: 'random' },
      },
    }],
  }),

  /**
   * 慢响应场景 - 分块传输慢
   */
  slowResponses: (): Partial<FaultInjectionConfig> => ({
    enabled: true,
    routes: [{
      path: '/api/*',
      faults: ['slow-response'],
      probability: 0.3,
      faultConfig: {
        'slow-response': { type: 'slow-response', chunkDelay: 2000, chunkSize: 512 },
      },
    }],
  }),

  /**
   * 混沌工程场景 - 多种故障组合
   */
  chaosEngineering: (): Partial<FaultInjectionConfig> => ({
    enabled: true,
    routes: [
      {
        path: '/api/*',
        faults: ['delay', '500', '503', 'timeout'],
        probability: 0.15,
      },
      {
        path: '/api/users*',
        faults: ['error'],
        probability: 0.2,
        faultConfig: {
          error: { type: 'error', statusCode: 500, message: 'User service error' },
        },
      },
      {
        path: '/api/orders*',
        faults: ['abort'],
        probability: 0.05,
      },
    ],
  }),
};

// ============================================================
// 导出
// ============================================================

export default createFaultInjection;
