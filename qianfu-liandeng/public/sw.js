/**
 * 千服联灯 PWA Service Worker
 * 提供缓存策略、离线支持和后台同步功能
 */

const CACHE_NAME = 'qianfu-v2';
const STATIC_CACHE = 'qianfu-static-v2';
const DYNAMIC_CACHE = 'qianfu-dynamic-v2';
const IMAGE_CACHE = 'qianfu-images-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/fonts/minecraft.ttf',
];

const OFFLINE_PAGE = '/offline.html';

// 安装事件：缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      }),
      self.skipWaiting(),
    ])
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return (
                name.startsWith('qianfu-') &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== IMAGE_CACHE
              );
            })
            .map((name) => caches.delete(name))
        );
      }),
      self.clients.claim(),
    ])
  );
});

// 判断请求是否为静态资源
const isStaticAsset = (url) => {
  return (
    url.pathname.match(/\.(js|css|html|json|woff2?|ttf)$/) ||
    url.pathname.startsWith('/assets/')
  );
};

// 判断请求是否为图片
const isImage = (url) => {
  return url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/);
};

// 判断请求是否为 API
const isAPI = (url) => {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/v1/');
};

// 网络优先策略
const networkFirst = async (request) => {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
};

// 缓存优先策略
const cacheFirst = async (request, cacheName) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (isImage(new URL(request.url))) {
      return caches.match('/icons/fallback-image.png');
    }
    throw error;
  }
};

// 仅网络策略
const networkOnly = async (request) => {
  return fetch(request);
};

// 带超时的网络请求
const fetchWithTimeout = (request, timeout = 5000) => {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
};

// 获取请求策略
const getStrategy = (request) => {
  const url = new URL(request.url);

  if (isAPI(url)) {
    return 'network-first';
  }

  if (isImage(url)) {
    return 'cache-first-image';
  }

  if (isStaticAsset(url)) {
    return 'cache-first-static';
  }

  if (request.mode === 'navigate') {
    return 'network-first';
  }

  return 'cache-first-dynamic';
};

// 获取事件处理
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求和跨域请求
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  const strategy = getStrategy(request);

  switch (strategy) {
    case 'network-first':
      event.respondWith(
        networkFirst(request).catch(() => {
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE);
          }
          return new Response('Network error', { status: 408 });
        })
      );
      break;

    case 'cache-first-static':
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      break;

    case 'cache-first-image':
      event.respondWith(cacheFirst(request, IMAGE_CACHE));
      break;

    case 'cache-first-dynamic':
      event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
      break;

    default:
      event.respondWith(fetch(request));
  }
});

// 后台同步队列
const SYNC_QUEUE = [];

// 后台同步事件
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(processSyncQueue());
  }
});

// 处理同步队列
async function processSyncQueue() {
  while (SYNC_QUEUE.length > 0) {
    const request = SYNC_QUEUE.shift();
    try {
      await fetch(request);
    } catch (error) {
      SYNC_QUEUE.push(request);
      break;
    }
  }
}

// 推送通知事件
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '您有一条新消息',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    image: data.image,
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    data: data.data || {},
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: data.timestamp || Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || '千服联灯',
      options
    )
  );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data;
  let url = '/';

  if (notificationData && notificationData.url) {
    url = notificationData.url;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // 如果已有窗口打开，聚焦它
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// 消息事件处理（来自主线程的通信）
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      event.waitUntil(
        caches.open(DYNAMIC_CACHE).then((cache) => {
          return cache.addAll(payload.urls);
        })
      );
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((name) => caches.delete(name))
          );
        })
      );
      break;

    case 'GET_CACHE_SIZE':
      event.waitUntil(
        caches.keys().then(async (cacheNames) => {
          const sizes = {};
          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            sizes[name] = keys.length;
          }
          event.ports[0].postMessage({ sizes });
        })
      );
      break;

    case 'ADD_TO_SYNC_QUEUE':
      SYNC_QUEUE.push(payload.request);
      break;

    default:
      break;
  }
});

// 定期清理过期缓存
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时

setInterval(async () => {
  const dynamicCache = await caches.open(DYNAMIC_CACHE);
  const imageCache = await caches.open(IMAGE_CACHE);

  // 清理动态缓存中超过7天的条目
  const dynamicKeys = await dynamicCache.keys();
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

  for (const request of dynamicKeys) {
    const response = await dynamicCache.match(request);
    if (response) {
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const date = new Date(dateHeader).getTime();
        if (now - date > maxAge) {
          await dynamicCache.delete(request);
        }
      }
    }
  }

  // 限制图片缓存数量
  const imageKeys = await imageCache.keys();
  const maxImages = 100;
  if (imageKeys.length > maxImages) {
    const toDelete = imageKeys.slice(0, imageKeys.length - maxImages);
    for (const request of toDelete) {
      await imageCache.delete(request);
    }
  }
}, CLEANUP_INTERVAL);
