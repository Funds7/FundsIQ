const CACHE_NAME = "fundsiq-offline-v2";

const FILES_TO_CACHE = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./courses.html",
  "./chapters-gst101.html",
  "./learn.html",
  "./content.js",
  "./gst101.js",
  "./style.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Cache files individually so one missing file won't break installation.
    for (const file of FILES_TO_CACHE) {
      try {
        await cache.add(file);
      } catch (error) {
        console.warn("Could not cache:", file, error);
      }
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("fundsiq-offline-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache Firebase, payment, or other external requests.
  if (url.origin !== self.location.origin) return;

  const isSelectedFile = FILES_TO_CACHE.some((file) => {
    const fileUrl = new URL(file, self.location.href);
    return fileUrl.href === url.href;
  });

  if (!isSelectedFile) return;

  event.respondWith((async () => {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) return cachedResponse;

    return fetch(request);
  })());
});
