# 优化项 34: 预加载优化 - preload/prefetch

## 概述

**优化项编号**: 34
**优化类型**: 性能优化 - 资源加载优化
**影响范围**: 页面加载性能、资源可用性
**实现日期**: 2026-07-06
**依赖项**: 优化项 35 (DNS预解析)

## 问题分析

### 当前问题

1. **关键资源延迟加载**: CSS、JS、字体等关键资源在需要时才加载，导致渲染延迟
2. **后续页面资源未预取**: 用户导航到新页面时，资源仍需重新加载
3. **跨域资源连接延迟**: 外部API/CDN资源连接建立耗时
4. **动态资源缺少预加载策略**: 基于路由/用户行为的智能预加载缺失

### 性能影响

| 问题 | 影响 | 典型延迟 |
|------|------|----------|
| CSS未预加载 | 白屏/无样式闪烁 (FOUC) | 100-500ms |
| 字体未预加载 | 文字重排/字体闪烁 | 200-800ms |
| JS未预加载 | 交互延迟/懒加载等待 | 150-600ms |
| 后续页面未预取 | 页面切换慢 | 300-1000ms |

## 技术方案

### 1. 预加载 (`preload`) - 预获取当前页面关键资源

用于预加载当前页面立即需要的资源：

```html
<!-- 预加载关键CSS -->
<link rel="preload" href="/styles/main.css" as="style">

<!-- 预加载关键字体 -->
<link rel="preload" href="/fonts/custom.woff2" as="font" crossorigin>

<!-- 预加载关键JS -->
<link rel="preload" href="/js/app.bundle.js" as="script">

<!-- 预加载图片 -->
<link rel="preload" href="/images/hero.webp" as="image">
```

### 2. 预取 (`prefetch`) - 预获取后续页面资源

用于预取用户可能访问的下一页资源：

```html
<!-- 预取下一个页面 -->
<link rel="prefetch" href="/dashboard">

<!-- 预取关键API数据 -->
<link rel="prefetch" href="/api/user/profile">

<!-- 预取可能的图片 -->
<link rel="prefetch" href="/images/dashboard-bg.webp">
```

### 3. 预连接 (`preconnect`) - 预建立连接

已在优化项35中实现，此处补充详细配置：

```html
<link rel="preconnect" href="https://api.openai.com" crossorigin>
<link rel="preconnect" href="https://api.cohere.ai" crossorigin>
```

### 4. 动态预加载策略

基于路由和用户行为的智能预加载：

```typescript
// 基于路由的预加载
const routePrefetchMap = {
  '/': ['/dashboard', '/js/dashboard.js'],
  '/servers': ['/servers/:id', '/js/server-detail.js'],
  '/dashboard': ['/api/stats', '/images/chart-lib.js'],
};

// 基于交互的预加载
const prefetchOnHover = (url: string) => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
};
```

## 项目实现

### 1. 服务端中间件增强

在 `security-center.ts` 中已有基础实现，增强后：

```typescript
// server/middleware/security/security-center.ts

// 预加载资源类型定义
export interface PreloadResource {
  url: string;                    // 资源URL
  as: 'script' | 'style' | 'font' | 'image' | 'fetch' | 'worker' | 'object';
  crossOrigin?: 'anonymous' | 'use-credentials';
  type?: 'audio' | 'video' | 'track';
  media?: string;                 // 媒体查询
}

// 预取资源类型定义
export interface PrefetchResource {
  url: string;
  as: 'document' | 'script' | 'style' | 'font' | 'image' | 'raw';
  crossOrigin?: 'anonymous' | 'use-credentials';
  policy?: 'auto' | 'render' | 'no-render';
}

// 增强配置
export interface ResourceHintConfig {
  enabled: boolean;
  // preconnect (已在优化项35实现)
  domains: string[];
  preconnect: boolean;
  // preload - 当前页面关键资源
  preload: boolean;
  preloadResources: PreloadResource[];
  preloadCriticalCss?: boolean;
  preloadFonts?: string[];
  // prefetch - 后续页面资源
  prefetch: boolean;
  prefetchResources: PrefetchResource[];
  // 动态预加载策略
  dynamicPrefetch: boolean;
  prefetchRoutes: string[];
  // 预加载优先级
  highPriorityUrls: string[];
}
```

### 2. 服务端预加载策略

