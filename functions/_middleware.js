export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/') {
    return Response.redirect(new URL('/v2.html', url.origin).toString(), 302);
  }

  const response = await context.next();

  if (request.method !== 'GET') return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');

  if (url.pathname === '/index.html' || url.pathname === '/legacy') {
    const script = '<script src="/js/price-admin-bridge.js?v=20260910-3" defer></script>';
    if (!html.includes('/js/price-admin-bridge.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  if (url.pathname === '/v2.html') {
    const scripts = '<script src="/js/v2-official-fix.js?v=20260910-2" defer></script><script src="/js/v2-round2.js?v=20260910-1" defer></script>';
    if (!html.includes('/js/v2-round2.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${scripts}</body>`) : `${html}${scripts}`;
    }
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
