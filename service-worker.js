const CACHE_NAME = "fundsiq-pwa-v1";

const APP_FILES = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install service worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

// Activate service worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("fundsiq-pwa-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );

  self.clients.claim();
});

// Handle requests
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept external requests or API requests
  if (url.origin !== self.location.origin) return;

  // Only cache app icons and manifest
  const isAppFile =
    url.pathname.endsWith("/manifest.json") ||
    url.pathname.endsWith("/icons/icon-192.png") ||
    url.pathname.endsWith("/icons/icon-512.png");

  if (!isAppFile) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    })
  );
});
