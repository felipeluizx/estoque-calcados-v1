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
    if (!html.includes('/js/price-admin-bridge.js')) html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
  }

  if (isMainApp || isV2Utility) {
    const css1 = '<link rel="stylesheet" href="/css/v2-global-fixes.css?v=20260910-1">';
    const css2 = '<link rel="stylesheet" href="/css/theme-hardening.css?v=20260910-1">';
    if (!html.includes('/css/v2-global-fixes.css')) html = html.includes('</head>') ? html.replace('</head>', `${css1}</head>`) : `${css1}${html}`;
    if (!html.includes('/css/theme-hardening.css')) html = html.includes('</head>') ? html.replace('</head>', `${css2}</head>`) : `${css2}${html}`;
  }

  if (isMainApp) {
    const gradeCss = '<link rel="stylesheet" href="/css/grade-order.css?v=20260910-2">';
    const refreshCss = '<link rel="stylesheet" href="/css/live-refresh-variation.css?v=20260910-3">';
    const compactCss = '<link rel="stylesheet" href="/css/compact-details.css?v=20260910-2">';
    const groupingCss = '<link rel="stylesheet" href="/css/order-grouping.css?v=20260910-1">';
    const mobileUxCss = '<link rel="stylesheet" href="/css/mobile-ux-hardening.css?v=20260910-2">';
    for (const css of [gradeCss, refreshCss, compactCss, groupingCss, mobileUxCss]) {
      const href = css.match(/href="([^"]+)/)?.[1];
      if (href && !html.includes(href)) html = html.includes('</head>') ? html.replace('</head>', `${css}</head>`) : `${css}${html}`;
    }

    const productsScript = '<script src="/js/products-entry.js?v=20260910-3" defer></script>';
    const cardScript = '<script src="/js/card-customizer.js?v=20260910-4" defer></script>';
    const compatScript = '<script src="/js/card-compat.js?v=20260910-1" defer></script>';
    const gradeScript = '<script src="/js/grade-order.js?v=20260910-2" defer></script>';
    const refreshScript = '<script src="/js/live-refresh-variation.js?v=20260910-5" defer></script>';
    const deleteScript = '<script src="/js/delete-controls.js?v=20260910-1" defer></script>';
    const compactScript = '<script src="/js/compact-details.js?v=20260910-2" defer></script>';
    const groupingScript = '<script src="/js/order-grouping.js?v=20260910-1" defer></script>';
    const mobileUxScript = '<script src="/js/mobile-ux-hardening.js?v=20260910-1" defer></script>';
    for (const script of [productsScript, cardScript, compatScript, gradeScript, refreshScript, deleteScript, compactScript, groupingScript, mobileUxScript]) {
      const src = script.match(/src="([^"]+)/)?.[1];
      if (src && !html.includes(src)) html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    }
  }

  if (isV2Utility) {
    const script = '<script src="/js/theme-sync.js?v=20260910-1"></script>';
    if (!html.includes('/js/theme-sync.js')) html = html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : `${script}${html}`;
  }

  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
