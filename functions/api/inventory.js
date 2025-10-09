export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, locationId, productId, quantity FROM inventory"
  ).all();
  return Response.json(results || []);
}
