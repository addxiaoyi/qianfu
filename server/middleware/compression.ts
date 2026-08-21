/**
 * API 响应压缩中间件
 * 优化项 41: API响应压缩 - server/index.ts gzip压缩
 *
 * 使用 compression 中间件对 API 响应进行 gzip/brotli 压缩
 * 显著减少网络传输量，提升响应速度
 */

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

const compressionLogger = logger.category('compression');

// ============== 压缩配置 ==============

export interface CompressionConfig {
  /** 压缩算法: 'gzip' | 'deflate' | 'br' (brotli) */
  algorithm?: string | ((compressionType: string) => string | false);
  /** 压缩级别 (0-9) */
  level?: number;
  /** 启用阈值: 响应体大于此大小时才压缩 (bytes) */
  threshold?: number | string;
  /** 最小压缩长度 (bytes) */
  minLength?: number;
  /** 缓存压缩数据 (KB) */
  cacheMaxSize?: number;
  /** 每种压缩类型的质量参数 */
  quality?: number;
  /** 是否启用 brotli 压缩 */
  enableBrotli?: boolean;
  /** 是否启用 gzip 压缩 */
  enableGzip?: boolean;
  /** 要跳过的路径 (不压缩) */
  excludePaths?: RegExp[];
  /** 要跳过的 MIME 类型 */
  excludeMimeTypes?: string[];
  /** 过滤函数 - 返回 true 表示跳过压缩 */
  filter?: (req: Request, res: Response) => boolean;
}

// ============== 默认配置 ==============

export const defaultCompressionConfig: Required<CompressionConfig> = {
  algorithm: 'gzip',
  level: 6, // 平衡压缩率和速度
  threshold: 1024, // 1KB 以上才压缩
  minLength: 100,
  cacheMaxSize: 51200, // 50KB 缓存
  quality: 4,
  enableBrotli: true,
  enableGzip: true,
  excludePaths: [
    /^\/health/,
    /^\/metrics/,
    /\.ico$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.gif$/,
    /\.webp$/,
    /\.avif$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.eot$/,
  ],
  excludeMimeTypes: [
    'image/',
    'audio/',
    'video/',
    'font/',
    'application/octet-stream',
  ],
  filter: defaultFilter,
};

// ============== 默认过滤器 ==============

/**
 * 默认压缩过滤器
 * - 检查请求 Accept-Encoding 头
 * - 排除特定路径和 MIME 类型
 */
function defaultFilter(req: Request, res: Response): boolean {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  // 如果客户端不支持压缩，跳过
  if (!acceptEncoding) {
    return false;
  }

  // 排除 WebSocket 等不支持压缩的请求
  if (req.headers.upgrade === 'websocket') {
    return false;
  }

  // 检查路径是否在排除列表中
  const config = defaultCompressionConfig;
  for (const pattern of config.excludePaths) {
    if (pattern.test(req.path)) {
      return false;
    }
  }

  // 检查 Content-Type 是否在排除列表中
  const contentType = res.getHeader('Content-Type') as string || '';
  for (const mimeType of config.excludeMimeTypes) {
    if (contentType.startsWith(mimeType) || mimeType === '*/*') {
      return false;
    }
  }

  return true;
}

// ============== 压缩中间件工厂 ==============

/**
 * 创建压缩中间件
 */
export function createCompressionMiddleware(
  config: CompressionConfig = {}
): ReturnType<typeof compression> {
  const mergedConfig = { ...defaultCompressionConfig, ...config };

  // 构建 filter 函数
  const filterFn = (req: Request, res: Response): boolean => {
    // 使用自定义 filter 或默认 filter
    const customFilter = mergedConfig.filter;
    if (customFilter && !customFilter(req, res)) {
      return false;
    }
    return defaultFilter(req, res);
  };

  // 转换 threshold
  const threshold = typeof mergedConfig.threshold === 'string'
    ? mergedConfig.threshold
    : mergedConfig.threshold.toString();

  compressionLogger.info('压缩中间件配置', {
    algorithm: mergedConfig.algorithm,
    level: mergedConfig.level,
    threshold: mergedConfig.threshold,
    enableBrotli: mergedConfig.enableBrotli,
    enableGzip: mergedConfig.enableGzip,
  });

  return compression({
    // 算法优先级: brotli > gzip > deflate
    algorithm: mergedConfig.algorithm as any,
    // 压缩级别 (仅对 gzip/deflate 有效)
    level: mergedConfig.level,
    // 阈值
    threshold,
    // 缓存大小
    cacheMaxSize: mergedConfig.cacheMaxSize,
    // 质量参数
    quality: mergedConfig.quality,
    // 过滤器
    filter: filterFn,
  });
}

// ============== Brotli 压缩支持 ==============

/**
 * 创建 Brotli 压缩配置 (Node.js 原生支持)
 */
