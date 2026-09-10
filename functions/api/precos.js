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

function normalizePrice(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Preço base inválido.");
  return n;
}

async function saveOne(env, productId, basePrice) {
  await env.DB.prepare(`
    INSERT INTO product_prices (product_id, base_price, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO UPDATE SET
      base_price=excluded.base_price,
      updated_at=CURRENT_TIMESTAMP
  `).bind(productId, basePrice).run();
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

async function handleSave({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    await ensureTable(env);
    const body = await request.json().catch(() => ({}));
    const bulkItems = Array.isArray(body.items) ? body.items : (Array.isArray(body.prices) ? body.prices : null);

    if (bulkItems) {
      if (!bulkItems.length) return json({ ok: false, error: "Nenhum SKU informado." }, 400);
      if (bulkItems.length > 1000) return json({ ok: false, error: "Limite de 1000 itens por operação." }, 400);

      const normalized = bulkItems.map(item => {
        const productId = Number(item.product_id);
        if (!productId) throw new Error("Há um SKU/produto inválido na seleção.");
        return { productId, basePrice: normalizePrice(item.base_price) };
      });

      const statements = normalized.map(({ productId, basePrice }) => env.DB.prepare(`
        INSERT INTO product_prices (product_id, base_price, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(product_id) DO UPDATE SET
          base_price=excluded.base_price,
          updated_at=CURRENT_TIMESTAMP
      `).bind(productId, basePrice));

      await env.DB.batch(statements);
      return json({ ok: true, updated: normalized.length });
    }

    const productId = Number(body.product_id);
    if (!productId) return json({ ok: false, error: "SKU/produto inválido." }, 400);
    const basePrice = normalizePrice(body.base_price);
    await saveOne(env, productId, basePrice);
    return json({ ok: true, product_id: productId, base_price: basePrice });
  } catch (err) {
    return json({ ok: false, error: err.message }, 400);
  }
}

export const onRequestPut = handleSave;
export const onRequestPost = handleSave;
