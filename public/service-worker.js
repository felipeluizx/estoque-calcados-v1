// very small offline-first for static shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('estoque-static-v1').then((cache) => cache.addAll([
      '/',
      '/index.html',
      'https://cdn.tailwindcss.com',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
    ]))
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isAPI = req.url.includes('/api/');
  if (isAPI) return; // don't cache API by default
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const clone = res.clone();
      caches.open('estoque-static-v1').then(c => c.put(req, clone));
      return res;
    }).catch(()=> cached))
  );
});
