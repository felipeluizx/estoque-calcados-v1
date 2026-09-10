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

  const isLegacy = url.pathname === '/index.html' || url.pathname === '/index';
  const isMainApp = ['/app.html', '/app', '/v2.html', '/v2'].includes(url.pathname);
  const isV2Utility = ['/products.html', '/products', '/precos.html', '/precos'].includes(url.pathname);

  if (isLegacy) {
    const script = '<script src="/js/price-admin-bridge.js?v=20260910-5" defer></script>';
    if (!html.includes('/js/price-admin-bridge.js')) {
      html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  if (isMainApp || isV2Utility) {
    const css = '<link rel="stylesheet" href="/css/v2-global-fixes.css?v=20260910-1">';
    if (!html.includes('/css/v2-global-fixes.css')) {
      html = html.includes('</head>') ? html.replace('</head>', `${css}</head>`) : `${css}${html}`;
    }
  }

  if (isMainApp) {
    const script = '<script src="/js/products-entry.js?v=20260910-2" defer></script>';
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
