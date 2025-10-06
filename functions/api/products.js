
export const onRequestGet = async ({ env }) => {
  const KV = env.KV || env.ESTOQUE_DB;
  const s = await KV.get('products');
  return new Response(s || '[]', { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
