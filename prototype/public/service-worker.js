const CACHE_NAME = "salon-rdv-cache-v1";
// Ce service worker ne couvre volontairement que la lecture (navigation + /api/search) — ADR-004,
// fidélité « mesurée ». Les écritures (réservations) sont mises en file côté client
// (voir src/lib/offlineQueue.ts) et rejouées manuellement au retour du réseau : pas d'API
// Background Sync, mal supportée hors Chromium.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isCacheable(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (request.mode === "navigate") return true;
  if (url.pathname.startsWith("/api/search")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!isCacheable(event.request, url)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }
        return new Response(
          JSON.stringify({ offline: true, error: "Aucune donnée en cache pour cette page." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
  );
});
