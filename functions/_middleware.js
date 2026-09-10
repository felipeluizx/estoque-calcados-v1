export async function onRequest(context) {
  const response = await context.next();
  const request = context.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');

  if (['/', '/index.html'].includes(url.pathname)) {
    const script = '<script src="/js/price-admin-bridge.js?v=20260910-2" defer></script>';
    if (!html.includes('/js/price-admin-bridge.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  if (url.pathname === '/v2.html') {
    const script = '<script src="/js/v2-official-fix.js?v=20260910-1" defer></script>';
    if (!html.includes('/js/v2-official-fix.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
