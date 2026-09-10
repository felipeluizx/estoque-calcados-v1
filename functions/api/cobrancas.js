const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const customerId = Number(body.customer_id);
    const orderId = body.order_id ? Number(body.order_id) : null;
    const amount = Number(body.amount);

    if (!customerId || amount < 0 || Number.isNaN(amount)) {
      return json({ ok: false, error: "Cliente e valor válido são obrigatórios." }, 400);
    }

    if (orderId) {
      const order = await env.DB.prepare(`SELECT id, customer_id FROM orders WHERE id = ?`).bind(orderId).first();
      if (!order) return json({ ok: false, error: "Pedido não encontrado." }, 404);
      if (Number(order.customer_id) !== customerId) {
        return json({ ok: false, error: "O pedido não pertence ao cliente informado." }, 400);
      }
    }

    const receivable = await env.DB.prepare(`
      INSERT INTO receivables (customer_id, order_id, description, amount, due_date, adjustment)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id, customer_id, order_id, description, amount, due_date, adjustment, created_at
    `).bind(
      customerId,
      orderId,
      body.description ? String(body.description).trim() : null,
      amount,
      body.due_date || null,
      Number(body.adjustment || 0)
    ).first();

    return json({ ok: true, receivable }, 201);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
