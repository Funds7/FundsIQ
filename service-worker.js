const CACHE_NAME = "fundsiq-offline-v5";

// Essential application files
const APP_FILES = [
  "./",
  "./index.html",
  "./login.html",
  "./dashboard.html",

  // Dashboard scripts
  "./dashboard.js",
  "./firebase.js",
  "./coins.js",

  // Dashboard styles
  "./dashboard.css",
  "./more.css",
  "./components.css",

  // Course pages
  "./courses.html",
  "./chapters-gst101.html",
  "./chapters-gst102.html",
  "./chapters-gst103.html",
  "./chapters-gst111.html",
  "./chapters-gst112.html",
  "./chapters-gst113.html",
  "./chapters-gst114.html",
  "./learn.html",

  // Course scripts
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

// Firebase SDK modules
const FIREBASE_FILES = [
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js"
];


// ==========================================
// INSTALL
// ==========================================

self.addEventListener("install", (event) => {

  event.waitUntil((async () => {

    const cache = await caches.open(CACHE_NAME);

    // Cache application files individually
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

    // Cache Firebase SDK modules
    for (const file of FIREBASE_FILES) {

      try {

        const response = await fetch(file);

        if (response.ok) {

          await cache.put(
            file,
            response
          );

        }

      } catch (error) {

        console.warn(
          "Firebase SDK cache failed:",
          file
        );

      }

    }

    await self.skipWaiting();

  })());

});


// ==========================================
// ACTIVATE
// ==========================================

self.addEventListener("activate", (event) => {

  event.waitUntil((async () => {

    const names = await caches.keys();

    await Promise.all(

      names
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
// FETCH
// ==========================================

self.addEventListener("fetch", (event) => {

  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Firebase SDK requests are allowed
  const isFirebaseSDK =
    url.hostname === "www.gstatic.com" &&
    url.pathname.includes("/firebasejs/12.16.0/");

  // Ignore unrelated external requests
  if (
    url.origin !== self.location.origin &&
    !isFirebaseSDK
  ) {
    return;
  }

  // Ignore backend API requests
  if (url.pathname.includes("/api/")) {
    return;
  }

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
      const cached = await cache.match(request);

      if (cached) {
        return cached;
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

      // Offline navigation fallback
      if (request.mode === "navigate") {

        const dashboard = await cache.match(
          new URL(
            "./dashboard.html",
            self.location.href
          ).href
        );

        if (dashboard) {
          return dashboard;
        }

      }

      return new Response(
        "FundsIQ is currently offline. Please reconnect to the internet.",
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