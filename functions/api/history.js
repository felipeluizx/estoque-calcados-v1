export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, date, type, details FROM history ORDER BY id DESC LIMIT 500"
  ).all();
  return Response.json(results || []);
}
