const CACHE_NAME = "fundsiq-staging-offline-v4";

// Essential FundsIQ application files
const APP_FILES = [

  // Main pages
  "./",
  "./index.html",
  "./login.html",
  "./login.js",
  "./login.css",
  "./signup.html",
  "./manifest.json",

  // Dashboard
  "./dashboard.html",
  "./dashboard.js",
  "./dashboard.css",

  // Academic tools
  "./timetable.html",
  "./timetable.js",
  "./timetable.css",
  "./cgpa.html",
  "./cgpa.js",
  "./cgpa.css",

  // Marketer area
  "./marketer.html",
  "./marketer.css",
  "./marketer.js",
  "./marketer-dashboard.html",
  "./marketer-dashboard.js",
  "./marketer-dashboard.css",

  // Firebase and coins
  "./firebase.js",
  "./coins.js",
  "./coin-api.js",
  "./premium-access.js",

  // Styles
  "./style.css",
  "./more.css",
  "./more.html",
  "./more.js",
  "./components.css",

  // Leaderboard
  "./leaderboard.html",
  "./leaderboard.js",
  "./leaderboard.css",
  "./modals.js",
  "./modals.css",

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
  "./exam-sync.js",
  "./questions.js",

  // Results
  "./result.html",
  "./result.js",
  "./result.css",

  // Additional learning and support pages
  "./chapters.html",
  "./chapter-test.html",
  "./contact.html",
  "./corrections.html",
  "./corrections.css",
  "./corrections.js",
  "./performance.html",
  "./performance.css",
  "./performance.js",
  "./privacy.html",
  "./terms.html",

  // App icon used by installed PWA
  "./icons/icon-512.png"
];


// ==========================================
// INSTALL SERVICE WORKER
// ==========================================

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache each asset once and in parallel. This avoids downloading the exam
    // core twice and prevents one slow file from blocking every later file.
    const uniqueFiles = [...new Set(APP_FILES)];
    await Promise.allSettled(uniqueFiles.map(async file => {
      const request = new Request(new URL(file, self.location.href), {
        cache: "reload"
      });
      const response = await fetch(request);
      if (!response.ok) throw new Error("HTTP " + response.status);
      await cache.put(request, response);
    }));
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
          name.startsWith("fundsiq-staging-offline-") &&
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
  const isAppFile = url.origin === self.location.origin;
  const isFirebaseSDK =
    url.hostname === "www.gstatic.com" &&
    url.pathname.includes("/firebasejs/12.16.0/");

  if (!isAppFile && !isFirebaseSDK) return;
  if (url.pathname.includes("/api/")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const isNavigation = request.mode === "navigate";

    // Pages check the network first so users receive current HTML.
    // Scripts, styles, and other static assets use cache-first for faster taps
    // and repeat visits, with a network fallback when not yet cached.
    if (!isNavigation) {
      const cached = await cache.match(request);
      if (cached) return cached;

      const cleanURL = new URL(request.url);
      cleanURL.search = "";
      const cleanCached = await cache.match(cleanURL.href);
      if (cleanCached) return cleanCached;
    }

    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;

      const cleanURL = new URL(request.url);
      cleanURL.search = "";
      const fallback = await cache.match(cleanURL.href);
      if (fallback) return fallback;

      return new Response(
        "This FundsIQ page is not available offline. Please reconnect to the internet.",
        {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }
      );
    }
  })());
});
