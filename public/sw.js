const CACHE_NAME = 'cityz-cache-v1';
const ASSETS_TO_CACHE = [
  '/dashboard',
  '/shorts',
  '/login',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-caching assets failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass third-party origins (Firebase, Osm, API) to avoid CORS or fetch failures
  if (url.origin !== self.location.origin) return;

  // Network-first strategy for main HTML pages (navigation), falling back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request) || caches.match('/dashboard');
      })
    );
    return;
  }

  // Cache-first strategy for static assets (images, stylesheets, scripts)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Dynamically cache internal static files
        if (
          response.status === 200 &&
          (url.pathname.startsWith('/_next/static/') ||
            url.pathname.startsWith('/icons/') ||
            url.pathname.endsWith('.css') ||
            url.pathname.endsWith('.js') ||
            url.pathname.endsWith('.png') ||
            url.pathname.endsWith('.jpg') ||
            url.pathname.endsWith('.svg'))
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
