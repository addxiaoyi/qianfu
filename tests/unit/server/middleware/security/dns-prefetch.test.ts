/**
 * DNS预解析中间件单元测试
 * 优化项 35: DNS预解析 - 域名解析
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  dnsPrefetchMiddleware,
  dnsPrefetchMiddlewareSimple,
  dnsPrefetchMiddlewareOptimized,
  clearDnsHeaderCache,
  getDnsHeaderCacheSize,
  defaultSecurityConfig,
} from '../../../../../server/middleware/security/security-center';

// Mock Response
class MockResponse {
  headers: Map<string, string | string[]> = new Map();
  _status = 200;

  setHeader(name: string, value: string | string[] | undefined): this {
    if (value !== undefined) {
      this.headers.set(name.toLowerCase(), value);
    }
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  status(code: number): this {
    this._status = code;
    return this;
  }
}

describe('DNS预解析中间件', () => {
  beforeEach(() => {
    clearDnsHeaderCache();
  });

  // 完整配置示例
  const fullConfig = {
    enabled: true,
    domains: ['api.openai.com'],
    preconnect: true,
    preload: false,
    preloadResources: [],
    prefetch: false,
    prefetchResources: [],
    dynamicPrefetch: false,
  };

  describe('dnsPrefetchMiddleware (智能版)', () => {
    it('应该禁用时跳过', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddleware({
        ...fullConfig,
        enabled: false,
      });

      middleware(req, res, next);

      expect(res.headers.size).toBe(0);
    });

    it('应该为HTML响应添加dns-prefetch头部', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddleware({
        ...fullConfig,
        preconnect: false,
      });

      middleware(req, res, next);

      // 触发Content-Type头设置
      res.setHeader('Content-Type', 'text/html');

      expect(res.getHeader('x-dns-prefetch-control')).toBe('on');
    });

    it('应该为HTML响应添加preconnect头部', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddleware({
        ...fullConfig,
        domains: ['api.openai.com', 'api.cohere.ai'],
      });

      middleware(req, res, next);

      // 触发Content-Type头设置
      res.setHeader('Content-Type', 'text/html');

      const linkHeader = res.getHeader('link') as string;
      expect(linkHeader).toContain('rel=preconnect');
      expect(linkHeader).toContain('api.openai.com');
    });

    it('应该支持预加载资源', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddleware({
        enabled: true,
        domains: [],
        preconnect: false,
        preload: true,
        preloadResources: [
          {
            url: 'https://cdn.example.com/app.js',
            as: 'script' as const,
          },
          {
            url: 'https://cdn.example.com/font.woff2',
            as: 'font' as const,
            crossOrigin: 'anonymous' as const,
          },
        ],
        prefetch: false,
        prefetchResources: [],
        dynamicPrefetch: false,
      });

      middleware(req, res, next);

      // 触发Content-Type头设置
      res.setHeader('Content-Type', 'text/html');

      const linkHeader = res.getHeader('link') as string;
      expect(linkHeader).toContain('rel=preload');
      expect(linkHeader).toContain('as=script');
      expect(linkHeader).toContain('as=font');
    });

    it('应该为非HTML响应跳过', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddleware(fullConfig);

      middleware(req, res, next);

      // 触发Content-Type头为JSON
      res.setHeader('Content-Type', 'application/json');

      // Link头不应包含dns-prefetch
      const linkHeader = res.getHeader('link') as string | undefined;
      expect(linkHeader).toBeUndefined();
    });
  });

  describe('dnsPrefetchMiddlewareSimple (简单版)', () => {
    it('应该始终设置X-DNS-Prefetch-Control头', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddlewareSimple(fullConfig);

      middleware(req, res, next);

      expect(res.getHeader('x-dns-prefetch-control')).toBe('on');
    });
  });

  describe('dnsPrefetchMiddlewareOptimized (优化版)', () => {
    it('应该预计算并设置所有头部', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddlewareOptimized(fullConfig);

      middleware(req, res, next);

      expect(res.getHeader('x-dns-prefetch-control')).toBe('on');
      expect(res.getHeader('link')).toContain('api.openai.com');
    });

    it('应该使用缓存避免重复计算', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware1 = dnsPrefetchMiddlewareOptimized(fullConfig);
      const middleware2 = dnsPrefetchMiddlewareOptimized(fullConfig);

      middleware1(req, res, next);

      // 缓存应该已创建
      expect(getDnsHeaderCacheSize()).toBe(1);

      // 第二次调用应该命中缓存
      const res2 = new MockResponse();
      middleware2(req, res2, next);

      expect(res2.getHeader('link')).toBe(res.getHeader('link'));
    });

    it('禁用时应该跳过', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddlewareOptimized({
        ...fullConfig,
        enabled: false,
      });

      middleware(req, res, next);

      expect(res.headers.size).toBe(0);
    });
  });

  describe('缓存管理', () => {
    it('应该正确清除缓存', () => {
      const req = {} as any;
      const res = new MockResponse();
      const next = () => {};

      const middleware = dnsPrefetchMiddlewareOptimized(fullConfig);

      middleware(req, res, next);

      expect(getDnsHeaderCacheSize()).toBe(1);

      clearDnsHeaderCache();

      expect(getDnsHeaderCacheSize()).toBe(0);
    });
  });

  describe('默认配置', () => {
    it('应该包含默认DNS域名', () => {
      expect(defaultSecurityConfig.dnsPrefetch.enabled).toBe(true);
      expect(defaultSecurityConfig.dnsPrefetch.domains).toContain('api.openai.com');
      expect(defaultSecurityConfig.dnsPrefetch.domains).toContain('api.cohere.ai');
    });

    it('应该默认启用preconnect', () => {
      expect(defaultSecurityConfig.dnsPrefetch.preconnect).toBe(true);
    });
  });
});
