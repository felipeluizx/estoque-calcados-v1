import { requireAdmin, unauthorized } from "../lib/admin-auth.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

async function ensureTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS product_prices (
    product_id INTEGER PRIMARY KEY,
    base_price REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function onRequestGet({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    await ensureTable(env);
    const { results } = await env.DB.prepare(`SELECT product_id, base_price, updated_at FROM product_prices ORDER BY product_id`).all();
    return json({ ok: true, prices: results || [] });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    await ensureTable(env);
    const body = await request.json().catch(() => ({}));
    const productId = Number(body.product_id);
    const basePrice = body.base_price === "" || body.base_price === null || body.base_price === undefined ? null : Number(body.base_price);
    if (!productId) return json({ ok: false, error: "SKU/produto inválido." }, 400);
    if (basePrice !== null && (!Number.isFinite(basePrice) || basePrice < 0)) return json({ ok: false, error: "Preço base inválido." }, 400);
    await env.DB.prepare(`
      INSERT INTO product_prices (product_id, base_price, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(product_id) DO UPDATE SET base_price=excluded.base_price, updated_at=CURRENT_TIMESTAMP
    `).bind(productId, basePrice).run();
    return json({ ok: true, product_id: productId, base_price: basePrice });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
