export async function onRequest(context) {
  const response = await context.next();
  const request = context.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !['/', '/index.html'].includes(url.pathname)) {
    return response;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  if (html.includes('/js/price-admin-bridge.js')) {
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }

  const script = '<script src="/js/price-admin-bridge.js?v=20260910-1" defer></script>';
  const enhanced = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');

  return new Response(enhanced, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
