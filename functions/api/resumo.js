const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestGet({ env }) {
  try {
    const production = await env.DB.prepare(`
      SELECT
        COUNT(DISTINCT o.id) AS open_orders,
        COALESCE(SUM(CASE WHEN remaining > 0 THEN remaining ELSE 0 END), 0) AS boxes_pending,
        SUM(CASE WHEN produced > 0 AND remaining > 0 THEN 1 ELSE 0 END) AS partial_items,
        COUNT(DISTINCT CASE WHEN o.due_date IS NOT NULL AND date(o.due_date) < date('now') AND remaining > 0 THEN o.id END) AS overdue_orders
      FROM orders o
      LEFT JOIN (
        SELECT
          oi.id,
          oi.order_id,
          COALESCE(SUM(pm.quantity), 0) AS produced,
          MAX(oi.quantity_ordered - oi.quantity_cancelled - COALESCE((SELECT SUM(pm2.quantity) FROM production_movements pm2 WHERE pm2.order_item_id = oi.id), 0), 0) AS remaining
        FROM order_items oi
        LEFT JOIN production_movements pm ON pm.order_item_id = oi.id
        GROUP BY oi.id
      ) x ON x.order_id = o.id
      WHERE o.manually_closed_at IS NULL
        AND COALESCE(x.remaining, 0) > 0
    `).first();

    const financial = await env.DB.prepare(`
      SELECT
        COUNT(DISTINCT r.customer_id) AS debtor_customers,
        COALESCE(SUM(MAX(r.amount - r.adjustment - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.receivable_id = r.id), 0), 0)), 0) AS amount_receivable
      FROM receivables r
      WHERE r.closed_at IS NULL
    `).first();

    return json({
      ok: true,
      summary: {
        open_orders: Number(production?.open_orders || 0),
        boxes_pending: Number(production?.boxes_pending || 0),
        partial_items: Number(production?.partial_items || 0),
        overdue_orders: Number(production?.overdue_orders || 0),
        debtor_customers: Number(financial?.debtor_customers || 0),
        amount_receivable: Number(financial?.amount_receivable || 0)
      }
    });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
