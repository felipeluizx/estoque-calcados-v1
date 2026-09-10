const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT
        r.id,
        r.customer_id,
        r.order_id,
        r.description,
        r.amount,
        r.due_date,
        r.adjustment,
        r.closed_at,
        r.created_at,
        c.name AS customer_name,
        COALESCE(SUM(p.amount), 0) AS amount_paid
      FROM receivables r
      JOIN customers c ON c.id = r.customer_id
      LEFT JOIN payments p ON p.receivable_id = r.id
      GROUP BY r.id
      ORDER BY
        CASE WHEN r.closed_at IS NULL THEN 0 ELSE 1 END,
        CASE WHEN r.due_date IS NOT NULL AND date(r.due_date) < date('now') THEN 0 ELSE 1 END,
        COALESCE(r.due_date, r.created_at) ASC
    `).all();

    const receivables = (results || []).map(r => {
      const total = Number(r.amount || 0);
      const paid = Number(r.amount_paid || 0);
      const adjustment = Number(r.adjustment || 0);
      const remaining = Math.max(total - paid - adjustment, 0);
      let status = "open";
      if (remaining === 0 || r.closed_at) status = "paid";
      else if (paid > 0 || adjustment > 0) status = "partial";
      if (r.due_date && new Date(`${String(r.due_date).slice(0,10)}T23:59:59`) < new Date() && remaining > 0) status = "overdue";
      return { ...r, amount_remaining: remaining, financial_status: status };
    });

    return json({ ok: true, receivables });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const receivableId = Number(body.receivable_id);
    const amount = Number(body.amount);
    if (!receivableId || amount <= 0) {
      return json({ ok: false, error: "Cobrança e valor são obrigatórios." }, 400);
    }

    const rec = await env.DB.prepare(`
      SELECT
        r.id, r.amount, r.adjustment,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.receivable_id = r.id), 0) AS amount_paid
      FROM receivables r
      WHERE r.id = ?
    `).bind(receivableId).first();

    if (!rec) return json({ ok: false, error: "Cobrança não encontrada." }, 404);

    const remaining = Math.max(Number(rec.amount) - Number(rec.adjustment || 0) - Number(rec.amount_paid || 0), 0);
    if (amount > remaining) {
      return json({ ok: false, error: `Valor maior que o saldo pendente (R$ ${remaining.toFixed(2)}).` }, 400);
    }

    const payment = await env.DB.prepare(`
      INSERT INTO payments (receivable_id, amount, payment_date, method, notes)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id, receivable_id, amount, payment_date, method, notes, created_at
    `).bind(
      receivableId,
      amount,
      body.payment_date || new Date().toISOString(),
      body.method ? String(body.method).trim() : null,
      body.notes ? String(body.notes).trim() : null
    ).first();

    const newRemaining = remaining - amount;
    if (newRemaining === 0) {
      await env.DB.prepare(`UPDATE receivables SET closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(receivableId).run();
    }

    return json({ ok: true, payment, amount_remaining: newRemaining }, 201);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
