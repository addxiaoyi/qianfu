/**
 * 通用类型定义
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================================
// HTTP 类型
// ============================================================================

/**
 * Express 请求处理器
 */
export type RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

/**
 * 异步请求处理器
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * 错误处理器
 */
export type ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void;

// ============================================================================
// 响应类型
// ============================================================================

/**
 * API 响应结构
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: ResponseMeta;
}

/**
 * 响应元数据
 */
export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 创建成功响应
 */
export function successResponse<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * 创建分页响应
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  meta?: Partial<ResponseMeta>
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      pagination,
      ...meta,
    },
  };
}

/**
 * 创建错误响应
 */
export function errorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// 数据库类型
// ============================================================================

/**
 * 软删除接口
 */
export interface SoftDeletable {
  deletedAt: Date | null;
}

/**
 * 时间戳接口
 */
export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 分页查询参数
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ============================================================================
// 服务间通信
// ============================================================================

/**
 * 服务健康状态
 */
export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  checks?: Array<{
    name: string;
    status: boolean;
    latency?: number;
  }>;
}

/**
 * 服务信息
 */
export interface ServiceInfo {
  name: string;
  version: string;
  environment: string;
  startedAt: string;
}

// ============================================================================
// 事件系统
// ============================================================================

/**
 * 领域事件
 */
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  payload: T;
  metadata: EventMetadata;
}

/**
 * 事件元数据
 */
export interface EventMetadata {
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  version: string;
}

// ============================================================================
// 配置类型
// ============================================================================

/**
 * 应用配置
 */
export interface AppConfig {
  env: string;
  port: number;
  serviceName: string;
  serviceVersion: string;
}

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  url: string;
  poolSize?: number;
  ssl?: boolean;
  logging?: boolean;
}

/**
 * Redis 配置
 */
export interface RedisConfig {
  url: string;
  password?: string;
  db?: number;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 部分类型，只读
 */
export type ReadonlyPartial<T> = Readonly<Partial<T>>;

/**
 * 必填部分类型
 */
export type RequiredPartially<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * 提取数组元素类型
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : T extends unknown[] ? T[number] : never;

/**
 * 深度只读
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
