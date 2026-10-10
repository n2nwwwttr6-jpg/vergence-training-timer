'use strict';
// 每次发布修改后的 index / manifest / 图标时递增 VERSION。
// 版本缓存一次完整安装；不会把新版 HTML 与旧版资源混用。
const VERSION = 'v2';
const BASE = new URL('./', self.location.href);
// CacheStorage 由同源共享，因此前缀包含子路径，只清理本应用的旧版本。
const CACHE_PREFIX = 'vergence-timer:' + BASE.pathname + ':';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const ASSETS = FILES.map(file => new URL(file, BASE).href);
const ASSET_SET = new Set(ASSETS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = (await caches.keys()).includes(CACHE_NAME);
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS.map(url => new Request(url, {cache: 'reload'})));
    } catch (error) {
      // 任何资源加载失败都不启用部分版本；旧版仍可正常运行。
      if (!existed) await caches.delete(CACHE_NAME);
      throw error;
    }
    // 不 skipWaiting，不刷新已有页面，防止更新打断训练。
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin) return;
  const canonical = url.origin + url.pathname;
  // 只处理清单里的静态资源，不缓存设置、预设、其他仓库页面或第三方请求。
  if (!ASSET_SET.has(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(canonical);
    if (cached) return cached;
    return fetch(request);
  })());
});
