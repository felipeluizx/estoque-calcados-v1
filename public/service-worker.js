const CACHE_NAME = 'estoque-pwa-v4';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const networkOnly =
    req.mode === 'navigate' ||
    ['/', '/app', '/app.html', '/v2.html', '/index.html', '/legacy', '/legacy.html', '/precos.html', '/products.html', '/manifest.webmanifest'].includes(url.pathname) ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/css/');

  if (networkOnly) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