```typescript
// server/middleware/security/resource-hints.ts

import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface ResourceHintOptions {
  // 预连接域名 (已在优化项35实现)
  preconnectDomains?: string[];
  // 预加载资源
  preloadResources?: Array<{
    url: string;
    as: string;
    crossorigin?: boolean;
    type?: string;
  }>;
  // 预取资源
  prefetchResources?: Array<{
    url: string;
    as: string;
    crossorigin?: boolean;
  }>;
  // 关键CSS内联
  criticalCss?: string;
  // 关键字体预加载
  criticalFonts?: string[];
}

// 生成Link头部
function buildResourceHints(options: ResourceHintOptions): string[] {
  const hints: string[] = [];

  // 1. Preconnect
  if (options.preconnectDomains?.length) {
    options.preconnectDomains.forEach(domain => {
      const protocol = domain.startsWith('https') ? 'https' : 'http';
      hints.push(`<${protocol}://${domain}>; rel=preconnect; crossorigin`);
    });
  }

  // 2. Preload
  if (options.preloadResources?.length) {
    options.preloadResources.forEach(resource => {
      const attrs = [`<${resource.url}>`, `rel=preload`, `as=${resource.as}`];
      if (resource.crossorigin) attrs.push('crossorigin');
      if (resource.type) attrs.push(`type=${resource.type}`);
      hints.push(attrs.join('; '));
    });
  }

  // 3. Prefetch
  if (options.prefetchResources?.length) {
    options.prefetchResources.forEach(resource => {
      const attrs = [`<${resource.url}>`, `rel=prefetch`, `as=${resource.as}`];
      if (resource.crossorigin) attrs.push('crossorigin');
      hints.push(attrs.join('; '));
    });
  }

  return hints;
}

// 预加载中间件
export function resourceHintMiddleware(options: ResourceHintOptions): RequestHandler {
  const hints = buildResourceHints(options);
  const linkHeader = hints.length > 0 ? hints.join(', ') : null;

  return (req: Request, res: Response, next: NextFunction) => {
    // 仅对HTML响应添加预加载头部
    const contentType = res.get('Content-Type') || '';
    if (contentType.includes('text/html') && linkHeader) {
      res.set('Link', linkHeader);
    }
    next();
  };
}
```

### 3. 关键资源自动检测

```typescript
// server/middleware/security/critical-resources.ts

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

// 关键资源模式
const CRITICAL_PATTERNS = [
  /\/styles\/main.*\.css$/i,
  /\/css\/critical.*\.css$/i,
  /\/js\/app.*\.bundle\.js$/i,
  /\/fonts\/[a-z-]+\.(woff2?|ttf|otf)$/i,
  /\/images\/hero.*\.(webp|png|jpg)$/i,
  /\/assets\/logo.*\.(svg|png|webp)$/i,
];

// 静态资源文件映射
const MANIFEST_FILE = 'asset-manifest.json';

interface AssetManifest {
  files: Record<string, string>;
  entrypoints: string[];
}

// 解析构建产物清单
function loadAssetManifest(): AssetManifest | null {
  try {
    const manifestPath = path.join(process.cwd(), 'dist', MANIFEST_FILE);
    if (fs.existsSync(manifestPath)) {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }
  } catch (e) {
    console.warn('Failed to load asset manifest:', e);
  }
  return null;
}

// 检测关键资源
export function detectCriticalResources(req: Request): string[] {
  const critical: string[] = [];
  const manifest = loadAssetManifest();

  if (!manifest) return critical;

  // 从入口点获取关键JS
  manifest.entrypoints?.forEach(entry => {
    if (entry.endsWith('.js')) {
      critical.push(`/<asset:${path.basename(entry)}>`);
    }
    if (entry.endsWith('.css')) {
      critical.push(`/<asset:${path.basename(entry)}>`);
    }
  });

  return critical;
}

// 生成关键资源预加载头部
export function generateCriticalHints(req: Request): string[] {
  const hints: string[] = [];

  // 关键字体
  const fonts = ['custom.woff2', 'icon.woff2'];
  fonts.forEach(font => {
    hints.push(`</fonts/${font}>; rel=preload; as=font; crossorigin`);
  });

  // 关键CSS
  hints.push(`</styles/main.css>; rel=preload; as=style`);

  // 关键JS (如果有manifest)
  const critical = detectCriticalResources(req);
  critical.forEach(resource => {
    const url = resource.replace('/<asset:', '/').replace('>', '');
    hints.push(`<${url}>; rel=preload; as=script`);
  });

  return hints;
}
```

### 4. 客户端预加载管理器

```typescript
// src/utils/resource-preloader.ts

