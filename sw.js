const CACHE_NAME = 'examready-v12';

// Core pages that must be cached for offline navigation
const CORE_PAGES = [
  '/',
  '/index.html',
  '/privacy.html',
  '/about.html'
];

// Supporting assets — cached during install but a single failure
// should not prevent the service worker from activating
const OPTIONAL_ASSETS = [
  '/site.webmanifest',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache core pages first (required — failure aborts install)
      cache.addAll(CORE_PAGES).then(() =>
        // Then cache optional assets individually (one failure does not break install)
        Promise.allSettled(
          OPTIONAL_ASSETS.map((url) =>
            cache.add(url).catch(() => {
              // Silently skip assets that fail to fetch (e.g. network issue)
            })
          )
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only cache same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML pages): network-first
  // so new deployments take effect immediately
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            // Keep SW alive until cache write completes
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            );
          }
          return response;
        })
        .catch(() =>
          // ignoreSearch: true so /?mode=signature matches cached /
          // and /about.html?ref=x matches cached /about.html
          caches.match(event.request, { ignoreSearch: true })
            .then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Static assets: cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            // Keep SW alive until cache write completes
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            );
          }
          return response;
        })
        .catch(() => new Response('', { status: 408, statusText: 'Offline' }));
    })
  );
});
