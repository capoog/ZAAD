/* Fahm & Zaatar service worker: installable PWA + resilient on flaky mobile data.
 * - Static assets (Next chunks, fonts, brand art): cache-first.
 * - Pages: network-first, falling back to the cached copy, then /offline.html.
 * - Never caches API calls, server actions, admin, checkout or payment pages. */
const VERSION = "fz-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/brand/logo.svg", "/brand/app-icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const NEVER = /^\/(api|admin|en\/admin|checkout|en\/checkout|pay|en\/pay|orders|en\/orders)(\/|$)/;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NEVER.test(url.pathname) || req.headers.get("next-action")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/art/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/_next/image")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE))),
    );
  }
});
