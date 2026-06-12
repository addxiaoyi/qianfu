/**
 * 中间件分层架构
 *
 * 将 Express 中间件按职责分层，提高可维护性和扩展性
 *
 * Layer 0: 基础设施层 (Foundation)
 * Layer 1: 安全层 (Security)
 * Layer 2: 业务前准备 (Business Prep)
 * Layer 3: 业务路由 (Business Routes)
 * Layer 4: 错误处理 (Error Handling)
 */

import express, { Application, RequestHandler } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { registerApiRoutes } from '../routes';
import { registerSecurityHeaders, registerCors, registerHpp } from './security';
import { registerRateLimiters } from './rateLimit';
import { unifiedResponseHandler } from '../middleware/responseHandler';
import { errorHandler } from '../middleware/error';
import { metricsService } from '../services/metricsService';
import { superTokensMiddleware, superTokensErrorHandler } from '../supertokens/initSuperTokens';
import { port5555ErrorHandler, port5555SecurityRedirect, createPort5555ErrorRoutes } from '../middleware/port5555ErrorHandler';
import { createWAFMiddleware } from '../middleware/waf';
import { createSQLInjectionProtection } from '../utils/sanitizer';
import { createXSSProtection } from '../utils/xssProtection';
import { swaggerSpec } from '../config/swagger';
import { antiCrawler } from '../middleware/antiCrawler';
import { cacheMiddleware } from '../middleware/cache';
import { requestIdMiddleware } from '../middleware/requestId';
import { metricsMiddleware } from '../middleware/metrics';
import { createRequestTimeoutMiddleware } from '../middleware/requestTimeout';
import { registerHealthRoutes } from './healthRoutes';
import { registerProxyRoutes, registerStaticAndFallback } from './proxyAndStatic';
import { registerApiAccessLog, registerHttpsRedirect } from './httpGuards';
import { apiVersioningMiddleware } from '../middleware/apiVersioning';

// ============================================================================
// Layer 0: 基础设施层 (Foundation)
// ============================================================================
const foundationLayer: RequestHandler[] = [
  requestIdMiddleware,
  metricsMiddleware,
  compression(),
  cookieParser(),
];

// ============================================================================
// Layer 1: 安全层 (Security)
// ============================================================================
// securityLayer is used for documentation purposes and can be extended
const _securityLayer: RequestHandler[] = [
  superTokensMiddleware(),
  createWAFMiddleware({
    enabled: process.env.WAF_ENABLED !== 'false' || process.env.NODE_ENV === 'production',
    blockSuspiciousIPs: true,
    rateLimitWindow: 60000,
    maxRequestsPerWindow: Number.parseInt(process.env.WAF_MAX_REQUESTS || '100'),
  }),
];

// ============================================================================
// Layer 2: 业务前准备 (Business Prep)
// ============================================================================
const businessPrepLayer: RequestHandler[] = [
  apiVersioningMiddleware,
  cacheMiddleware,
];

// ============================================================================
// 注册各层级中间件
// ============================================================================

/**
 * 初始化 Layer 0: 基础设施层
 */
export function registerFoundationLayer(app: Application): void {
  registerSecurityHeaders(app);
  registerCors(app);

  for (const middleware of foundationLayer) {
    app.use(middleware);
  }

  // JSON/URL 解析
  app.use(express.json({
    limit: '1mb',
    strict: true,
    verify: (req, _res, buf) => {
      ((req as unknown) as { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

  // Swagger 文档
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

/**
 * 初始化 Layer 1: 安全层
 */
export function registerSecurityLayer(app: Application): void {
  // SuperTokens 必须在业务路由之前挂载，否则 /auth/* 端点不会生效。
  app.use(superTokensMiddleware());

  registerHpp(app);

  const sqlInjectionEnabled = process.env.SQL_INJECTION_PROTECTION !== 'false';
  app.use(createSQLInjectionProtection(sqlInjectionEnabled));

  const xssProtectionEnabled = process.env.XSS_PROTECTION !== 'false';
  const xssBlockMode = process.env.NODE_ENV === 'production';
  app.use(
    createXSSProtection({
      enabled: xssProtectionEnabled,
      blockMode: xssBlockMode,
      whitelistPaths: [],
    })
  );

  app.use(antiCrawler);
}

/**
 * 初始化 Layer 2: 业务准备层
 */
export function registerBusinessPrepLayer(app: Application): void {
  registerApiAccessLog(app);
  registerHttpsRedirect(app);
  registerRateLimiters(app);
  app.use(
    '/api',
    createRequestTimeoutMiddleware({
      timeoutMs: Number.parseInt(process.env.API_REQUEST_TIMEOUT_MS || '15000', 10),
      excludePaths: ['/api/health', '/api-docs', '/api/v1/auth/github/callback', '/api/auth/github/callback', '/auth/callback/github'],
    }),
  );

  for (const middleware of businessPrepLayer) {
    app.use(middleware);
  }
}

/**
 * 初始化 Layer 3: 业务路由
 */
export function registerBusinessRouteLayer(app: Application): void {
  registerHealthRoutes(app);
  registerProxyRoutes(app);

  // 访问追踪
  app.use((req, _res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
      metricsService.trackVisit();
    }
    next();
  });

  app.use(unifiedResponseHandler);
  registerApiRoutes(app);
  registerStaticAndFallback(app);
}

/**
 * 初始化 Layer 4: 错误处理层
 */
export function registerErrorHandlerLayer(app: Application): void {
  createPort5555ErrorRoutes(app);
  app.use(port5555SecurityRedirect);
  app.use(superTokensErrorHandler());
  app.use(errorHandler);
  app.use(port5555ErrorHandler);
}

/**
 * 一次性初始化所有层级（推荐用于新项目）
 */
export function initializeMiddlewareLayers(app: Application): void {
  registerFoundationLayer(app);
  registerSecurityLayer(app);
  registerBusinessPrepLayer(app);
  registerBusinessRouteLayer(app);
  registerErrorHandlerLayer(app);
}

/**
 * 获取中间件层级信息
 */
export function getMiddlewareLayersInfo(): Array<{ layer: number; name: string; description: string }> {
  return [
    { layer: 0, name: 'Foundation', description: '基础设施层: 请求解析、压缩、追踪、安全头、CORS' },
    { layer: 1, name: 'Security', description: '安全层: WAF、HPP、SQL注入防护、XSS防护、反爬虫' },
    { layer: 2, name: 'BusinessPrep', description: '业务准备层: 访问日志、HTTPS重定向、限流、缓存' },
    { layer: 3, name: 'BusinessRoutes', description: '业务路由层: 健康检查、API路由、静态文件' },
    { layer: 4, name: 'ErrorHandlers', description: '错误处理层: 统一错误响应、5555兜底' },
  ];
}

export default {
  initializeMiddlewareLayers,
  registerFoundationLayer,
  registerSecurityLayer,
  registerBusinessPrepLayer,
  registerBusinessRouteLayer,
  registerErrorHandlerLayer,
  getMiddlewareLayersInfo,
};