interface PrefetchOptions {
  el?: HTMLElement;           // 触发预取的元素
  url: string;               // 预取URL
  as?: 'script' | 'style' | 'image' | 'document' | 'fetch';
  crossOrigin?: boolean;
  policy?: 'auto' | 'high' | 'low';
}

/**
 * 资源预加载工具类
 */
export class ResourcePreloader {
  private prefetchedUrls = new Set<string>();

  /**
   * 预取资源
   */
  prefetch(options: PrefetchOptions): void {
    const { url, as = 'fetch' } = options;

    // 避免重复预取
    if (this.prefetchedUrls.has(url)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = as;

    if (options.crossOrigin) {
      link.crossOrigin = 'anonymous';
    }

    document.head.appendChild(link);
    this.prefetchedUrls.add(url);

    // 预取完成后自动清理
    link.onload = link.onerror = () => {
      link.remove();
    };
  }

  /**
   * 预加载资源
   */
  preload(url: string, as: string = 'fetch', crossOrigin?: boolean): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;

    if (crossOrigin) {
      link.crossOrigin = 'anonymous';
    }

    document.head.appendChild(link);
  }

  /**
   * 预连接域名
   */
  preconnect(url: string): void {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  /**
   * 鼠标悬停时预取
   */
  prefetchOnHover(url: string, as: string = 'document'): void {
    const handler = () => {
      this.prefetch({ url, as });
    };

    document.addEventListener('mouseenter', handler, { once: true, passive: true });
  }

  /**
   * 链接悬停预取 (智能预取)
   */
  initLinkPrefetch(): void {
    document.addEventListener('mouseenter', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.startsWith('javascript:')) {
        // 只预取同域名的导航链接
        try {
          const url = new URL(link.href);
          if (url.origin === window.location.origin) {
            this.prefetch({ url: link.href, as: 'document' });
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }, { once: true, passive: true });
  }

  /**
   * 基于路由的预加载
   */
  prefetchRoutes(routes: string[]): void {
    // 使用 Intersection Observer 检测可见性
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const route = (entry.target as HTMLElement).dataset.route;
          if (route) {
            this.prefetch({ url: route, as: 'document' });
            observer.unobserve(entry.target);
          }
        }
      });
    });

    // 观察预取占位元素
    document.querySelectorAll('[data-prefetch-route]').forEach(el => {
      observer.observe(el);
    });
  }
}

// 单例
export const preloader = new ResourcePreloader();
```

### 5. React预加载Hook

```typescript
// src/hooks/useResourceHint.ts

import { useEffect } from 'react';
import { preloader } from '@/utils/resource-preloader';

interface UsePreloadOptions {
  url: string;
  as?: 'script' | 'style' | 'font' | 'image' | 'fetch';
  crossOrigin?: boolean;
  immediate?: boolean;
}

interface UsePrefetchOptions {
  urls?: string[];
  prefetchOnHover?: boolean;
  prefetchOnVisible?: boolean;
}

/**
 * 预加载资源Hook
 */
export function usePreload(options: UsePreloadOptions) {
  const { url, as = 'fetch', crossOrigin, immediate = false } = options;

  useEffect(() => {
    if (immediate) {
      preloader.preload(url, as, crossOrigin);
    }
  }, [url, as, crossOrigin, immediate]);
}

/**
 * 预取资源Hook
 */
export function usePrefetch(options: UsePrefetchOptions = {}) {
  const { urls = [], prefetchOnHover = true } = options;

  useEffect(() => {
    // 初始化链接悬停预取
    if (prefetchOnHover) {
      preloader.initLinkPrefetch();
    }

    // 预取指定URL
    urls.forEach(url => {
      preloader.prefetch({ url, as: 'document' });
    });
  }, [urls.join(','), prefetchOnHover]);
}

/**
 * 预连接Hook
 */
export function usePreconnect(urls: string[]) {
  useEffect(() => {
    urls.forEach(url => {
      preloader.preconnect(url);
    });
  }, [urls.join(',')]);
}
```

### 6. 组件中使用示例

```tsx
// src/components/Dashboard.tsx

import { usePreload, usePrefetch, usePreconnect } from '@/hooks/useResourceHint';

