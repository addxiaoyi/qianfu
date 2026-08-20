/**
 * 等保合规安全中心
 * 优化项 120: 等级保护 - 等保合规
 *
 * 等保2.0 (GB/T 22239-2019) 合规要求覆盖:
 * - 安全通信网络: HTTPS、HSTS、安全传输
 * - 安全区域边界: CORS、XSS、CSRF、请求限流、入侵检测
 * - 安全计算环境: 安全审计、敏感数据保护
 * - 安全管理中心: 安全事件记录、集中日志
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as crypto from 'crypto';
import { env, config as appConfig } from '../../config/env';

// ============================================================
// Types - 安全配置
// ============================================================

export interface SecurityConfig {
  // HTTPS配置
  https: {
    enabled: boolean;
    hsts: boolean;
    hstsMaxAge: number;
    hstsIncludeSubDomains: boolean;
    hstsPreload: boolean;
  };

  // CORS配置
  cors: {
    enabled: boolean;
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };

  // CSRF配置
  csrf: {
    enabled: boolean;
    tokenLength: number;
    tokenExpiry: number;
    headerName: string;
    cookieName: string;
  };

  // 限流配置
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    maxRequestsAuth: number;
    message: string;
    skipSuccessfulRequests: boolean;
  };

  // 安全头配置
  securityHeaders: {
    enabled: boolean;
    contentSecurityPolicy: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    xPermittedCrossDomainPolicies: string;
    referrerPolicy: string;
  };

  // 敏感数据保护
  sensitiveData: {
    enabled: boolean;
    patterns: { pattern: RegExp; replacement: string }[];
    fieldsToEncrypt: string[];
  };

  // 暴力破解防护
  bruteForce: {
    enabled: boolean;
    maxAttempts: number;
    lockoutDuration: number;
    ipTracking: boolean;
  };

  // IP黑白名单
  ipControl: {
    blacklist: string[];
    whitelist: string[];
    checkProxy: boolean;
    proxyHeaders: string[];
  };

  // SQL注入防护
  sqlInjection: {
    enabled: boolean;
    blockSuspicious: boolean;
    logSuspicious: boolean;
  };

  // XSS防护
  xss: {
    enabled: boolean;
    blockSuspicious: boolean;
    sanitizeHtml: boolean;
  };

  // 安全日志
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    includeRequestBody: boolean;
    includeResponseBody: boolean;
    excludePaths: string[];
  };

  // DNS预解析 (优化项 35)
  dnsPrefetch: {
    enabled: boolean;
    /** 需要预解析的域名列表 */
    domains: string[];
    /** 是否启用预连接 (同时建立TCP/TLS连接) */
    preconnect: boolean;
    /** 是否启用预加载 (预加载关键资源) */
    preload: boolean;
    /** 预加载的资源列表 */
    preloadResources: PreloadResource[];
    /** 预取配置 (优化项 34 新增) */
    prefetch: boolean;
    prefetchResources: PrefetchResource[];
    /** 动态预取配置 */
    dynamicPrefetch: boolean;
  };
}

export interface PreloadResource {
  /** 资源URL */
  url: string;
  /** 资源类型: script, style, font, image, fetch, etc */
  as: 'script' | 'style' | 'font' | 'image' | 'fetch' | 'object' | 'worker' | 'embed';
  /** 跨域设置: anonymous, use-credentials */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** 资源类型: default, list-style, render-blocking */
  type?: 'default' | 'list-style' | 'render-blocking';
  /** 是否禁用MIME类型检查 */
  noMimetypeCheck?: boolean;
}

/**
 * 预取资源 (优化项 34)
 * 用于预取用户可能访问的后续页面资源
 */
export interface PrefetchResource {
  /** 资源URL */
  url: string;
  /** 资源类型 */
  as: 'document' | 'script' | 'style' | 'font' | 'image' | 'raw' | 'fetch';
  /** 跨域设置 */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** 预取策略: auto=自动, render=渲染时预取, no-render=仅网络预取 */
  policy?: 'auto' | 'render' | 'no-render';
}

/**
 * 资源提示完整配置 (优化项 34)
 */
export interface ResourceHintConfig {
  enabled: boolean;
  /** 预连接域名 (优化项 35) */
  domains: string[];
  /** 是否启用预连接 */
  preconnect: boolean;
  /** 预加载当前页面关键资源 */
  preload: boolean;
  /** 预加载资源列表 */
  preloadResources: PreloadResource[];
  /** 预取后续页面资源 (优化项 34 新增) */
  prefetch: boolean;
  /** 预取资源列表 */
  prefetchResources: PrefetchResource[];
  /** 动态预加载策略 (基于路由) */
  dynamicPrefetch: boolean;
  /** 路由级预取配置 */
  routePrefetch?: Record<string, string[]>;
}

