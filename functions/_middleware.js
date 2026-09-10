export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/') {
    return Response.redirect(new URL('/v2.html', url.origin).toString(), 302);
  }

  if (request.method === 'GET' && (url.pathname === '/legacy' || url.pathname === '/legacy.html')) {
    const legacyUrl = new URL('/index.html', url.origin);
    const legacyRequest = new Request(legacyUrl.toString(), request);
    const legacyResponse = await context.next(legacyRequest);
    const contentType = legacyResponse.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return legacyResponse;
    let html = await legacyResponse.text();
    const script = '<script src="/js/price-admin-bridge.js?v=20260910-4" defer></script>';
    if (!html.includes('/js/price-admin-bridge.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
    const headers = new Headers(legacyResponse.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    return new Response(html, { status: 200, headers });
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
    const script = '<script src="/js/price-admin-bridge.js?v=20260910-4" defer></script>';
    if (!html.includes('/js/price-admin-bridge.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
