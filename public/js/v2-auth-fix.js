// Preview auth guard: keep the app visible and expose the endpoint that rejected the token.
// Loaded after v2.js so it replaces the generic API helper during preview testing.
api = async function(url, opts = {}) {
  const t = token();
  const headers = {
    'content-type': 'application/json',
    ...(t ? { authorization: `Bearer ${t}` } : {}),
    ...(opts.headers || {})
  };
  const r = await fetch(url, { ...opts, headers, cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/admin-login') {
    throw new Error(`Sessão rejeitada por ${url}. HTTP 401.`);
  }
  if (!r.ok || d.ok === false) {
    throw new Error(d.error || `${url}: erro HTTP ${r.status}`);
  }
  return d;
};

document.documentElement.dataset.v2Preview = 'true';
