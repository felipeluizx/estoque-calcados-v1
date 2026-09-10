export async function ensureV2Schema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS product_prices (
    product_id INTEGER PRIMARY KEY,
    base_price REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const info = await env.DB.prepare(`PRAGMA table_info(order_items)`).all();
  const cols = new Set((info.results || []).map(r => r.name));
  if (!cols.has('base_unit_price')) {
    await env.DB.prepare(`ALTER TABLE order_items ADD COLUMN base_unit_price REAL`).run();
  }
  if (!cols.has('discount_percent')) {
    await env.DB.prepare(`ALTER TABLE order_items ADD COLUMN discount_percent REAL`).run();
  }
}
