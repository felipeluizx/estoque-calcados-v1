export async function onRequestGet({ env }) {
  const data = {
    ok: true,
    adminPasswordConfigured: Boolean(env?.ADMIN_PASSWORD),
    adminUsernameConfigured: Boolean(env?.ADMIN_USERNAME || env?.ADMIN_USER),
    kvBindingConfigured: Boolean(env?.KV_BINDING || env?.ESTOQUE_DB),
    d1BindingConfigured: Boolean(env?.DB),
    cryptoAvailable: Boolean(globalThis.crypto?.subtle),
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