export function Dashboard() {
  // 预连接外部API
  usePreconnect([
    'https://api.openai.com',
    'https://api.cohere.ai',
  ]);

  // 预加载关键资源
  usePreload({
    url: '/js/charts.bundle.js',
    as: 'script',
    immediate: true,
  });

  // 预取后续页面
  usePrefetch({
    urls: [
      '/api/user/stats',
      '/api/server/list',
    ],
    prefetchOnHover: true,
  });

  return <div>Dashboard Content</div>;
}

// src/components/ServerCard.tsx

import { preloader } from '@/utils/resource-preloader';

export function ServerCard({ server }: { server: Server }) {
  const handleMouseEnter = () => {
    // 悬停时预取详情页
    preloader.prefetch({
      url: `/servers/${server.id}`,
      as: 'document',
    });
  };

  return (
    <div onMouseEnter={handleMouseEnter}>
      <h3>{server.name}</h3>
      <Link href={`/servers/${server.id}`}>View Details</Link>
    </div>
  );
}
```

### 7. 路由级预加载

```typescript
// src/App.tsx

import { Routes, Route } from 'react-router-dom';
import { usePrefetch } from '@/hooks/useResourceHint';

// 预加载组件
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const ServerList = React.lazy(() => import('@/pages/ServerList'));
const ServerDetail = React.lazy(() => import('@/pages/ServerDetail'));

// 预取路由数据
const routeDataPrefetch: Record<string, string[]> = {
  '/': ['/api/user/profile', '/api/dashboard/stats'],
  '/servers': ['/api/servers', '/api/server/categories'],
  '/servers/:id': ['/api/servers/:id', '/api/servers/:id/stats'],
};

export function AppRouter() {
  // 初始化路由级预取
  usePrefetch({
    urls: Object.values(routeDataPrefetch).flat(),
    prefetchOnVisible: true,
  });

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/servers" element={<ServerList />} />
      <Route path="/servers/:id" element={<ServerDetail />} />
    </Routes>
  );
}
```

### 8. 字体预加载组件

```tsx
// src/components/FontPreloader.tsx

import { useEffect } from 'react';
import { preloader } from '@/utils/resource-preloader';

interface FontConfig {
  family: string;
  url: string;
  weight?: string;
  style?: string;
}

const CRITICAL_FONTS: FontConfig[] = [
  {
    family: 'CustomFont',
    url: '/fonts/custom.woff2',
    weight: '400',
  },
  {
    family: 'CustomFont',
    url: '/fonts/custom-bold.woff2',
    weight: '700',
  },
];

export function FontPreloader() {
  useEffect(() => {
    CRITICAL_FONTS.forEach(font => {
      // 预加载字体
      preloader.preload(font.url, 'font', true);

      // 预连接字体服务器
      try {
        const url = new URL(font.url);
        preloader.preconnect(`${url.protocol}//${url.host}`);
      } catch (e) {
        // 相对路径，跳过预连接
      }
    });
  }, []);

  return null;
}

// App.tsx 中使用
export function App() {
  return (
    <>
      <FontPreloader />
      {/* 其他内容 */}
    </>
  );
}
```

## 配置管理

### 环境变量配置

```bash
# .env

# 预加载功能开关
ENABLE_RESOURCE_HINTS=true

# 预连接域名 (逗号分隔)
PRECONNECT_DOMAINS=api.openai.com,api.cohere.ai,fonts.googleapis.com

# 预加载关键资源
PRELOAD_CRITICAL_CSS=true
PRELOAD_CRITICAL_FONTS=true

# 预取配置
ENABLE_PREFETCH=true
PREFETCH_ROUTES=/dashboard,/servers,/servers/:id
```

### 服务端配置

```typescript
// server/config/resource-hints.ts

export const resourceHintConfig = {
  enabled: process.env.ENABLE_RESOURCE_HINTS === 'true',
  preconnect: {
    enabled: true,
    domains: process.env.PRECONNECT_DOMAINS?.split(',') || [
      'api.openai.com',
      'api.cohere.ai',
      'fonts.googleapis.com',
    ],
  },
  preload: {
    enabled: true,
    criticalCss: process.env.PRELOAD_CRITICAL_CSS === 'true',
    criticalFonts: process.env.PRELOAD_CRITICAL_FONTS === 'true',
    resources: [
      // 基于构建产物的动态资源
    ],
  },
  prefetch: {
    enabled: process.env.ENABLE_PREFETCH === 'true',
    routes: process.env.PREFETCH_ROUTES?.split(',') || [
      '/dashboard',
      '/servers',
    ],
    dynamic: true,
  },
};
```

## 性能测试

### 测试命令

```bash
# 检查响应头
curl -I https://your-domain.com | grep -E "(Link|X-DNS-Prefetch)"

