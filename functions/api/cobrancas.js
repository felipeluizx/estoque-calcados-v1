import { requireAdmin, unauthorized } from "../lib/admin-auth.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestPost({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
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
      if (Number(order.customer_id) !== customerId) return json({ ok: false, error: "O pedido não pertence ao cliente informado." }, 400);
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

export async function onRequestPut({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!id) return json({ok:false,error:"Cobrança inválida."},400);
    const current = await env.DB.prepare(`SELECT * FROM receivables WHERE id=?`).bind(id).first();
    if (!current) return json({ok:false,error:"Cobrança não encontrada."},404);
    const paid = await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) total FROM payments WHERE receivable_id=?`).bind(id).first();
    const amount = body.amount !== undefined ? Number(body.amount) : Number(current.amount);
    if (!Number.isFinite(amount) || amount < Number(paid?.total||0)) return json({ok:false,error:"O valor total não pode ser menor que o valor já pago."},400);
    await env.DB.prepare(`
      UPDATE receivables SET customer_id=?,order_id=?,description=?,amount=?,due_date=?,adjustment=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).bind(
      Number(body.customer_id || current.customer_id),
      body.order_id === undefined ? current.order_id : (body.order_id ? Number(body.order_id) : null),
      body.description !== undefined ? String(body.description||'').trim()||null : current.description,
      amount,
      body.due_date !== undefined ? body.due_date||null : current.due_date,
      body.adjustment !== undefined ? Number(body.adjustment||0) : Number(current.adjustment||0),
      id
    ).run();
    return json({ok:true});
  } catch (err) {
    return json({ok:false,error:err.message},500);
  }
}