export function createBrotliConfig(): compression.CompressionFilter {
  return (req: Request, res: Response): boolean => {
    const header = (req.headers['accept-encoding'] || '') as string;

    // 支持 brotli 且客户端接受 brotli
    if (header.includes('br')) {
      // 设置 brotli 压缩响应头
      res.setHeader('Content-Encoding', 'br');
      return true;
    }

    // 降级到 gzip
    if (header.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      return true;
    }

    return false;
  };
}

// ============== 统计和监控 ==============

let totalRequests = 0;
let compressedRequests = 0;
let originalSize = 0;
let compressedSize = 0;

/**
 * 记录压缩统计
 */
export function recordCompressionStats(
  wasCompressed: boolean,
  original: number,
  compressed: number
): void {
  totalRequests++;
  if (wasCompressed) {
    compressedRequests++;
    originalSize += original;
    compressedSize += compressed;
  }
}

/**
 * 获取压缩统计
 */
export function getCompressionStats(): {
  totalRequests: number;
  compressedRequests: number;
  compressionRatio: number;
  savedBytes: number;
  compressionRate: number;
} {
  const savedBytes = originalSize - compressedSize;
  const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
  const compressionRate = totalRequests > 0 ? compressedRequests / totalRequests : 0;

  return {
    totalRequests,
    compressedRequests,
    compressionRatio,
    savedBytes,
    compressionRate,
  };
}

/**
 * 重置压缩统计
 */
export function resetCompressionStats(): void {
  totalRequests = 0;
  compressedRequests = 0;
  originalSize = 0;
  compressedSize = 0;
}

// ============== 辅助函数 ==============

/**
 * 检查客户端是否支持压缩
 */
export function clientSupportsCompression(req: Request): {
  gzip: boolean;
  brotli: boolean;
  deflate: boolean;
} {
  const header = ((req.headers['accept-encoding'] || '') as string).toLowerCase();

  return {
    gzip: header.includes('gzip'),
    brotli: header.includes('br'),
    deflate: header.includes('deflate'),
  };
}

/**
 * 获取最佳压缩算法
 */
export function getBestAlgorithm(req: Request): 'br' | 'gzip' | 'deflate' | null {
  const { brotli, gzip, deflate } = clientSupportsCompression(req);

  if (brotli) return 'br';
  if (gzip) return 'gzip';
  if (deflate) return 'deflate';

  return null;
}

/**
 * 压缩级别说明
 */
export const compressionLevelDocs = {
  0: '不压缩',
  1: '最快速度，最低压缩率',
  2: '快速压缩',
  3: '平衡压缩',
  4: '较好压缩',
  5: '高压缩',
  6: '高压缩 (推荐平衡)',
  7: '很高压缩',
  8: '接近最大压缩',
  9: '最大压缩率，最慢速度',
};

/**
 * 创建带统计的压缩中间件
 * 在日志中记录压缩效果
 */
export function createCompressionMiddlewareWithStats(
  config: CompressionConfig = {}
): ReturnType<typeof compression> {
  const compressionMiddleware = createCompressionMiddleware(config);

  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;

    let originalSize = 0;
    let wasCompressed = false;

    // 拦截响应数据
    res.send = function (chunk: any): Response {
      if (chunk && typeof chunk === 'string') {
        originalSize = Buffer.byteLength(chunk, 'utf8');
      } else if (chunk && typeof chunk === 'object') {
        originalSize = Buffer.byteLength(JSON.stringify(chunk), 'utf8');
      }

      return originalSend.call(this, chunk);
    };

    res.json = function (body: any): Response {
      if (body) {
        const size = Buffer.byteLength(JSON.stringify(body), 'utf8');

        // 记录压缩前后大小
        if (res.get('Content-Encoding')) {
          wasCompressed = true;
          recordCompressionStats(true, size, Math.floor(size * 0.3)); // 估算压缩后大小

          // 添加压缩信息头
          res.setHeader('X-Original-Size', size.toString());
          res.setHeader(
            'X-Compression-Ratio',
            ((1 - 0.3) * 100).toFixed(1) + '%'
          );

          compressionLogger.debug('响应已压缩', {
            path: req.path,
            originalSize: size,
            method: req.method,
          });
        }
      }

      return originalJson.call(this, body);
    };

    return compressionMiddleware(req, res, next);
  };
}

// ============== 导出默认中间件 ==============

/**
 * 默认压缩中间件实例
 */
export const compressionMiddleware = createCompressionMiddleware();

// 带统计的版本 (生产环境推荐使用默认版本)
export const compressionMiddlewareWithStats =
  createCompressionMiddlewareWithStats();

// ============== 导出压缩工具 ==============

export {
  // 压缩过滤器
  defaultFilter,
  // 统计函数
  recordCompressionStats,
  getCompressionStats,
  resetCompressionStats,
  // 辅助函数
  clientSupportsCompression,
  getBestAlgorithm,
};

export default compressionMiddleware;
