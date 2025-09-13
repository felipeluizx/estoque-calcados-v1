// functions/api/estoque.js
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function onRequestOptions() {
  return new Response(null, { headers: cors });
}

export async function onRequestGet(context) {
  const { ESTOQUE_DB } = context.env;
  const [inventory, history] = await Promise.all([
    ESTOQUE_DB.get("inventory", "json"),
    ESTOQUE_DB.get("history", "json"),
  ]);
  return new Response(JSON.stringify({
    inventory: Array.isArray(inventory) ? inventory : [],
    history: Array.isArray(history) ? history : []
  }), { headers: { "Content-Type": "application/json", ...cors }});
}

export async function onRequestPost(context) {
  const { ESTOQUE_DB } = context.env;
  const body = await context.request.json().catch(() => ({}));
  const inventory = Array.isArray(body.inventory) ? body.inventory : [];
  const history = Array.isArray(body.history) ? body.history : [];

  await Promise.all([
    ESTOQUE_DB.put("inventory", JSON.stringify(inventory)),
    ESTOQUE_DB.put("history", JSON.stringify(history)),
  ]);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", ...cors }
  });
}
