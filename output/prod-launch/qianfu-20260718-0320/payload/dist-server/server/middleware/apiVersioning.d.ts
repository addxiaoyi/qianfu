/**
 * API 版本化中间件
 *
 * 支持 URL 前缀版本化 (/api/v1, /api/v2) 和 Header/Query 协商。
 * 遵循 RFC 8594 (Sunset Header) 和 HTTP Deprecation 标准进行弃用通知。
 *
 * @module server/middleware/apiVersioning
 */
import { Request, Response, NextFunction } from 'express';
/** 响应头：当前请求使用的 API 版本 */
export declare const API_VERSION_HEADER = "X-API-Version";
/** 默认 API 版本 */
export declare const DEFAULT_VERSION: "v1";
/** 支持的版本列表 */
export declare const SUPPORTED_VERSIONS: readonly ["v1"];
export type ApiVersion = (typeof SUPPORTED_VERSIONS)[number];
interface VersionConfig {
    /** URL 前缀，如 /api/v1 */
    prefix: string;
    /** 状态：active | deprecated | sunset */
    status: 'active' | 'deprecated' | 'sunset';
    /** 弃用日期（RFC 3339），仅 status=deprecated 时有意义 */
    deprecationDate?: string;
    /** 下线日期（RFC 3339），到达后服务端可返回 410 */
    sunsetDate?: string;
    /** 继任版本 */
    successorVersion?: string;
}
/**
 * 版本配置表
 *
 * 新增版本时在此注册。已弃用版本应设置 deprecationDate 和 sunsetDate。
 */
declare const versionConfigs: Record<string, VersionConfig>;
/**
 * API 版本化中间件
 *
 * 功能：
 * 1. 从请求路径提取版本号，或从 Header/Query 协商
 * 2. 将协商结果写入 res.locals.apiVersion 供下游使用
 * 3. 在响应中添加 X-API-Version 头
 * 4. 对于已弃用版本添加 Deprecation / Sunset / Link 头
 * 5. 对于已下线版本返回 410 Gone
 */
export declare const apiVersioningMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * 创建版本化路由器
 *
 * @param version API 版本标识，如 'v1'
 * @returns { prefix, router, config } 用于注册路由
 */
export declare const createVersionedRouter: (version: ApiVersion | string) => {
    prefix: string;
    router: import("express-serve-static-core").Router;
    config: VersionConfig;
};
/**
 * 获取所有已注册的版本配置
 */
export declare const getVersionConfigs: () => Readonly<typeof versionConfigs>;
/**
 * 注册新的 API 版本
 *
 * @param version 版本标识
 * @param config 版本配置
 */
export declare const registerVersion: (version: string, config: VersionConfig) => void;
/**
 * 向后兼容中间件：将 /api/* 请求重定向到 /api/v1/*
 *
 * 在过渡期内挂载，确保未带版本前缀的旧请求仍能正常工作。
 * 可通过 BACKWARD_COMPAT_ENABLED 环境变量控制（默认开启）。
 */
export declare const backwardCompatRedirect: (req: Request, res: Response, next: NextFunction) => void;
export default apiVersioningMiddleware;
//# sourceMappingURL=apiVersioning.d.ts.map