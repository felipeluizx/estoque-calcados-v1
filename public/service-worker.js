const CACHE_NAME = 'estoque-static-v3';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.startsWith('/api/')) return;

  // HTML e arquivos principais sempre vêm da rede. Isso evita que a V2
  // substitua o estoque legado ou que uma versão antiga fique presa no cache.
  const networkOnly =
    req.mode === 'navigate' ||
    ['/', '/app.html', '/v2.html', '/index.html', '/legacy', '/legacy.html', '/precos.html'].includes(url.pathname) ||
    url.pathname.startsWith('/js/v2') ||
    url.pathname.startsWith('/css/v2');

  if (networkOnly) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  event.respondWith(fetch(req));
});
