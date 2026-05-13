/**
 * API 版本化中间件
 *
 * 支持 URL 前缀版本化 (/api/v1, /api/v2) 和 Header/Query 协商。
 * 遵循 RFC 8594 (Sunset Header) 和 HTTP Deprecation 标准进行弃用通知。
 *
 * @module server/middleware/apiVersioning
 */
import { Router } from 'express';
import { logger } from '../utils/logger';
import { API_DEFAULT_VERSION, API_PREFIX, SUPPORTED_API_VERSIONS, } from '../constants/api';
import { buildErrorEnvelope } from '../contracts/responseEnvelope';
// ---------------------------------------------------------------------------
// 常量 & 类型
// ---------------------------------------------------------------------------
/** 响应头：当前请求使用的 API 版本 */
export const API_VERSION_HEADER = 'X-API-Version';
/** 默认 API 版本 */
export const DEFAULT_VERSION = API_DEFAULT_VERSION;
/** 支持的版本列表 */
export const SUPPORTED_VERSIONS = SUPPORTED_API_VERSIONS;
/**
 * 版本配置表
 *
 * 新增版本时在此注册。已弃用版本应设置 deprecationDate 和 sunsetDate。
 */
const versionConfigs = {
    v1: {
        prefix: `${API_PREFIX}/v1`,
        status: 'active',
    },
    // v2 示例（预留，启用时取消注释并添加路由）
    // v2: {
    //   prefix: '/api/v2',
    //   status: 'deprecated',
    //   deprecationDate: '2026-06-01',
    //   sunsetDate: '2027-01-01',
    //   successorVersion: 'v3',
    // },
};
// ---------------------------------------------------------------------------
// 中间件
// ---------------------------------------------------------------------------
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
export const apiVersioningMiddleware = (req, res, next) => {
    // 1) 从 URL 路径提取版本 (/api/v1/... → v1)
    const pathVersionMatch = req.path.match(/^\/api\/(v\d+)\//);
    const pathVersion = pathVersionMatch ? pathVersionMatch[1] : null;
    // 2) 从 Header / Query 协商版本
    const headerVersion = req.headers[API_VERSION_HEADER.toLowerCase()];
    const queryVersion = req.query['api-version'];
    // 优先级：URL 路径 > Header > Query > 默认
    const version = pathVersion || headerVersion || queryVersion || DEFAULT_VERSION;
    // 3) 校验版本是否已注册
    const config = versionConfigs[version];
    if (!config) {
        res.setHeader('Accept-Version', SUPPORTED_VERSIONS.join(', '));
        res.status(400).json(buildErrorEnvelope({
            message: `Unsupported API version: ${version}`,
            code: 'UNSUPPORTED_API_VERSION',
            statusCode: 400,
            requestId: req.requestId,
            details: { supportedVersions: SUPPORTED_VERSIONS },
        }));
        return;
    }
    // 4) 检查是否已下线
    if (config.status === 'sunset' && config.sunsetDate) {
        const sunsetTime = new Date(config.sunsetDate).getTime();
        if (Date.now() >= sunsetTime) {
            res.setHeader(API_VERSION_HEADER, version);
            res.status(410).json(buildErrorEnvelope({
                message: `API version ${version} has been sunset since ${config.sunsetDate}`,
                code: 'API_VERSION_SUNSET',
                statusCode: 410,
                requestId: req.requestId,
                details: { successorVersion: config.successorVersion },
            }));
            return;
        }
    }
    // 5) 写入 locals 供下游中间件/路由使用
    res.locals.apiVersion = version;
    res.locals.versionConfig = config;
    // 6) 设置响应头
    res.setHeader(API_VERSION_HEADER, version);
    // 7) 弃用通知
    if (config.status === 'deprecated') {
        res.setHeader('Deprecation', 'true');
        if (config.sunsetDate) {
            res.setHeader('Sunset', config.sunsetDate);
        }
        if (config.successorVersion) {
            const successorPrefix = versionConfigs[config.successorVersion]?.prefix || `${API_PREFIX}/v2`;
            res.setHeader('Link', `<${successorPrefix}${req.path.replace(config.prefix, '')}>; rel="successor-version"`);
        }
        logger.warn(`Deprecated API version ${version} accessed: ${req.method} ${req.originalUrl}`);
    }
    next();
};
// ---------------------------------------------------------------------------
// 辅助工具
// ---------------------------------------------------------------------------
/**
 * 创建版本化路由器
 *
 * @param version API 版本标识，如 'v1'
 * @returns { prefix, router, config } 用于注册路由
 */
export const createVersionedRouter = (version) => {
    const config = versionConfigs[version];
    if (!config) {
        throw new Error(`Unknown API version: ${version}. Registered: ${Object.keys(versionConfigs).join(', ')}`);
    }
    return {
        prefix: config.prefix,
        router: Router(),
        config,
    };
};
/**
 * 获取所有已注册的版本配置
 */
export const getVersionConfigs = () => {
    return versionConfigs;
};
/**
 * 注册新的 API 版本
 *
 * @param version 版本标识
 * @param config 版本配置
 */
export const registerVersion = (version, config) => {
    if (versionConfigs[version]) {
        logger.warn(`API version ${version} already registered, overwriting`);
    }
    versionConfigs[version] = config;
    logger.info(`Registered API version: ${version} → ${config.prefix} (${config.status})`);
};
/**
 * 向后兼容中间件：将 /api/* 请求重定向到 /api/v1/*
 *
 * 在过渡期内挂载，确保未带版本前缀的旧请求仍能正常工作。
 * 可通过 BACKWARD_COMPAT_ENABLED 环境变量控制（默认开启）。
 */
export const backwardCompatRedirect = (req, res, next) => {
    const enabled = process.env.BACKWARD_COMPAT_ENABLED !== 'false';
    if (!enabled) {
        next();
        return;
    }
    // 仅匹配 /api/ 开头但不是 /api/vN 开头的请求
    if (req.path.startsWith(`${API_PREFIX}/`) && !req.path.match(/^\/api\/v\d+\//)) {
        // 排除 /api-docs, /api/v1 等已版本化的路径
        const newPath = `${API_PREFIX}/${DEFAULT_VERSION}${req.path.replace(API_PREFIX, '')}`;
        logger.debug(`Backward compat redirect: ${req.originalUrl} → ${newPath}`);
        // 使用 rewrite 而非 302 重定向，避免额外网络开销
        req.url = newPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    }
    next();
};
export default apiVersioningMiddleware;
//# sourceMappingURL=apiVersioning.js.map