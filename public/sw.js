/* Action & Quality service worker: the site opens and works fully offline.
   - Precaches the app shell at install (index.html, icons, manifest).
   - Hashed assets are cache-first (immutable).
   - Navigations: network first, cached shell offline. */
const CACHE = "aq-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/icon.svg",
  "/icon-maskable.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Precache the shell so the very first offline open still works.
      await Promise.allSettled(
        SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Vite emits hashed, immutable asset filenames — cache first.
  if (
    url.pathname.startsWith("/assets/") ||
    ["/icon.svg", "/icon-maskable.svg", "/manifest.webmanifest"].includes(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // App shell: network first, cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep the freshest shell in the cache for the next offline open.
          caches
            .open(CACHE)
            .then((cache) => cache.put("/index.html", response.clone()));
          return response;
        })
        .catch(() =>
          caches
            .open(CACHE)
            .then((cache) => cache.match("/index.html"))
            .then((hit) => hit ?? Response.error()),
        ),
    );
  }
});