# 预期输出示例
Link: <https://api.openai.com>; rel=preconnect; crossorigin
Link: <https://fonts.gstatic.com>; rel=preconnect; crossorigin
Link: </fonts/custom.woff2>; rel=preload; as=font; crossorigin
Link: </styles/main.css>; rel=preload; as=style

# Lighthouse测试
npx lighthouse https://your-domain.com --only-categories=performance

# 检查关键指标
# - First Contentful Paint (FCP) 应减少
# - Largest Contentful Paint (LCP) 应减少
# - Time to Interactive (TTI) 应改善
```

### 浏览器开发者工具

1. **Network面板**: 检查资源加载时机
   - `preload` 资源应在页面加载早期发起
   - `prefetch` 资源应在空闲时发起

2. **Performance面板**: 录制加载过程
   - 检查是否有 FOUC (无样式内容闪烁)
   - 检查字体加载是否导致重排

3. **Application面板 > Preload**:
   - 检查预加载资源的命中情况

## 最佳实践

### DO

1. **预加载关键CSS**: 首屏渲染必需的CSS应立即预加载
2. **预加载关键字体**: 首次渲染需要的字体应预加载
3. **预连接外部域名**: 已知会使用的外部API应预连接
4. **合理使用prefetch**: 预取用户可能访问的后续页面
5. **避免过度预加载**: 仅预加载确定需要的资源

### DON'T

1. **不要预加载所有资源**: 会浪费带宽，增加服务器负载
2. **不要prefetch非关键API**: 可能获取过时数据
3. **不要混合preload和prefetch**: 优先级混淆
4. **不要忘记CORS**: 跨域资源需要正确设置crossorigin
5. **不要在低带宽环境强制预加载**: 用户体验优先

## 安全注意事项

### CSP配置

确保Content-Security-Policy允许预加载：

```typescript
// server/middleware/security/security-center.ts

contentSecurityPolicy: {
  'default-src': "'self'",
  'script-src': "'self' 'unsafe-inline' 'unsafe-eval'",
  'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src': "'self' https://fonts.gstatic.com",
  'connect-src': "'self' https://api.openai.com https://api.cohere.ai",
  'img-src': "'self' data: https:",
  'prefetch-src': "'self'",  // 限制预取来源
}
```

### 隐私考量

1. **不预取敏感数据**: 避免预取需要认证的API
2. **审计日志**: 记录预加载的外部域名
3. **用户控制**: 提供选项让用户禁用预加载

## 维护建议

### 定期审查

1. **资源清单**: 维护关键资源列表
2. **性能监控**: 监控LCP/FCP变化
3. **带宽影响**: 监控预加载带宽使用

### 资源分组管理

```typescript
// server/config/resource-groups.ts

export const RESOURCE_GROUPS = {
  // 首屏必需
  critical: [
    { url: '/styles/main.css', as: 'style' },
    { url: '/fonts/custom.woff2', as: 'font', crossOrigin: true },
  ],

  // 外部服务
  external: [
    { domain: 'api.openai.com', type: 'preconnect' },
    { domain: 'fonts.googleapis.com', type: 'preconnect' },
  ],

  // 路由级预取
  routes: {
    '/': ['/dashboard'],
    '/servers': ['/servers/:id'],
  },

  // 用户行为触发
  interaction: ['/api/user/profile'],
};
```

## 相关优化项

- **优化项 35**: DNS预解析 - 域名预解析基础
- **优化项 41**: API响应压缩 - 减少传输数据量
- **优化项 42**: 请求超时统一 - 避免请求阻塞

## 参考资料

- [MDN: Preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload)
- [MDN: Prefetch](https://developer.mozilla.org/en-US/docs/Web/HTTP/Link_prefetching_FAQ)
- [MDN: Preconnect](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preconnect)
- [web.dev: Preload critical assets](https://web.dev/preload-critical-assets/)
- [Google: Preconnect and prefetch](https://developers.google.com/web/fundamentals/performance/resource-utilization)
- [CSS-Tricks: Everything You Need to Know About Preload](https://css-tricks.com/prefetching-preloading-browsing/)