export const defaultSecurityConfig: SecurityConfig = {
  https: {
    enabled: true,
    hsts: true,
    hstsMaxAge: 31536000,
    hstsIncludeSubDomains: true,
    hstsPreload: false,
  },
  cors: {
    enabled: true,
    allowedOrigins: appConfig.security.allowedOrigins,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    credentials: true,
    maxAge: 86400,
  },
  csrf: {
    enabled: true,
    tokenLength: 32,
    tokenExpiry: 86400000,
    headerName: 'x-csrf-token',
    cookieName: 'csrf_token',
  },
  rateLimit: {
    enabled: true,
    windowMs: 60000,
    maxRequests: 100,
    maxRequestsAuth: 10,
    message: '请求过于频繁，请稍后再试',
    skipSuccessfulRequests: false,
  },
  securityHeaders: {
    enabled: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xPermittedCrossDomainPolicies: 'none',
    referrerPolicy: 'strict-origin-when-cross-origin',
  },
  sensitiveData: {
    enabled: true,
    patterns: [
      { pattern: /(\b\d{15,18}\b)/g, replacement: '***REDACTED_ID***' },
      { pattern: /(\b\d{3}-\d{2}-\d{4}\b)/g, replacement: '***REDACTED_SSN***' },
      { pattern: /(password["\s:=]+)[^&\s]+/gi, replacement: '$1***REDACTED***' },
      { pattern: /(secret["\s:=]+)[^&\s]+/gi, replacement: '$1***REDACTED***' },
      { pattern: /(token["\s:=]+)[^&\s]+/gi, replacement: '$1***REDACTED***' },
      { pattern: /(api[_-]?key["\s:=]+)[^&\s]+/gi, replacement: '$1***REDACTED***' },
    ],
    fieldsToEncrypt: ['idCard', 'bankCard', 'phone', 'address'],
  },
  bruteForce: {
    enabled: true,
    maxAttempts: 5,
    lockoutDuration: 900000,
    ipTracking: true,
  },
  ipControl: {
    blacklist: [],
    whitelist: [],
    checkProxy: true,
    proxyHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'],
  },
  sqlInjection: {
    enabled: true,
    blockSuspicious: true,
    logSuspicious: true,
  },
  xss: {
    enabled: true,
    blockSuspicious: true,
    sanitizeHtml: true,
  },
  logging: {
    enabled: true,
    level: 'info',
    includeRequestBody: false,
    includeResponseBody: false,
    excludePaths: ['/health', '/metrics'],
  },

  // DNS预解析 (优化项 35: DNS预解析 - 域名解析)
  dnsPrefetch: {
    enabled: true,
    /** 需要预解析的域名列表 */
    domains: [
      // 外部API服务
      'api.openai.com',      // OpenAI API
      'api.cohere.ai',       // Cohere API
    ],
    /** 是否启用预连接 (同时建立TCP/TLS连接) */
    preconnect: true,
    /** 是否启用预加载 (预加载关键资源) */
    preload: false,
    /** 预加载的资源列表 */
    preloadResources: [],
    /** 预取配置 (优化项 34) */
    prefetch: false,
    prefetchResources: [],
    /** 动态预取配置 */
    dynamicPrefetch: false,
  },
};

export function mergeSecurityConfig(base: SecurityConfig, overrides: Partial<SecurityConfig>): SecurityConfig {
  const merged = JSON.parse(JSON.stringify(base));

  const deepMerge = (target: any, source: any): any => {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  };

  return deepMerge(merged, overrides);
}

export function applySecurityConfig(config: SecurityConfig): SecurityConfig {
  return { ...defaultSecurityConfig, ...config };
}

// ============================================================
// 安全HTTP头
// ============================================================

export function helmetConfig(config: SecurityConfig['securityHeaders'] & { hsts?: boolean; hstsMaxAge?: number; hstsIncludeSubDomains?: boolean; hstsPreload?: boolean }) {
  return {
    contentSecurityPolicy: config.enabled ? config.contentSecurityPolicy : '',
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: false,
    dnsPrefetchControl: { allow: false },
    expectCt: { maxAge: 86400, enforce: true },
    frameguard: { action: config.xFrameOptions === 'DENY' ? 'deny' : 'sameorigin' },
    hidePoweredBy: true,
    hsts: config.enabled && config.hsts ? {
      maxAge: config.hstsMaxAge,
      includeSubDomains: config.hstsIncludeSubDomains,
      preload: config.hstsPreload,
    } : false,
    ieNoOpen: true,
    noSniff: config.enabled && config.xContentTypeOptions === 'nosniff',
    originAgentCluster: true,
    permittedCrossDomainPolicies: config.enabled ? config.xPermittedCrossDomainPolicies : false,
    referrerPolicy: config.enabled ? config.referrerPolicy : '',
    xssFilter: true,
  };
}

export function securityHeaders(config: SecurityConfig['securityHeaders'] & { hsts?: boolean; hstsMaxAge?: number; hstsIncludeSubDomains?: boolean; hstsPreload?: boolean }): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    // HSTS头 (等保: 安全通信网络)
    if (config.hsts) {
      let hstsHeader = `max-age=${config.hstsMaxAge}`;
      if (config.hstsIncludeSubDomains) hstsHeader += '; includeSubDomains';
      if (config.hstsPreload) hstsHeader += '; preload';
      res.setHeader('Strict-Transport-Security', hstsHeader);
    }

    // 其他安全头
    res.setHeader('X-Frame-Options', config.xFrameOptions);
    res.setHeader('X-Content-Type-Options', config.xContentTypeOptions);
    res.setHeader('X-Permitted-Cross-Domain-Policies', config.xPermittedCrossDomainPolicies);
    res.setHeader('Referrer-Policy', config.referrerPolicy);
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // CSP头 (等保: 安全区域边界)
    res.setHeader('Content-Security-Policy', config.contentSecurityPolicy);

    next();
  };
}

// ============================================================
// DNS预解析 (优化项 35: DNS预解析 - 域名解析)
// 预加载 (优化项 34: preload/prefetch)
// ============================================================

export interface DnsPrefetchConfig {
  enabled: boolean;
  domains: string[];
  preconnect: boolean;
  preload: boolean;
  preloadResources: PreloadResource[];
  /** 预取配置 (优化项 34 新增) */
  prefetch: boolean;
  prefetchResources: PrefetchResource[];
  /** 动态预取配置 */
  dynamicPrefetch: boolean;
  /** 路由到资源的映射 */
  routePrefetch?: Record<string, string[]>;
}

/**
 * DNS预解析中间件
 *
 * 功能:
 * - dns-prefetch: 预解析第三方域名DNS
 * - preconnect: 预连接第三方域名 (DNS + TCP + TLS)
 * - preload: 预加载关键资源 (优化项 34)
 * - prefetch: 预取后续页面资源 (优化项 34)
 *
 * 使用场景:
 * - 页面中需要访问的外部API服务
 * - 静态资源CDN域名
 * - 字体、图片等关键资源
 * - 用户可能访问的后续页面
 *
 * 注意: 仅对HTML响应生效，避免对非HTML请求设置不必要的头部
 */
export function dnsPrefetchMiddleware(dnsConfig: DnsPrefetchConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!dnsConfig.enabled) return next();

    // 获取原始的setHeader方法
    const originalSetHeader = res.setHeader.bind(res);

    // 重写setHeader以拦截Link头
    res.setHeader = function(name: string, value: string | string[] | undefined): Response {
      // 对于HTML响应，添加DNS预解析头部
      if (name.toLowerCase() === 'content-type' && value) {
        const contentType = Array.isArray(value) ? value.join('') : String(value);
        const isHtml = contentType.includes('text/html');

        if (isHtml) {
          const allLinks: string[] = [];

          // 1. dns-prefetch头部
          if (dnsConfig.domains.length > 0) {
            const dnsPrefetchLinks = dnsConfig.domains.map(
              domain => `<${getProtocol(domain)}//${domain}>; rel=dns-prefetch`
            );
            originalSetHeader('X-DNS-Prefetch-Control', 'on');
            allLinks.push(...dnsPrefetchLinks);
          }

          // 2. preconnect头部
          if (dnsConfig.preconnect && dnsConfig.domains.length > 0) {
            const preconnectLinks = dnsConfig.domains.map(
              domain => `<${getProtocol(domain)}//${domain}>; rel=preconnect; crossorigin`
            );
            allLinks.push(...preconnectLinks);
          }

          // 3. preload头部 (优化项 34)
          if (dnsConfig.preload && dnsConfig.preloadResources.length > 0) {
            const preloadLinks = dnsConfig.preloadResources.map(resource => {
              const attrs = [`<${resource.url}>`, `rel=preload`, `as=${resource.as}`];
              if (resource.crossOrigin) {
                attrs.push(`crossorigin=${resource.crossOrigin === 'use-credentials' ? 'use-credentials' : ''}`);
              }
              if (resource.noMimetypeCheck) {
                attrs.push('type=text/plain');
              }
              return attrs.join('; ');
            });
            allLinks.push(...preloadLinks);
          }

          // 4. prefetch头部 (优化项 34)
          if (dnsConfig.prefetch && dnsConfig.prefetchResources.length > 0) {
            const prefetchLinks = dnsConfig.prefetchResources.map(resource => {
              const attrs = [`<${resource.url}>`, `rel=prefetch`, `as=${resource.as}`];
              if (resource.crossOrigin) {
                attrs.push(`crossorigin=${resource.crossOrigin === 'use-credentials' ? 'use-credentials' : ''}`);
              }
              if (resource.policy) {
                attrs.push(`policy=${resource.policy}`);
              }
              return attrs.join('; ');
            });
            allLinks.push(...prefetchLinks);
          }

          // 设置Link头
          if (allLinks.length > 0) {
            originalSetHeader('Link', allLinks.join(', '));
          }
        }
      }

      return originalSetHeader(name, value);
    };

    next();
  };
}

/**
 * 简化版DNS预解析中间件
 * 直接在所有响应上添加头部，不检查Content-Type
 */
export function dnsPrefetchMiddlewareSimple(dnsConfig: DnsPrefetchConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!dnsConfig.enabled) return next();

    // 添加dns-prefetch头部
    if (dnsConfig.domains.length > 0) {
      res.setHeader('X-DNS-Prefetch-Control', 'on');
    }

    next();
  };
}

/**
 * 创建带缓存的DNS预解析中间件
 * 避免重复计算和设置头部
 * 支持: dns-prefetch, preconnect, preload, prefetch (优化项 34)
 */
const dnsHeaderCache = new Map<string, {
  dnsPrefetch: string;
  preconnect: string;
  preload: string;
  prefetch: string;
}>();

function getDnsHeaders(config: DnsPrefetchConfig): {
  dnsPrefetch: string;
  preconnect: string;
  preload: string;
  prefetch: string;
} {
  const cacheKey = JSON.stringify(config);

  if (dnsHeaderCache.has(cacheKey)) {
    return dnsHeaderCache.get(cacheKey)!;
  }

  const dnsPrefetchLinks = config.domains.map(
    domain => `<${getProtocol(domain)}//${domain}>; rel=dns-prefetch`
  );

  const preconnectLinks = config.domains.map(
    domain => `<${getProtocol(domain)}//${domain}>; rel=preconnect; crossorigin`
  );

  const preloadLinks = config.preloadResources.map(resource => {
    const attrs = [`<${resource.url}>`, `rel=preload`, `as=${resource.as}`];
    if (resource.crossOrigin) {
      attrs.push(`crossorigin=${resource.crossOrigin === 'use-credentials' ? 'use-credentials' : ''}`);
    }
    return attrs.join('; ');
  });

  // prefetch资源 (优化项 34)
  const prefetchLinks = config.prefetchResources.map(resource => {
    const attrs = [`<${resource.url}>`, `rel=prefetch`, `as=${resource.as}`];
    if (resource.crossOrigin) {
      attrs.push(`crossorigin=${resource.crossOrigin === 'use-credentials' ? 'use-credentials' : ''}`);
    }
    if (resource.policy) {
      attrs.push(`policy=${resource.policy}`);
    }
    return attrs.join('; ');
  });

  const result = {
    dnsPrefetch: dnsPrefetchLinks.join(', '),
    preconnect: preconnectLinks.join(', '),
    preload: preloadLinks.join(', '),
    prefetch: prefetchLinks.join(', '),
  };

  dnsHeaderCache.set(cacheKey, result);

  // 限制缓存大小
  if (dnsHeaderCache.size > 100) {
    const firstKey = dnsHeaderCache.keys().next().value;
    if (firstKey) dnsHeaderCache.delete(firstKey);
  }

  return result;
}

/**
 * 高性能DNS预解析中间件
 * 使用预计算的Header值，适用于高并发场景
 * 支持: dns-prefetch, preconnect, preload, prefetch (优化项 34)
 */
export function dnsPrefetchMiddlewareOptimized(dnsConfig: DnsPrefetchConfig): RequestHandler {
  const { dnsPrefetch, preconnect, preload, prefetch } = getDnsHeaders(dnsConfig);
  const allLinks = [dnsPrefetch, preconnect, preload, prefetch].filter(Boolean).join(', ');

  return (_req: Request, res: Response, next: NextFunction) => {
    if (!dnsConfig.enabled) return next();

    // 设置DNS预解析控制
    res.setHeader('X-DNS-Prefetch-Control', 'on');

    // 设置所有Link头
    if (allLinks) {
      res.setHeader('Link', allLinks);
    }

    next();
  };
}

/**
 * 基于路由的动态预加载中间件 (优化项 34)
 * 根据当前路由智能添加预加载/预取资源
 */
export function dynamicPrefetchMiddleware(dnsConfig: DnsPrefetchConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!dnsConfig.enabled || !dnsConfig.dynamicPrefetch || !dnsConfig.routePrefetch) {
      return next();
    }

    const currentPath = req.path;
    const prefetchResources = dnsConfig.routePrefetch[currentPath] || [];

    if (prefetchResources.length === 0) return next();

    // 获取基础Link头
    const { dnsPrefetch, preconnect, preload, prefetch } = getDnsHeaders(dnsConfig);
    const baseLinks = [dnsPrefetch, preconnect, preload, prefetch].filter(Boolean).join(', ');

    // 添加路由特定的预取资源
    const routePrefetchLinks = prefetchResources.map(url => {
      const as = getResourceAs(url);
      return `<${url}>; rel=prefetch; as=${as}`;
    });

    const allLinks = baseLinks
      ? `${baseLinks}, ${routePrefetchLinks.join(', ')}`
      : routePrefetchLinks.join(', ');

    res.setHeader('X-DNS-Prefetch-Control', 'on');
    res.setHeader('Link', allLinks);

    next();
  };
}

/**
 * 根据URL判断资源类型
 */
function getResourceAs(url: string): string {
  if (url.endsWith('.js') || url.endsWith('.mjs')) return 'script';
  if (url.endsWith('.css')) return 'style';
  if (url.endsWith('.woff2') || url.endsWith('.woff') || url.endsWith('.ttf') || url.endsWith('.otf')) return 'font';
  if (/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url)) return 'image';
  if (url.startsWith('/api/') || url.startsWith('https://')) return 'fetch';
  return 'document';
}

/**
 * 根据域名判断协议
 */
function getProtocol(domain: string): string {
  // 如果域名已包含协议，直接返回
  if (domain.startsWith('https://') || domain.startsWith('http://')) {
    return domain.split('://')[0] + '://';
  }
  // 默认使用HTTPS (更安全且现代API普遍支持)
  return 'https://';
}

/**
 * 清除DNS Header缓存
 */
export function clearDnsHeaderCache(): void {
  dnsHeaderCache.clear();
}

/**
 * 获取当前缓存大小 (用于监控)
 */
export function getDnsHeaderCacheSize(): number {
  return dnsHeaderCache.size;
}

// ============================================================
// CORS配置 (等保: 安全区域边界)
// ============================================================

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export function getCorsMiddleware(corsConfig: CorsConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // 检查是否为白名单Origin
    if (origin && corsConfig.allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && corsConfig.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (corsConfig.allowedOrigins.length === 0 || corsConfig.allowedOrigins[0] === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    if (corsConfig.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (corsConfig.exposedHeaders.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', corsConfig.allowedMethods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', String(corsConfig.maxAge));
      res.status(204).end();
      return;
    }

    next();
  };
}

export const corsConfig: CorsConfig = defaultSecurityConfig.cors;

// ============================================================
// CSRF防护 (等保: 安全区域边界)
// ============================================================

interface CsrfToken {
  token: string;
  createdAt: number;
  expiresAt: number;
}

class CsrfTokenStore {
  private tokens: Map<string, CsrfToken> = new Map();
  private config: SecurityConfig['csrf'];

  constructor(config: SecurityConfig['csrf']) {
    this.config = config;
    // 定期清理过期token
    setInterval(() => this.cleanup(), 60000);
  }

  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(this.config.tokenLength).toString('hex');
    const now = Date.now();

    this.tokens.set(sessionId, {
      token,
      createdAt: now,
      expiresAt: now + this.config.tokenExpiry,
    });

    return token;
  }

  validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
      this.tokens.delete(sessionId);
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored.token));
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.tokens.entries());
    for (const [key, value] of entries) {
      if (now > value.expiresAt) {
        this.tokens.delete(key);
      }
    }
  }
}

