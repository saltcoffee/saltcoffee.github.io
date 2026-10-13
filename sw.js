'use strict';

// Cache names include the registration scope so project sites stay independent.
const SITE_ROOT = new URL(self.registration.scope);
const CACHE_PREFIX = 'guagua-blog:' + SITE_ROOT.pathname + ':';
// Keep this value in sync with asset_version in _config.yml.
const ASSET_VERSION = '2026-10-13-v12';
const CACHE_NAME = CACHE_PREFIX + ASSET_VERSION;
const OFFLINE_URL = new URL('offline.html', SITE_ROOT).href;
const PRECACHE_PATHS = [
  'offline.html',
  'css/blog.css?v=' + ASSET_VERSION,
  'css/syntax.css?v=' + ASSET_VERSION,
  'css/gallery.css?v=' + ASSET_VERSION,
  'js/blog.js?v=' + ASSET_VERSION,
  'js/gallery.js?v=' + ASSET_VERSION,
  'img/favicon.ico',
  'img/favicon.svg'
];
const LEGACY_CACHES = ['precache-v1', 'runtime'];

function isSiteURL(value) {
  const url = new URL(value);
  return url.origin === SITE_ROOT.origin && url.pathname.startsWith(SITE_ROOT.pathname);
}

function canCache(request, response) {
  return request.method === 'GET' && isSiteURL(request.url) &&
    response.status === 200 && response.type !== 'opaque' &&
    (!response.url || isSiteURL(response.url));
}

async function storeResponse(request, response) {
  if (!canCache(request, response)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (_) {
    // A full or unavailable cache must not interrupt online reading.
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_PATHS.map(async path => {
      const request = new Request(new URL(path, SITE_ROOT).href, {
        cache: 'reload',
        credentials: 'same-origin'
      });
      const response = await fetch(request);
      if (!canCache(request, response)) throw new Error('Offline asset unavailable: ' + path);
      await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

async function clearOldCaches() {
  const names = await caches.keys();
  await Promise.all(names.map(async name => {
    if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) {
      await caches.delete(name);
      return;
    }
    if (!LEGACY_CACHES.includes(name)) return;
    const cache = await caches.open(name);
    const requests = await cache.keys();
    await Promise.all(requests.filter(request => request.method === 'GET' && isSiteURL(request.url))
      .map(request => cache.delete(request)));
    // The old theme used generic names. Preserve entries from other scopes.
    if ((await cache.keys()).length === 0) await caches.delete(name);
  }));
}

async function cacheOpenPages() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const urls = [...new Set(windows.map(client => client.url).filter(isSiteURL))];
  await Promise.all(urls.map(async url => {
    try {
      const request = new Request(url, { cache: 'no-cache', credentials: 'same-origin' });
      await storeResponse(request, await fetch(request));
    } catch (_) {
      // Only pages already open are fetched; photos are cached as they are viewed.
    }
  }));
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await clearOldCaches();
    await self.clients.claim();
    // The first page load happened before this worker controlled the window.
    await cacheOpenPages();
  })());
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    await storeResponse(request, response);
    return response;
  } catch (_) {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(request) || await cache.match(OFFLINE_URL) || Response.error();
  }
}

function staleWhileRevalidate(event) {
  const request = event.request;
  const network = fetch(request).then(async response => {
    await storeResponse(request, response);
    return response;
  });
  event.waitUntil(network.then(() => undefined).catch(() => undefined));
  return (async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
    } catch (_) {
      // Private browsing or a storage limit can make Cache Storage unavailable.
    }
    try {
      return await network;
    } catch (_) {
      // Returning HTML for a missing image, stylesheet or script is incorrect.
      return Response.error();
    }
  })();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !isSiteURL(request.url) || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.pathname === new URL('sw.js', SITE_ROOT).pathname) return;
  if (request.mode === 'navigate') {
    const response = networkFirst(request);
    event.respondWith(response);
    event.waitUntil(response.then(() => undefined).catch(() => undefined));
    return;
  }
  const isAsset = ['style', 'script', 'image', 'font', 'manifest'].includes(request.destination) ||
    /\.(?:css|js|jpe?g|png|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);
  if (isAsset) event.respondWith(staleWhileRevalidate(event));
});
