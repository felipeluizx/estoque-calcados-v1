const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT
        o.id, o.pc, o.order_date, o.due_date, o.notes, o.priority, o.manually_closed_at,
        c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
        COUNT(oi.id) AS item_count,
        COALESCE(SUM(oi.quantity_ordered), 0) AS quantity_ordered,
        COALESCE(SUM(oi.quantity_cancelled), 0) AS quantity_cancelled,
        COALESCE(SUM((SELECT COALESCE(SUM(pm.quantity),0) FROM production_movements pm WHERE pm.order_item_id = oi.id)), 0) AS quantity_produced
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY
        CASE WHEN o.manually_closed_at IS NULL THEN 0 ELSE 1 END,
        o.priority DESC,
        COALESCE(o.due_date, o.order_date) ASC,
        o.order_date ASC
    `).all();

    const orders = (results || []).map(o => {
      const ordered = Number(o.quantity_ordered || 0);
      const produced = Number(o.quantity_produced || 0);
      const cancelled = Number(o.quantity_cancelled || 0);
      const remaining = Math.max(ordered - produced - cancelled, 0);
      let production_status = "pending";
      if (ordered > 0 && remaining === 0) production_status = "completed";
      else if (produced > 0 || cancelled > 0) production_status = "partial";
      if (o.manually_closed_at) production_status = "closed";
      return { ...o, quantity_remaining: remaining, production_status };
    });

    return json({ ok: true, orders });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
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

    const statements = items.map(item => env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity_ordered, unit_price, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      order.id,
      Number(item.product_id),
      Number(item.quantity_ordered),
      item.unit_price === undefined || item.unit_price === null || item.unit_price === "" ? null : Number(item.unit_price),
      item.notes ? String(item.notes).trim() : null,
      now
    ));
    await env.DB.batch(statements);

    return json({ ok: true, order }, 201);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
