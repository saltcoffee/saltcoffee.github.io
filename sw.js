'use strict';

// Cache names include the registration scope so project sites stay independent.
const SITE_ROOT = new URL(self.registration.scope);
const CACHE_PREFIX = 'guagua-blog:' + SITE_ROOT.pathname + ':';
// Keep this value in sync with asset_version in _config.yml.
const ASSET_VERSION = '2026-10-13-v17';
const CACHE_NAME = CACHE_PREFIX + ASSET_VERSION;
// Photo storage survives CSS/JS releases; metadata keeps its original response intact.
const IMAGE_CACHE_NAME = CACHE_PREFIX + 'images-v1';
const IMAGE_META_CACHE_NAME = CACHE_PREFIX + 'images-meta-v1';
const IMAGE_LIMIT = 48;
const IMAGE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let imageCacheQueue = Promise.resolve();
const OFFLINE_URL = new URL('offline.html', SITE_ROOT).href;
const PRECACHE_PATHS = [
  'offline.html',
  'css/blog.css?v=' + ASSET_VERSION,
  'css/syntax.css?v=' + ASSET_VERSION,
  'css/gallery.css?v=' + ASSET_VERSION,
  'js/blog.js?v=' + ASSET_VERSION,
  'js/gallery.js?v=' + ASSET_VERSION,
  'img/favicon.ico?v=' + ASSET_VERSION,
  'img/favicon.svg?v=' + ASSET_VERSION
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

function imageResponseHasNoStore(response) {
  return /(?:^|,)\s*no-store(?:\s*(?:,|=|$))/i.test(response.headers.get('Cache-Control') || '');
}

function canCacheImage(request, response) {
  return request.method === 'GET' && request.cache !== 'no-store' &&
    /^https?:$/.test(new URL(request.url).protocol) && !imageResponseHasNoStore(response) &&
    response.status === 200 && response.type !== 'opaque' &&
    /^image\//i.test((response.headers.get('Content-Type') || '').trim());
}

function imageCacheOperation(operation) {
  const result = imageCacheQueue.then(operation);
  imageCacheQueue = result.catch(() => undefined);
  return result;
}

async function deleteCachedImage(cache, metadata, request) {
  await cache.delete(request);
  await metadata.delete(request);
}

async function trimImageCache(cache, metadata, limit) {
  const requests = await cache.keys();
  // Cache.keys() retains write order; reading a photo does not move it.
  for (const request of requests.slice(0, Math.max(0, requests.length - limit))) {
    await deleteCachedImage(cache, metadata, request);
  }
}

function readCachedImage(request) {
  return imageCacheOperation(async () => {
    const [cache, metadata] = await Promise.all([
      caches.open(IMAGE_CACHE_NAME), caches.open(IMAGE_META_CACHE_NAME)
    ]);
    const [response, record] = await Promise.all([cache.match(request), metadata.match(request)]);
    if (!response) {
      if (record) await metadata.delete(request);
      return;
    }
    const storedAt = record ? Number(await record.text()) : 0;
    const age = Date.now() - storedAt;
    if (!canCacheImage(request, response) || !Number.isFinite(storedAt) ||
        storedAt <= 0 || age < 0 || age >= IMAGE_MAX_AGE) {
      await deleteCachedImage(cache, metadata, request);
      return;
    }
    return response;
  });
}

function forgetCachedImage(request) {
  return imageCacheOperation(async () => {
    if (!(await caches.keys()).includes(IMAGE_CACHE_NAME)) return;
    const [cache, metadata] = await Promise.all([
      caches.open(IMAGE_CACHE_NAME), caches.open(IMAGE_META_CACHE_NAME)
    ]);
    await deleteCachedImage(cache, metadata, request);
  });
}

async function storeImageResponse(request, response) {
  if (!canCacheImage(request, response)) return;
  // Clone before returning the live response; cache writes use event.waitUntil().
  const copy = response.clone();
  await imageCacheOperation(async () => {
    let cache;
    let metadata;
    try {
      [cache, metadata] = await Promise.all([
        caches.open(IMAGE_CACHE_NAME), caches.open(IMAGE_META_CACHE_NAME)
      ]);
      const existing = await cache.match(request);
      await trimImageCache(cache, metadata, existing ? IMAGE_LIMIT : IMAGE_LIMIT - 1);
      await cache.put(request, copy);
      const headers = new Headers({ 'Content-Type': 'text/plain' });
      // Timestamp records must match the same content variants as the image.
      const vary = copy.headers.get('Vary');
      if (vary) headers.set('Vary', vary);
      await metadata.put(request, new Response(String(Date.now()), { headers }));
      await trimImageCache(cache, metadata, IMAGE_LIMIT);
    } catch (_) {
      // Incomplete records are never served as durable cache hits.
      if (cache && metadata) {
        await Promise.allSettled([cache.delete(request), metadata.delete(request)]);
      }
    }
  });
}

async function imageCacheFirst(event) {
  const request = event.request;
  if (!['no-store', 'reload', 'no-cache'].includes(request.cache)) {
    try {
      const cached = await readCachedImage(request);
      if (cached) return cached;
    } catch (_) {
      // Unavailable storage must fall back to the normal image request.
    }
  }
  try {
    const response = await fetch(request);
    if (request.cache !== 'no-store') {
      const storage = imageResponseHasNoStore(response) ?
        forgetCachedImage(request) : storeImageResponse(request, response);
      event.waitUntil(storage.catch(() => undefined));
    }
    return response;
  } catch (_) {
    return Response.error();
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
    if (name.startsWith(CACHE_PREFIX) &&
        ![CACHE_NAME, IMAGE_CACHE_NAME, IMAGE_META_CACHE_NAME].includes(name)) {
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
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (request.destination === 'image') {
    if (!/^https?:$/.test(url.protocol)) return;
    const response = imageCacheFirst(event);
    event.respondWith(response);
    event.waitUntil(response.then(() => undefined).catch(() => undefined));
    return;
  }
  if (!isSiteURL(request.url)) return;
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
