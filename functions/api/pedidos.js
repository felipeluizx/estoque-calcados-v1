import { requireAdmin, unauthorized } from "../lib/admin-auth.js";
import { ensureV2Schema } from "../lib/v2-schema.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

const nullableNumber = value => value === undefined || value === null || value === "" ? null : Number(value);

function mapOrder(o) {
  const ordered = Number(o.quantity_ordered || 0);
  const produced = Number(o.quantity_produced || 0);
  const cancelled = Number(o.quantity_cancelled || 0);
  const remaining = Math.max(ordered - produced - cancelled, 0);
  let production_status = "pending";
  if (ordered > 0 && remaining === 0) production_status = "completed";
  else if (produced > 0 || cancelled > 0) production_status = "partial";
  if (o.manually_closed_at) production_status = "closed";
  return { ...o, quantity_remaining: remaining, production_status };
}

export async function onRequestGet({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    await ensureV2Schema(env);
    const url = new URL(request.url);
    const orderId = Number(url.searchParams.get("id") || 0);
    const baseSql = `
      SELECT
        o.id, o.pc, o.order_date, o.due_date, o.notes, o.priority, o.manually_closed_at,
        c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
        COUNT(oi.id) AS item_count,
        COALESCE(SUM(oi.quantity_ordered), 0) AS quantity_ordered,
        COALESCE(SUM(oi.quantity_cancelled), 0) AS quantity_cancelled,
        COALESCE(SUM((SELECT COALESCE(SUM(pm.quantity),0) FROM production_movements pm WHERE pm.order_item_id = oi.id)), 0) AS quantity_produced,
        COALESCE(SUM(COALESCE(oi.unit_price,0) * oi.quantity_ordered), 0) AS order_value
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
    `;

    let query;
    if (orderId) {
      query = await env.DB.prepare(`${baseSql} WHERE o.id = ? GROUP BY o.id`).bind(orderId).all();
    } else {
      query = await env.DB.prepare(`${baseSql}
        GROUP BY o.id
        ORDER BY CASE WHEN o.manually_closed_at IS NULL THEN 0 ELSE 1 END,
                 o.priority DESC,
                 COALESCE(o.due_date, o.order_date) ASC,
                 o.order_date ASC
      `).all();
    }

    const orders = (query.results || []).map(mapOrder);
    return json({ ok: true, orders, order: orderId ? orders[0] || null : undefined });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    await ensureV2Schema(env);
    const body = await request.json().catch(() => ({}));
    const customerId = Number(body.customer_id);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!customerId) return json({ ok: false, error: "Cliente é obrigatório." }, 400);
    if (!items.length) return json({ ok: false, error: "Adicione pelo menos um item ao pedido." }, 400);

    for (const item of items) {
      if (!Number(item.product_id) || Number(item.quantity_ordered) <= 0) {
        return json({ ok: false, error: "Todo item precisa de produto e quantidade válida." }, 400);
      }
    }

    const now = new Date().toISOString();
    const order = await env.DB.prepare(`
      INSERT INTO orders (customer_id, pc, order_date, due_date, notes, priority, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id, customer_id, pc, order_date, due_date, notes, priority
    `).bind(
      customerId,
      body.pc ? String(body.pc).trim() : null,
      body.order_date || now,
      body.due_date || null,
      body.notes ? String(body.notes).trim() : null,
      Number(body.priority || 0),
      now
    ).first();

    const statements = items.map(item => {
      const base = nullableNumber(item.base_unit_price);
      const finalPrice = nullableNumber(item.unit_price);
      const discount = base && finalPrice !== null ? Math.max(0, (1 - finalPrice / base) * 100) : nullableNumber(item.discount_percent);
      return env.DB.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity_ordered, unit_price, base_unit_price, discount_percent, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        order.id,
        Number(item.product_id),
        Number(item.quantity_ordered),
        finalPrice,
        base,
        discount,
        item.notes ? String(item.notes).trim() : null,
        now
      );
    });
    await env.DB.batch(statements);

    return json({ ok: true, order }, 201);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    await ensureV2Schema(env);
    const body = await request.json().catch(() => ({}));
    const type = body.type || "order";

    if (type === "order") {
      const id = Number(body.id);
      if (!id) return json({ ok: false, error: "Pedido inválido." }, 400);
      const current = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
      if (!current) return json({ ok: false, error: "Pedido não encontrado." }, 404);
      await env.DB.prepare(`
        UPDATE orders SET customer_id=?, pc=?, order_date=?, due_date=?, notes=?, priority=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
      `).bind(
        Number(body.customer_id || current.customer_id),
        body.pc !== undefined ? String(body.pc || "").trim() || null : current.pc,
        body.order_date || current.order_date,
        body.due_date !== undefined ? body.due_date || null : current.due_date,
        body.notes !== undefined ? String(body.notes || "").trim() || null : current.notes,
        body.priority !== undefined ? Number(body.priority || 0) : current.priority,
        id
      ).run();
      return json({ ok: true });
    }

    if (type === "item") {
      const id = Number(body.id);
      if (!id) return json({ ok: false, error: "Item inválido." }, 400);
      const current = await env.DB.prepare(`
        SELECT oi.*, COALESCE((SELECT SUM(quantity) FROM production_movements WHERE order_item_id=oi.id),0) AS produced
        FROM order_items oi WHERE oi.id=?
      `).bind(id).first();
      if (!current) return json({ ok: false, error: "Item não encontrado." }, 404);

      const qty = body.quantity_ordered !== undefined ? Number(body.quantity_ordered) : Number(current.quantity_ordered);
      const produced = Number(current.produced || 0);
      if (qty < produced + Number(current.quantity_cancelled || 0)) {
        return json({ ok: false, error: `A quantidade não pode ser menor que ${produced + Number(current.quantity_cancelled || 0)}, pois já há produção/cancelamento registrado.` }, 400);
      }
      const base = body.base_unit_price !== undefined ? nullableNumber(body.base_unit_price) : nullableNumber(current.base_unit_price);
      const finalPrice = body.unit_price !== undefined ? nullableNumber(body.unit_price) : nullableNumber(current.unit_price);
      const discount = base && finalPrice !== null ? Math.max(0, (1 - finalPrice / base) * 100) : nullableNumber(body.discount_percent ?? current.discount_percent);

      await env.DB.prepare(`
        UPDATE order_items SET product_id=?, quantity_ordered=?, unit_price=?, base_unit_price=?, discount_percent=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
      `).bind(
        Number(body.product_id || current.product_id), qty, finalPrice, base, discount,
        body.notes !== undefined ? String(body.notes || "").trim() || null : current.notes,
        id
      ).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: "Tipo de edição inválido." }, 400);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
