export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/') {
    return Response.redirect(new URL('/app.html', url.origin).toString(), 302);
  }

  if (request.method === 'GET' && (url.pathname === '/legacy' || url.pathname === '/legacy.html')) {
    return Response.redirect(new URL('/index.html?legacy=20260910-3', url.origin).toString(), 302);
  }

  const response = await context.next();
  if (request.method !== 'GET') return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');

  if (url.pathname === '/index.html') {
    const script = '<script src="/js/price-admin-bridge.js?v=20260910-5" defer></script>';
    if (!html.includes('/js/price-admin-bridge.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  if (url.pathname === '/app.html' || url.pathname === '/v2.html') {
    const script = '<script src="/js/products-entry.js?v=20260910-1" defer></script>';
    if (!html.includes('/js/products-entry.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