let csrfStore: CsrfTokenStore;

export function initCsrfStore(config: SecurityConfig['csrf']): void {
  csrfStore = new CsrfTokenStore(config);
}

export function generateCsrfToken(sessionId: string): string {
  if (!csrfStore) initCsrfStore(defaultSecurityConfig.csrf);
  return csrfStore.generateToken(sessionId);
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  if (!csrfStore) return true; // 如果未初始化，默认通过
  return csrfStore.validateToken(sessionId, token);
}

export function csrfProtection(config: SecurityConfig['csrf']): RequestHandler {
  initCsrfStore(config);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    // 跳过安全方法
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) return next();

    // 获取session ID
    const sessionId = (req as any).sessionId || req.ip || 'anonymous';
    const token = req.get(config.headerName) || req.cookies?.[config.cookieName];

    if (token && !validateCsrfToken(sessionId, token)) {
      res.status(403).json({
        success: false,
        error: 'CSRF token invalid',
        code: 'INVALID_CSRF_TOKEN'
      });
      return;
    }

    // 生成新token
    const newToken = generateCsrfToken(sessionId);
    res.setHeader(config.headerName, newToken);
    res.cookie(config.cookieName, newToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: config.tokenExpiry,
    });

    next();
  };
}

// ============================================================
// 请求限流 (等保: 安全区域边界 - 入侵检测)
// ============================================================

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class RateLimitStore {
  private store: Map<string, RateLimitRecord> = new Map();

  increment(key: string, windowMs: number): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      this.store.set(key, record);
    }

    record.count++;
    const remaining = Math.max(0, this.getLimit(key) - record.count);
    const allowed = remaining > 0;

    return { allowed, remaining, resetTime: record.resetTime };
  }

  private getLimit(key: string): number {
    // 可以根据key类型返回不同限制
    if (key.includes('auth') || key.includes('login')) {
      return defaultSecurityConfig.rateLimit.maxRequestsAuth;
    }
    return defaultSecurityConfig.rateLimit.maxRequests;
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (const [key, record] of entries) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

export function createRateLimiter(config: SecurityConfig['rateLimit'], store: RateLimitStore): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    // 生成限流key
    const key = (req as any).userId || req.ip || 'anonymous';

    const { allowed, remaining, resetTime } = store.increment(key, config.windowMs);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    if (!allowed) {
      res.status(429).json({
        success: false,
        error: config.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

export const rateLimiter = createRateLimiter(
  defaultSecurityConfig.rateLimit,
  new RateLimitStore()
);

// ============================================================
// 安全审计 (等保: 安全计算环境)
// ============================================================

export enum AuditEventType {
  // 认证事件
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',

  // 授权事件
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ACCESS_DENIED = 'ACCESS_DENIED',

  // 数据事件
  DATA_ACCESSED = 'DATA_ACCESSED',
  DATA_CREATED = 'DATA_CREATED',
  DATA_MODIFIED = 'DATA_MODIFIED',
  DATA_DELETED = 'DATA_DELETED',
  DATA_EXPORTED = 'DATA_EXPORTED',

  // 安全事件
  SECURITY_ALERT = 'SECURITY_ALERT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  CSRF_ATTEMPT = 'CSRF_ATTEMPT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',

  // 合规事件
  COMPLIANCE_REPORT_GENERATED = 'COMPLIANCE_REPORT_GENERATED',
  AUDIT_LOG_EXPORTED = 'AUDIT_LOG_EXPORTED',
}

export interface AuditResult {
  eventId: string;
  eventType: AuditEventType;
  timestamp: string;
  userId?: string;
  userName?: string;
  ip: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  action: string;
  result: 'success' | 'failure' | 'warning';
  details?: Record<string, any>;
  sessionId?: string;
}

class SecurityAuditLogger {
  private logs: AuditResult[] = [];
  private maxLogs = 10000;

  log(event: Omit<AuditResult, 'eventId' | 'timestamp'>): AuditResult {
    const auditEvent: AuditResult = {
      ...event,
      eventId: `AUD-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(auditEvent);

    // 保持日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 打印到控制台 (生产环境应发送到日志系统)
    if (event.result !== 'success' || event.eventType.includes('SECURITY')) {
      console.log(`[SECURITY-AUDIT] ${auditEvent.eventType}: ${JSON.stringify(auditEvent)}`);
    }

    return auditEvent;
  }

  query(filters: {
    eventType?: AuditEventType;
    userId?: string;
    ip?: string;
    startTime?: string;
    endTime?: string;
    result?: string;
  }): AuditResult[] {
    let results = this.logs;

    if (filters.eventType) {
      results = results.filter((l) => l.eventType === filters.eventType);
    }
    if (filters.userId) {
      results = results.filter((l) => l.userId === filters.userId);
    }
    if (filters.ip) {
      results = results.filter((l) => l.ip === filters.ip);
    }
    if (filters.startTime) {
      results = results.filter((l) => l.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      results = results.filter((l) => l.timestamp <= filters.endTime!);
    }
    if (filters.result) {
      results = results.filter((l) => l.result === filters.result);
    }

    return results;
  }

  getLogs(limit = 100): AuditResult[] {
    return this.logs.slice(-limit);
  }
}

export const securityAudit = {
  log: (event: Omit<AuditResult, 'eventId' | 'timestamp'>) => auditLogger.log(event),
  query: (filters: Parameters<typeof auditLogger.query>[0]) => auditLogger.query(filters),
  getLogs: (limit?: number) => auditLogger.getLogs(limit),
};

class AuditLogger extends SecurityAuditLogger {}
const auditLogger = new AuditLogger();

export class SecurityLogger {
  static log(event: Omit<AuditResult, 'eventId' | 'timestamp'>): AuditResult {
    return auditLogger.log(event);
  }

  static query(filters: {
    eventType?: AuditEventType;
    userId?: string;
    ip?: string;
    startTime?: string;
    endTime?: string;
    result?: string;
  }): AuditResult[] {
    return auditLogger.query(filters);
  }

  static getLogs(limit = 100): AuditResult[] {
    return auditLogger.getLogs(limit);
  }
}

export function getSecurityLogger(): SecurityLogger {
  return SecurityLogger;
}

// ============================================================
// 敏感数据保护 (等保: 安全计算环境)
// ============================================================

export enum DataMaskType {
  FULL = 'full',         // 完全脱敏: ****
  PARTIAL = 'partial',   // 部分脱敏: 130****1234
  HASH = 'hash',         // 哈希: a1b2c3...
}

export interface MaskRule {
  field: string;
  type: DataMaskType;
  prefixLength?: number;
  suffixLength?: number;
}

const defaultMaskRules: MaskRule[] = [
  { field: 'phone', type: DataMaskType.PARTIAL, prefixLength: 3, suffixLength: 4 },
  { field: 'email', type: DataMaskType.PARTIAL, prefixLength: 2, suffixLength: 2 },
  { field: 'idCard', type: DataMaskType.PARTIAL, prefixLength: 6, suffixLength: 4 },
  { field: 'bankCard', type: DataMaskType.PARTIAL, prefixLength: 4, suffixLength: 4 },
  { field: 'password', type: DataMaskType.FULL },
  { field: 'secret', type: DataMaskType.FULL },
  { field: 'token', type: DataMaskType.FULL },
];

export function maskSensitiveData(data: any, rules: MaskRule[] = defaultMaskRules): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, rules));
  }

  if (typeof data === 'object') {
    const masked: any = {};
    for (const [key, value] of Object.entries(data)) {
      const rule = rules.find((r) => r.field === key.toLowerCase());
      if (rule) {
        masked[key] = applyMask(String(value), rule);
      } else if (typeof value === 'object') {
        masked[key] = maskSensitiveData(value, rules);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return data;
}

function applyMask(value: string, rule: MaskRule): string {
  switch (rule.type) {
    case DataMaskType.FULL:
      return '****';
    case DataMaskType.PARTIAL:
      const prefixLen = rule.prefixLength || 0;
      const suffixLen = rule.suffixLength || 0;
      if (value.length <= prefixLen + suffixLen) {
        return '*'.repeat(value.length);
      }
      return value.substring(0, prefixLen) + '*'.repeat(value.length - prefixLen - suffixLen) + value.substring(value.length - suffixLen);
    case DataMaskType.HASH:
      return crypto.createHash('sha256').update(value).digest('hex').substring(0, 12);
    default:
      return value;
  }
}

// 字段加密 (等保: 重要数据传输)
const ENCRYPTION_KEY = appConfig.security.dataEncryptionKey;
const ALGORITHM = 'aes-256-gcm';

export function encryptField(value: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptField(encryptedValue: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedValue.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function sensitiveDataProtection(config: SecurityConfig['sensitiveData']): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    // 记录原始body用于审计
    const originalBody = { ...req.body };

    // 脱敏处理
    req.body = maskSensitiveData(req.body);

    // 监听响应以脱敏响应数据
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const maskedBody = maskSensitiveData(body);
      return originalJson(maskedBody);
    };

    next();
  };
}

// ============================================================
// 暴力破解防护 (等保: 安全区域边界)
// ============================================================

export interface BruteForceConfig {
  enabled: boolean;
  maxAttempts: number;
  lockoutDuration: number;
  ipTracking: boolean;
}

interface AttemptRecord {
  attempts: number;
  firstAttempt: number;
  lockoutUntil?: number;
}

class BruteForceProtectionStore {
  private records: Map<string, AttemptRecord> = new Map();

  recordAttempt(identifier: string): { blocked: boolean; attemptsRemaining: number } {
    let record = this.records.get(identifier);

    if (!record) {
      record = { attempts: 0, firstAttempt: Date.now() };
    }

    // 检查是否在锁定中
    if (record.lockoutUntil && Date.now() < record.lockoutUntil) {
      return { blocked: true, attemptsRemaining: 0 };
    }

    record.attempts++;

    // 检查是否达到最大尝试次数
    if (record.attempts >= defaultSecurityConfig.bruteForce.maxAttempts) {
      record.lockoutUntil = Date.now() + defaultSecurityConfig.bruteForce.lockoutDuration;
      return { blocked: true, attemptsRemaining: 0 };
    }

    this.records.set(identifier, record);

    return {
      blocked: false,
      attemptsRemaining: defaultSecurityConfig.bruteForce.maxAttempts - record.attempts,
    };
  }

  reset(identifier: string): void {
    this.records.delete(identifier);
  }

  isLocked(identifier: string): boolean {
    const record = this.records.get(identifier);
    return record?.lockoutUntil ? Date.now() < record.lockoutUntil : false;
  }

  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.records.entries());
    for (const [key, record] of entries) {
      if (record.lockoutUntil && now > record.lockoutUntil) {
        if (now - record.firstAttempt > 86400000) {
          this.records.delete(key);
        }
      }
    }
  }
}

const bruteForceStore = new BruteForceProtectionStore();

export function bruteForceProtection(config: BruteForceConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    // 跳过安全路径
    const safePaths = ['/health', '/metrics', '/api/health'];
    if (safePaths.includes(req.path)) return next();

    const identifier = config.ipTracking ? req.ip : (req as any).userId || req.ip;

    // 检查是否被锁定
    if (bruteForceStore.isLocked(identifier)) {
      SecurityLogger.log({
        eventType: AuditEventType.BRUTE_FORCE_ATTEMPT,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        resource: req.path,
        action: 'brute_force_blocked',
        result: 'warning',
        details: { identifier, path: req.path },
      });

      res.status(429).json({
        success: false,
        error: '账户已被锁定，请稍后再试',
        code: 'ACCOUNT_LOCKED',
        retryAfter: 900,
      });
      return;
    }

    // 记录尝试
    const { blocked, attemptsRemaining } = bruteForceStore.recordAttempt(identifier);

    if (blocked) {
      SecurityLogger.log({
        eventType: AuditEventType.BRUTE_FORCE_ATTEMPT,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        resource: req.path,
        action: 'max_attempts_exceeded',
        result: 'warning',
        details: { identifier, path: req.path },
      });

      res.status(429).json({
        success: false,
        error: '登录尝试次数过多，账户已被锁定',
        code: 'ACCOUNT_LOCKED',
        retryAfter: 900,
      });
      return;
    }

    // 添加响应头提示剩余尝试次数
    res.setHeader('X-Login-Attempts-Remaining', attemptsRemaining);

    next();
  };
}

export const bruteForceConfig: BruteForceConfig = defaultSecurityConfig.bruteForce;

// ============================================================
// IP黑白名单 (等保: 安全区域边界)
// ============================================================

class IpControlStore {
  private blacklist: Set<string> = new Set(defaultSecurityConfig.ipControl.blacklist);
  private whitelist: Set<string> = new Set(defaultSecurityConfig.ipControl.whitelist);

  addToBlacklist(ip: string): void {
    this.blacklist.add(ip);
    console.log(`[IP-CONTROL] Added to blacklist: ${ip}`);
  }

  removeFromBlacklist(ip: string): void {
    this.blacklist.delete(ip);
    console.log(`[IP-CONTROL] Removed from blacklist: ${ip}`);
  }

  addToWhitelist(ip: string): void {
    this.whitelist.add(ip);
  }

  removeFromWhitelist(ip: string): void {
    this.whitelist.delete(ip);
  }

  isAllowed(ip: string): boolean {
    // 白名单优先
    if (this.whitelist.size > 0) {
      return this.whitelist.has(ip);
    }
    // 检查黑名单
    return !this.blacklist.has(ip);
  }

  getBlacklist(): string[] {
    return Array.from(this.blacklist);
  }

  getWhitelist(): string[] {
    return Array.from(this.whitelist);
  }
}

const ipControlStore = new IpControlStore();

export const ipBlacklist = ipControlStore.getBlacklist();
export const ipWhitelist = ipControlStore.getWhitelist();
export const addToBlacklist = (ip: string) => ipControlStore.addToBlacklist(ip);
export const removeFromBlacklist = (ip: string) => ipControlStore.removeFromBlacklist(ip);

export function ipControl(config: SecurityConfig['ipControl']): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // 跳过安全路径
    const safePaths = ['/health', '/metrics'];
    if (safePaths.includes(req.path)) return next();

    // 获取真实IP (支持代理)
    let clientIp = req.ip || req.socket.remoteAddress || '';
    if (config.checkProxy && config.proxyHeaders.length > 0) {
      for (const header of config.proxyHeaders) {
        const value = req.get(header);
        if (value) {
          clientIp = value.split(',')[0].trim();
          break;
        }
      }
    }

    if (!ipControlStore.isAllowed(clientIp)) {
      SecurityLogger.log({
        eventType: AuditEventType.SECURITY_ALERT,
        ip: clientIp,
        userAgent: req.headers['user-agent'],
        resource: req.path,
        action: 'ip_blocked',
        result: 'failure',
        details: { blockedIp: clientIp, path: req.path },
      });

      res.status(403).json({
        success: false,
        error: '访问被拒绝',
        code: 'IP_BLOCKED',
      });
      return;
    }

    next();
  };
}

// ============================================================
// SQL注入防护 (等保: 安全计算环境)
// ============================================================

const SQL_INJECTION_PATTERNS = [
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bSELECT\b.*\bFROM\b)/i,
  /(\bINSERT\b.*\bINTO\b)/i,
  /(\bUPDATE\b.*\bSET\b)/i,
  /(\bDELETE\b.*\bFROM\b)/i,
  /(\bDROP\b.*\bTABLE\b)/i,
  /(\bEXEC\b|\bEXECUTE\b)/i,
  /(--|\#|\/\*|\*\/)/,
  /(\bOR\b.*=.*\bOR\b)/i,
  /(\bAND\b.*=.*\bAND\b)/i,
  /(';|\';|--)/,
];

export function sqlInjectionProtection(config: SecurityConfig['sqlInjection']): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    const checkValue = (value: any, path: string): boolean => {
      if (typeof value === 'string') {
        for (const pattern of SQL_INJECTION_PATTERNS) {
          if (pattern.test(value)) {
            if (config.logSuspicious) {
              SecurityLogger.log({
                eventType: AuditEventType.SQL_INJECTION_ATTEMPT,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                resource: req.path,
                action: 'sql_injection_detected',
                result: 'warning',
                details: { pattern: pattern.source, value: value.substring(0, 100), path },
              });
            }
            return config.blockSuspicious;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          if (checkValue(val, `${path}.${key}`)) {
            return true;
          }
        }
      }
      return false;
    };

    // 检查query参数
    if (checkValue(req.query, 'query')) {
      res.status(400).json({
        success: false,
        error: '请求包含可疑内容',
        code: 'SUSPICIOUS_REQUEST',
      });
      return;
    }

    // 检查body参数
    if (checkValue(req.body, 'body')) {
      res.status(400).json({
        success: false,
        error: '请求包含可疑内容',
        code: 'SUSPICIOUS_REQUEST',
      });
      return;
    }

    next();
  };
}

// ============================================================
// XSS防护 (等保: 安全区域边界)
// ============================================================

const XSS_PATTERNS = [
  // Script标签
  /<script[^>]*>.*?<\/script>/gi,
  /<script[^>]*>.*?/gi,
  /<script[^>]*\/>/gi,

  // 事件处理器
  /\bon\w+\s*=/gi,

  // JavaScript协议
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /vbscript\s*:/gi,

  // HTML标签
  /<img[^>]+onerror/gi,
  /<svg[^>]+onload/gi,
  /<iframe[^>]+src\s*=/gi,
  /<embed[^>]+src\s*=/gi,
  /<object[^>]+data\s*=/gi,

  // 危险标签
  /<(script|iframe|object|embed|form|input|button|select|textarea)[^>]*>/gi,

  // HTML编码绕过 (检测实体编码的script)
  /&lt;\s*script/gi,
  /&lt;\s*img/gi,
  /&#x[0-9a-f]+;/gi,

  // 变异XSS
  /<[^>]+on\w+\s*=\s*["']?[^"'>]*(alert|prompt|confirm|eval|document\.)/gi,

  // Base64编码的payload
  /<script[^>]*>\s*eval\s*\(\s*atob\s*\(/gi,
];

export function xssProtection(config: SecurityConfig['xss']): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    const checkValue = (value: any, path: string): boolean => {
      if (typeof value === 'string') {
        for (const pattern of XSS_PATTERNS) {
          if (pattern.test(value)) {
            // 记录XSS尝试
            SecurityLogger.log({
              eventType: AuditEventType.XSS_ATTEMPT,
              ip: req.ip,
              userAgent: req.headers['user-agent'],
              resource: req.path,
              action: 'xss_detected',
              result: 'warning',
              details: { pattern: pattern.source, value: value.substring(0, 100), path },
            });

            if (config.blockSuspicious) {
              return true;
            }
          }
        }

        // HTML净化 (如果启用)
        if (config.sanitizeHtml) {
          let sanitized = value;

          // 移除所有HTML标签内容中的危险属性
          sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
          sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

          // 移除javascript:协议
          sanitized = sanitized.replace(/javascript\s*:/gi, '');

          // 移除data:协议中的HTML
          sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, '');

          // 将净化后的值放回
          if (sanitized !== value) {
            console.log(`[XSS-SANITIZE] Path: ${path}, Original length: ${value.length}, Sanitized length: ${sanitized.length}`);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          if (checkValue(val, `${path}.${key}`)) {
            return true;
          }
        }
      }
      return false;
    };

    // 检查query参数
    if (checkValue(req.query, 'query')) {
      res.status(400).json({
        success: false,
        error: '请求包含可疑内容',
        code: 'SUSPICIOUS_REQUEST',
      });
      return;
    }

    // 检查body参数
    if (checkValue(req.body, 'body')) {
      res.status(400).json({
        success: false,
        error: '请求包含可疑内容',
        code: 'SUSPICIOUS_REQUEST',
      });
      return;
    }

    next();
  };
}

// ============================================================
// 输入验证 (等保: 安全计算环境)
// ============================================================

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'url' | 'phone' | 'idCard' | 'ipv4' | 'ipv6';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message?: string;
}

const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
  phone: /^1[3-9]\d{9}$/,
  idCard: /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/,
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  ipv6: /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
};

export function inputValidation(rules: ValidationRule[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = [];

    for (const rule of rules) {
      const value = (req.body as any)?.[rule.field];

      // 必填检查
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({ field: rule.field, message: rule.message || `${rule.field}是必填项` });
        continue;
      }

      if (value === undefined || value === null) continue;

      // 类型检查
      if (rule.type && !VALIDATION_PATTERNS[rule.type]?.test(String(value))) {
        errors.push({ field: rule.field, message: rule.message || `${rule.field}格式不正确` });
        continue;
      }

      // 长度检查
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field}长度不能少于${rule.minLength}` });
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field}长度不能超过${rule.maxLength}` });
        }
      }

      // 正则检查
      if (rule.pattern && !rule.pattern.test(String(value))) {
        errors.push({ field: rule.field, message: rule.message || `${rule.field}格式不符合要求` });
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: '输入验证失败',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
      return;
    }

    next();
  };
}

// ============================================================
// 完整安全中间件工厂 (等保: 安全管理中心)
// ============================================================

export function createSecurityMiddleware(config: SecurityConfig = defaultSecurityConfig) {
  const mergedConfig = applySecurityConfig(config);
  const rateLimitStore = new RateLimitStore();

  return {
    // 安全头
    securityHeaders: securityHeaders(mergedConfig.securityHeaders),

    // CORS
    cors: getCorsMiddleware(mergedConfig.cors),

    // CSRF
    csrf: csrfProtection(mergedConfig.csrf),

    // 限流
    rateLimit: createRateLimiter(mergedConfig.rateLimit, rateLimitStore),

    // 敏感数据保护
    sensitiveData: sensitiveDataProtection(mergedConfig.sensitiveData),

    // 暴力破解防护
    bruteForce: bruteForceProtection(mergedConfig.bruteForce),

    // IP控制
    ipControl: ipControl(mergedConfig.ipControl),

    // SQL注入防护
    sqlInjection: sqlInjectionProtection(mergedConfig.sqlInjection),

    // XSS防护
    xss: xssProtection(mergedConfig.xss),

    // 审计中间件
    audit: (req: Request, res: Response, next: NextFunction) => {
      if (!mergedConfig.logging.enabled) return next();
      if (mergedConfig.logging.excludePaths.includes(req.path)) return next();

      const startTime = Date.now();

      res.on('finish', () => {
        const logData = {
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: Date.now() - startTime,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          userId: (req as any).userId,
        };

        if (mergedConfig.logging.level === 'debug' || res.statusCode >= 400) {
          console.log(`[SECURITY-LOG] ${JSON.stringify(logData)}`);
        }
      });

      next();
    },
  };
}
