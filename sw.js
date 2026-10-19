'use strict';

// Cache names include the registration scope so project sites stay independent.
const SITE_ROOT = new URL(self.registration.scope);
const CACHE_PREFIX = 'guagua-blog:' + SITE_ROOT.pathname + ':';
// Keep this value in sync with asset_version in _config.yml.
const ASSET_VERSION = '2026-10-19-v35';
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
  'favicon.ico?v=' + ASSET_VERSION,
  'img/favicon-pingfang.svg?v=' + ASSET_VERSION,
  'pwa/icons/128.png?v=' + ASSET_VERSION,
  'pwa/icons/512.png?v=' + ASSET_VERSION
];
const LEGACY_CACHES = ['precache-v1', 'runtime'];
const SITE_ICON_PATHS = new Set([
  'favicon.ico', 'img/favicon-pingfang.svg', 'img/favicon.ico', 'img/favicon.svg',
  'pwa/icons/128.png', 'pwa/icons/512.png'
].map(path => new URL(path, SITE_ROOT).pathname));

function isSiteURL(value) {
  const url = new URL(value);
  return url.origin === SITE_ROOT.origin && url.pathname.startsWith(SITE_ROOT.pathname);
}

function canCache(request, response) {
  return request.method === 'GET' && request.cache !== 'no-store' &&
    !responseHasNoStore(response) && isSiteURL(request.url) &&
    response.status === 200 && response.type !== 'opaque' &&
    (!response.url || isSiteURL(response.url));
}

async function storeResponse(request, response) {
  if (!canCache(request, response)) return;
  try {
    const copy = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, copy);
  } catch (_) {
    // A full or unavailable cache must not interrupt online reading.
  }
}

function responseHasNoStore(response) {
  return /(?:^|,)\s*no-store(?:\s*(?:,|=|$))/i.test(response.headers.get('Cache-Control') || '');
}

function canCacheImage(request, response) {
  return request.method === 'GET' && request.cache !== 'no-store' &&
    /^https?:$/.test(new URL(request.url).protocol) && !responseHasNoStore(response) &&
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
  // A reload or no-cache request is an explicit request for server truth.
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
      const storage = responseHasNoStore(response) ?
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
    try {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(PRECACHE_PATHS.map(async path => {
        const request = new Request(new URL(path, SITE_ROOT).href, {
          cache: 'reload',
          credentials: 'same-origin'
        });
        const response = await fetch(request);
        if (canCache(request, response)) await cache.put(request, response);
      }));
    } catch (_) {
      // Offline storage is optional; a quota error must not preserve an old worker.
    }
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

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      await clearOldCaches();
    } catch (_) {
      // The new worker can still serve fresh content when cache cleanup fails.
    }
    await self.clients.claim();
  })());
});

// Fetch normally merges an HTTP 304 with its cached body. Explicit conditional
// headers can expose a bare 304, so retry without them before considering offline.
function responseNeedsReload(response) {
  return response.status === 304 || response.status === 0;
}

async function fetchFresh(request) {
  const cacheMode = request.cache === 'no-store' ? 'no-store' : 'no-cache';
  let response = await fetch(request, { cache: cacheMode });
  if (responseNeedsReload(response)) {
    const headers = new Headers(request.headers);
    headers.delete('If-None-Match');
    headers.delete('If-Modified-Since');
    response = await fetch(request, { cache: cacheMode === 'no-store' ? 'no-store' : 'reload', headers });
  }
  if (responseNeedsReload(response)) throw new Error('Response has no usable body');
  return response;
}

async function cachedFallback(request, allowOfflinePage) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = request.cache !== 'no-store' && await cache.match(request);
    if (cached) return cached;
    // Styles and scripts must never receive an HTML offline page.
    if (allowOfflinePage) return await cache.match(OFFLINE_URL) || Response.error();
  } catch (_) {
    // Storage may also be unavailable when the network is disconnected.
  }
  return Response.error();
}

async function networkFirst(event, allowOfflinePage) {
  const request = event.request;
  try {
    const response = await fetchFresh(request);
    // Return fresh content even if a cache write is slow or fails.
    event.waitUntil(storeResponse(request, response).catch(() => undefined));
    return response;
  } catch (_) {
    return cachedFallback(request, allowOfflinePage);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  // Site identity updates with the page, independently of long-lived photo storage.
  if (isSiteURL(request.url) && SITE_ICON_PATHS.has(url.pathname)) {
    const response = networkFirst(event, false);
    event.respondWith(response);
    event.waitUntil(response.then(() => undefined).catch(() => undefined));
    return;
  }
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
    const response = networkFirst(event, true);
    event.respondWith(response);
    event.waitUntil(response.then(() => undefined).catch(() => undefined));
    return;
  }
  const isAsset = ['style', 'script', 'image', 'font', 'manifest'].includes(request.destination) ||
    /\.(?:css|js|jpe?g|png|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);
  if (isAsset) {
    const response = networkFirst(event, false);
    event.respondWith(response);
    event.waitUntil(response.then(() => undefined).catch(() => undefined));
  }
});
