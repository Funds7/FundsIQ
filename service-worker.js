const CACHE_NAME = "fundsiq-offline-v4";

const COURSE_FILES = [
  "./courses.html",
  "./chapters-gst101.html",
  "./chapters-gst102.html",
  "./chapters-gst103.html",
  "./chapters-gst111.html",
  "./chapters-gst112.html",
  "./chapters-gst113.html",
  "./chapters-gst114.html",
  "./learn.html",
  "./content.js",
  "./gst101.js",
  "./gst102.js",
  "./gst103.js",
  "./gst111.js",
  "./gst112.js",
  "./gst113.js",
  "./gst114.js",
  "./style.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Save each file separately so one missing file doesn't stop the others.
    for (const file of COURSE_FILES) {
      try {
        const response = await fetch(file);

        if (response.ok) {
          await cache.put(new Request(new URL(file, self.location.href)), response);
        } else {
          console.warn("Could not cache:", file, response.status);
        }
      } catch (error) {
        console.warn("Could not cache:", file, error);
      }
    }

    await self.skipWaiting();
  })());
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

  // Do not intercept API or external-service requests.
  if (url.pathname.includes("/api/")) return;

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

      if (url.search) {
        const baseUrl = new URL(url.href);
        baseUrl.search = "";
        const baseCached = await cache.match(baseUrl.href);

        if (baseCached) return baseCached;
      }

      return new Response(
        "This page is not available offline yet. Connect to the internet and try again.",
        {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }
      );
    }
  })());
});
