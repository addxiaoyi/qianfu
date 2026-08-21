/**
 * 资源预加载 React Hooks
 * 优化项 34: 预加载优化 - preload/prefetch
 */

import { useEffect, useCallback, useRef } from 'react';
import { ResourcePreloader } from '../utils/resource-preloader';
import type { PrefetchOptions } from '../utils/resource-preloader';

/**
 * 预连接Hook
 * 用于提前建立与外部服务的连接
 */
export function usePreconnect(urls: string[]): void {
  useEffect(() => {
    const preloader = new ResourcePreloader();
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
  options: {
    as?: 'script' | 'style' | 'font' | 'image' | 'fetch';
    crossOrigin?: boolean;
    type?: string;
    media?: string;
  } = {},
  immediate: boolean = false
): { preload: () => void } {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    if (immediate && url) {
      preloaderRef.current.preload({ url, ...options });
    }
  }, [url, immediate]);

  const preload = useCallback(() => {
    if (url) {
      preloaderRef.current.preload({ url, ...options });
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
  options: {
    onVisible?: boolean;
    onHover?: boolean;
    as?: PrefetchOptions['as'];
  } = {}
): void {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    // 初始化链接悬停预取
    if (options.onHover !== false) {
      preloaderRef.current.initLinkPrefetch();
    }

    // 初始化可见性预取
    if (options.onVisible) {
      preloaderRef.current.initVisiblePrefetch();
    }

    // 批量预取
    if (urls.length > 0) {
      urls.forEach(url => {
        const as = options.as || preloaderRef.current.getResourceType(url) as PrefetchOptions['as'];
        preloaderRef.current.prefetch({ url, as });
      });
    }
  }, [urls.join(','), options.onHover, options.onVisible, options.as]);
}

/**
 * 字体预加载Hook
 */
export function usePreloadFont(
  fontUrl: string,
  format?: string
): void {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    preloaderRef.current.preloadFont(fontUrl, format);
  }, [fontUrl, format]);
}

/**
 * 关键CSS预加载Hook
 */
export function usePreloadStyle(
  cssUrl: string
): void {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    preloaderRef.current.preloadStyle(cssUrl);
  }, [cssUrl]);
}

/**
 * 图片预加载Hook
 */
export function usePreloadImage(
  imageUrl: string
): void {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    preloaderRef.current.preloadImage(imageUrl);
  }, [imageUrl]);
}

/**
 * 预取当前路由可能需要的数据
 */
export function usePrefetchRouteData(
  routeData: Record<string, string | string[]>
): void {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    Object.entries(routeData).forEach(([route, urls]) => {
      const urlList = Array.isArray(urls) ? urls : [urls];
      urlList.forEach(url => {
        preloaderRef.current.prefetch({ url, as: 'fetch' });
      });
    });
  }, [JSON.stringify(routeData)]);
}

/**
 * 预取API数据Hook
 */
export function usePrefetchApi(
  apiEndpoints: string[],
  options: {
    /** 预取触发时机 */
    trigger?: 'mount' | 'visible' | 'hover';
    /** 预取的元素选择器 */
    triggerSelector?: string;
    /** 延迟预取时间(ms) */
    delay?: number;
  } = {}
): void {
  const { trigger = 'mount', triggerSelector, delay = 0 } = options;
  const preloaderRef = useRef(new ResourcePreloader());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const doPrefetch = () => {
      apiEndpoints.forEach(url => {
        preloaderRef.current.prefetch({ url, as: 'fetch' });
      });
    };

    if (trigger === 'mount') {
      if (delay > 0) {
        timeoutRef.current = setTimeout(doPrefetch, delay);
      } else {
        doPrefetch();
      }
    } else if (trigger === 'visible' && triggerSelector) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            doPrefetch();
            observer.disconnect();
          }
        });
      }, { rootMargin: '100px' });

      const elements = document.querySelectorAll(triggerSelector);
      elements.forEach(el => observer.observe(el));

      return () => observer.disconnect();
    } else if (trigger === 'hover' && triggerSelector) {
      const handleMouseEnter = () => {
        doPrefetch();
      };

      const elements = document.querySelectorAll(triggerSelector);
      elements.forEach(el => {
        el.addEventListener('mouseenter', handleMouseEnter, { once: true, passive: true });
      });

      return () => {
        elements.forEach(el => {
          el.removeEventListener('mouseenter', handleMouseEnter);
        });
      };
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [apiEndpoints.join(','), trigger, triggerSelector, delay]);
}

/**
 * 预加载管理器Provider Hook
 * 在应用根组件中使用，提供全局预加载配置
 */
export interface PrefetchConfig {
  /** 预连接的域名列表 */
  preconnectDomains?: string[];
  /** 预加载的关键资源 */
  preloadResources?: Array<{ url: string; as: string }>;
  /** 预取的API端点 */
  prefetchApiEndpoints?: string[];
  /** 是否启用鼠标悬停预取 */
  prefetchOnHover?: boolean;
  /** 是否启用可见性预取 */
  prefetchOnVisible?: boolean;
}

export function usePrefetchManager(config: PrefetchConfig): void {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    // 预连接外部域名
    if (config.preconnectDomains?.length) {
      config.preconnectDomains.forEach(domain => {
        preloaderRef.current.preconnect({ url: domain });
      });
    }

    // 预加载关键资源
    if (config.preloadResources?.length) {
      config.preloadResources.forEach(resource => {
        preloaderRef.current.preload({
          url: resource.url,
          as: resource.as as unknown,
        });
      });
    }

    // 初始化预取
    if (config.prefetchOnHover !== false) {
      preloaderRef.current.initLinkPrefetch();
    }

    if (config.prefetchOnVisible) {
      preloaderRef.current.initVisiblePrefetch();
    }
  }, [JSON.stringify(config)]);
}

/**
 * 预加载静态资源Hook
 * 适用于在组件加载时预加载静态资源
 */
export function usePreloadStaticAssets(
  assets: {
    fonts?: string[];
    styles?: string[];
    images?: string[];
    scripts?: string[];
  } = {}
): void {
  const preloaderRef = useRef(new ResourcePreloader());

  useEffect(() => {
    if (assets.fonts?.length) {
      assets.fonts.forEach(font => {
        preloaderRef.current.preloadFont(font);
      });
    }

    if (assets.styles?.length) {
      assets.styles.forEach(css => {
        preloaderRef.current.preloadStyle(css);
      });
    }

    if (assets.images?.length) {
      assets.images.forEach(image => {
        preloaderRef.current.preloadImage(image);
      });
    }

    if (assets.scripts?.length) {
      assets.scripts.forEach(script => {
        preloaderRef.current.preloadScript(script);
      });
    }
  }, [JSON.stringify(assets)]);
}
