const CACHE_NAME = "fundsiq-offline-v7";

// Essential FundsIQ application files
const APP_FILES = [

  // Main pages
  "./",
  "./index.html",
  "./login.html",
  "./login.js",
  "./login.css",

  // Dashboard
  "./dashboard.html",
  "./dashboard.js",
  "./dashboard.css",

  // Firebase and coins
  "./firebase.js",
  "./coins.js",

  // Styles
  "./style.css",
  "./more.css",
  "./components.css",

  // Profile
  "./profile.html",
  "./profile.js",

  // Courses
  "./courses.html",
  "./chapters-gst101.html",
  "./chapters-gst102.html",
  "./chapters-gst103.html",
  "./chapters-gst111.html",
  "./chapters-gst112.html",
  "./chapters-gst113.html",
  "./chapters-gst114.html",

  // Learning materials
  "./learn.html",
  "./content.js",

  // Course scripts
  "./gst101.js",
  "./gst102.js",
  "./gst103.js",
  "./gst111.js",
  "./gst112.js",
  "./gst113.js",
  "./gst114.js",

  // Examination
  "./exam.html",
  "./engine.js",
  "./questions.js",

  // Results
  "./result.html",
  "./result.js",
  "./result.css"
];


// ==========================================
// INSTALL SERVICE WORKER
// ==========================================

self.addEventListener("install", event => {

  event.waitUntil((async () => {

    const cache = await caches.open(CACHE_NAME);

    for (const file of APP_FILES) {

      try {

        const request = new Request(
          new URL(file, self.location.href),
          { cache: "reload" }
        );

        const response = await fetch(request);

        if (response.ok) {

          await cache.put(request, response);

        }

      } catch (error) {

        console.warn(
          "FundsIQ could not cache:",
          file,
          error
        );

      }

    }

    await self.skipWaiting();

  })());

});


// ==========================================
// ACTIVATE SERVICE WORKER
// ==========================================

self.addEventListener("activate", event => {

  event.waitUntil((async () => {

    const cacheNames = await caches.keys();

    await Promise.all(

      cacheNames

        .filter(name =>
          name.startsWith("fundsiq-offline-") &&
          name !== CACHE_NAME
        )

        .map(name => caches.delete(name))

    );

    await self.clients.claim();

  })());

});


// ==========================================
// FETCH AND OFFLINE FALLBACK
// ==========================================

self.addEventListener("fetch", event => {

  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  const isAppFile =
    url.origin === self.location.origin;

  const isFirebaseSDK =
    url.hostname === "www.gstatic.com" &&
    url.pathname.includes("/firebasejs/12.16.0/");

  if (!isAppFile && !isFirebaseSDK) return;

  // Do not cache API requests
  if (url.pathname.includes("/api/")) return;

  event.respondWith((async () => {

    const cache = await caches.open(CACHE_NAME);

    try {

      const response = await fetch(request);

      if (response.ok) {

        await cache.put(
          request,
          response.clone()
        );

      }

      return response;

    } catch (error) {

      // Try exact cached request
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {

        return cachedResponse;

      }

      // Try URL without query parameters
      const cleanURL = new URL(request.url);

      cleanURL.search = "";

      const fallback = await cache.match(
        cleanURL.href
      );

      if (fallback) {

        return fallback;

      }

      return new Response(

        "This FundsIQ page is not available offline. Please reconnect to the internet.",

        {
          status: 503,

          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        }

      );

    }

  })());

});