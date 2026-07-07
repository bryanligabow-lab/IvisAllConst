/* Service worker de CREACOM (PWA).
   - Precarga el shell mínimo.
   - Navegaciones: network-first con fallback a caché (para abrir offline lo ya visto).
   - Estáticos same-origin: stale-while-revalidate.
   - Las llamadas al backend (otro dominio) pasan directo, nunca se cachean. */
const CACHE = 'creacom-v1';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Solo same-origin: las llamadas a la API (otro dominio) pasan directo.
  if (url.origin !== self.location.origin) return;

  // Navegaciones (abrir páginas): red primero, si no hay, lo cacheado.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Estáticos: responde de caché y actualiza en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
