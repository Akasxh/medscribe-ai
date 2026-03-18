const CACHE_VERSION = 'medscribe-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

// App shell — core static assets cached on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// ─── Install: cache app shell ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ─── Activate: purge old caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: strategy depends on request type ───
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests (POST, WebSocket upgrades, etc.)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Network-first for API calls and WebSocket-related requests
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network-first for navigation requests (HTML pages) — ensures latest app version
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts, icons)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request));
});

// ─── Cache-first strategy ───
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline fallback for images
    if (request.destination === 'image') {
      return new Response('', { status: 404, statusText: 'Offline' });
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ─── Network-first strategy ───
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline fallback for navigation
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }

    return new Response(
      '<!DOCTYPE html><html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F8FAFC;color:#0f172a"><div style="text-align:center"><h2>You are offline</h2><p>MedScribe AI requires an internet connection for AI processing.</p><p>Please check your connection and try again.</p></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
