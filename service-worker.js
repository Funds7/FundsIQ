const CACHE_NAME = "fundsiq-offline-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    await Promise.all(
      names
        .filter((name) => name.startsWith("fundsiq-offline-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Only cache FundsIQ pages and local files. Leave external services alone.
  if (
    url.pathname.includes("/api/") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("paystack")
  ) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const response = await fetch(request);

      if (response.ok) {
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      const cached = await cache.match(request);

      if (cached) return cached;

      // If a page URL has a query string, try its base page too.
      if (url.search) {
        const baseUrl = new URL(url.href);
        baseUrl.search = "";
        const baseCached = await cache.match(baseUrl.href);

        if (baseCached) return baseCached;
      }

      return new Response(
        "This page has not been saved for offline use yet. Open it once while online, then try again.",
        {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }
      );
    }
  })());
});
