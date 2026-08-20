/**
 * 资源预加载工具类
 * 优化项 34: 预加载优化 - preload/prefetch
 */

interface PrefetchOptions {
  url: string;
  as?: 'script' | 'style' | 'image' | 'document' | 'fetch' | 'font';
  crossOrigin?: boolean;
  policy?: 'auto' | 'render' | 'low';
}

interface PreloadOptions {
  url: string;
  as?: 'script' | 'style' | 'font' | 'image' | 'fetch';
  crossOrigin?: boolean;
  type?: string;
  media?: string;
}

interface PreconnectOptions {
  url: string;
  crossOrigin?: boolean;
}

/**
 * 资源预加载管理器
 * 统一管理 preload, prefetch, preconnect
 */
export class ResourcePreloader {
  private prefetchedUrls = new Set<string>();
  private preloadedUrls = new Set<string>();
  private preconnectedDomains = new Set<string>();

  /**
   * 预取资源 (在空闲时下载，用于后续页面)
   * 适用于:
   * - 用户可能访问的下一个页面
   * - 不紧急但会用到的大文件
   * - 预测性资源加载
   */
  prefetch(options: PrefetchOptions): void {
    const { url, as = 'document' } = options;

    // 避免重复预取
    if (this.prefetchedUrls.has(url)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = as;

    if (options.crossOrigin) {
      link.crossOrigin = 'anonymous';
    }

    if (options.policy) {
      link.setAttribute('fetchpriority', options.policy === 'low' ? 'low' : 'auto');
    }

    document.head.appendChild(link);
    this.prefetchedUrls.add(url);

    // 预取完成后自动清理
    link.onload = link.onerror = () => {
      link.remove();
    };

    console.debug(`[ResourcePreloader] Prefetch: ${url}`);
  }

  /**
   * 预加载资源 (立即下载，用于当前页面)
   * 适用于:
   * - 首屏渲染必需的CSS
   * - 关键字体文件
   * - 首屏图片
   */
  preload(options: PreloadOptions): void {
    const { url, as = 'fetch' } = options;

    // 避免重复预加载
    if (this.preloadedUrls.has(url)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;

    if (options.crossOrigin) {
      link.crossOrigin = 'anonymous';
    }

    if (options.type) {
      link.setAttribute('as', as);
    }

    if (options.media) {
      link.media = options.media;
    }

    document.head.appendChild(link);
    this.preloadedUrls.add(url);

    console.debug(`[ResourcePreloader] Preload: ${url}`);
  }

  /**
   * 预连接 (提前建立TCP/TLS连接)
   * 适用于:
   * - 外部API域名
   * - CDN域名
   * - 字体服务器
   */
  preconnect(options: PreconnectOptions): void {
    const { url, crossOrigin = true } = options;

    // 提取域名
    let domain: string;
    try {
      const urlObj = new URL(url);
      domain = `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      domain = url.startsWith('//') ? `https:${url}` : url;
    }

    // 避免重复预连接
    if (this.preconnectedDomains.has(domain)) return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = crossOrigin ? 'anonymous' : '';

    document.head.appendChild(link);
    this.preconnectedDomains.add(domain);

    console.debug(`[ResourcePreloader] Preconnect: ${domain}`);
  }

  /**
   * 预加载字体
   */
  preloadFont(fontUrl: string, fontFormat?: string): void {
    this.preload({ url: fontUrl, as: 'font', crossOrigin: true });

    if (fontFormat) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = fontUrl;
      link.as = 'font';
      link.crossOrigin = 'anonymous';
      link.setAttribute('type', fontFormat);
      document.head.appendChild(link);
    }
  }

  /**
   * 预加载CSS
   */
  preloadStyle(cssUrl: string): void {
    this.preload({ url: cssUrl, as: 'style' });
  }

  /**
   * 预加载图片
   */
  preloadImage(imageUrl: string): void {
    this.preload({ url: imageUrl, as: 'image' });
  }

  /**
   * 预加载脚本
   */
  preloadScript(scriptUrl: string): void {
    this.preload({ url: scriptUrl, as: 'script' });
  }

  /**
   * 鼠标悬停时预取 (智能链接预取)
   * 在用户鼠标悬停在链接上时触发预取
   */
  initLinkPrefetch(): void {
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link && link.href && !link.href.startsWith('javascript:')) {
        try {
          const url = new URL(link.href);
          // 只预取同域名的导航链接
          if (url.origin === window.location.origin) {
            this.prefetch({ url: link.href, as: 'document' });
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }, { once: false, passive: true });
  }

  /**
   * 视口内可见时预取 (智能可见性预取)
   * 使用 Intersection Observer 检测元素可见性
   */
  initVisiblePrefetch(): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const url = element.dataset.prefetch;
          const as = element.dataset.prefetchAs as PrefetchOptions['as'] || 'document';

          if (url) {
            this.prefetch({ url, as });
            observer.unobserve(element);
          }
        }
      });
    }, {
      rootMargin: '100px', // 提前100px开始预取
      threshold: 0,
    });

    // 观察所有带有 data-prefetch 属性的元素
    document.querySelectorAll('[data-prefetch]').forEach(el => {
      observer.observe(el);
    });
  }

  /**
   * 批量预取资源
   */
  batchPrefetch(urls: string[], as: PrefetchOptions['as'] = 'document'): void {
    urls.forEach(url => {
      this.prefetch({ url, as });
    });
  }

  /**
   * 批量预加载资源
   */
  batchPreload(urls: string[], as: PreloadOptions['as']): void {
    urls.forEach(url => {
      this.preload({ url, as });
    });
  }

  /**
   * 根据路径自动判断资源类型
   */
  getResourceType(url: string): PrefetchOptions['as'] {
    if (url.endsWith('.js') || url.endsWith('.mjs')) return 'script';
    if (url.endsWith('.css')) return 'style';
    if (/\.(woff2?|ttf|otf|eot)$/i.test(url)) return 'font';
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico|avif)$/i.test(url)) return 'image';
    if (url.startsWith('/api/')) return 'fetch';
    return 'document';
  }

  /**
   * 清除缓存状态
   */
  reset(): void {
    this.prefetchedUrls.clear();
    this.preloadedUrls.clear();
    this.preconnectedDomains.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    prefetched: number;
    preloaded: number;
    preconnected: number;
  } {
    return {
      prefetched: this.prefetchedUrls.size,
      preloaded: this.preloadedUrls.size,
      preconnected: this.preconnectedDomains.size,
    };
  }
}

// 单例
export const preloader = new ResourcePreloader();

// React Hooks
import { useEffect, useCallback } from 'react';

/**
 * 预连接Hook
 * 用于提前建立与外部服务的连接
 */
export function usePreconnect(urls: string[]): void {
  useEffect(() => {
    urls.forEach(url => {
      preloader.preconnect({ url });
    });
  }, [urls.join(',')]);
}

/**
 * 预加载Hook
 * 用于预加载关键资源
 */
export function usePreload(
  url: string | null,
  options: Omit<PreloadOptions, 'url'> = {},
  immediate: boolean = false
): { preload: () => void } {
  useEffect(() => {
    if (immediate && url) {
      preloader.preload({ url, ...options });
    }
  }, [url, immediate]);

  const preload = useCallback(() => {
    if (url) {
      preloader.preload({ url, ...options });
    }
  }, [url, options]);

  return { preload };
}

/**
 * 批量预取Hook
 * 用于预取后续页面可能需要的资源
 */
export function usePrefetch(
  urls: string[],
  options: { onVisible?: boolean; onHover?: boolean } = {}
): void {
  useEffect(() => {
    // 初始化链接悬停预取
    if (options.onHover !== false) {
      preloader.initLinkPrefetch();
    }

    // 初始化可见性预取
    if (options.onVisible) {
      preloader.initVisiblePrefetch();
    }

    // 批量预取
    if (urls.length > 0) {
      urls.forEach(url => {
        preloader.prefetch({ url, as: preloader.getResourceType(url) });
      });
    }
  }, [urls.join(','), options.onHover, options.onVisible]);
}

/**
 * 字体预加载Hook
 */
export function usePreloadFont(fontUrl: string, format?: string): void {
  useEffect(() => {
    preloader.preloadFont(fontUrl, format);
  }, [fontUrl, format]);
}

/**
 * 预取当前路由可能需要的数据
 */
export function usePrefetchRouteData(
  routeData: Record<string, string | string[]>
): void {
  useEffect(() => {
    Object.entries(routeData).forEach(([route, urls]) => {
      const urlList = Array.isArray(urls) ? urls : [urls];
      urlList.forEach(url => {
        preloader.prefetch({ url, as: 'fetch' });
      });
    });
  }, [JSON.stringify(routeData)]);
}

// 导出类型
export type { PrefetchOptions, PreloadOptions, PreconnectOptions };
