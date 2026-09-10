import { requireAdmin, unauthorized } from "../lib/admin-auth.js";
import { ensureV2Schema } from "../lib/v2-schema.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestGet({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    await ensureV2Schema(env);
    const url = new URL(request.url);
    const productId = Number(url.searchParams.get("product_id") || 0);
    const customerId = Number(url.searchParams.get("customer_id") || 0);
    const orderItemId = Number(url.searchParams.get("order_item_id") || 0);
    const receivableId = Number(url.searchParams.get("receivable_id") || 0);

    if (productId) {
      const price = await env.DB.prepare(`SELECT product_id, base_price, updated_at FROM product_prices WHERE product_id=?`).bind(productId).first();
      const { results } = await env.DB.prepare(`
        SELECT
          oi.id AS order_item_id, oi.order_id, oi.product_id, oi.quantity_ordered, oi.quantity_cancelled,
          oi.unit_price, oi.base_unit_price, oi.discount_percent, oi.notes AS item_notes,
          o.pc, o.order_date, o.due_date, o.priority, o.notes AS order_notes, o.manually_closed_at,
          c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
          COALESCE((SELECT SUM(pm.quantity) FROM production_movements pm WHERE pm.order_item_id=oi.id),0) AS quantity_produced
        FROM order_items oi
        JOIN orders o ON o.id=oi.order_id
        JOIN customers c ON c.id=o.customer_id
        WHERE oi.product_id=?
        ORDER BY CASE WHEN o.manually_closed_at IS NULL THEN 0 ELSE 1 END, o.priority DESC, COALESCE(o.due_date,o.order_date), o.order_date
      `).bind(productId).all();
      const items = (results || []).map(r => ({...r, quantity_remaining: Math.max(Number(r.quantity_ordered)-Number(r.quantity_cancelled||0)-Number(r.quantity_produced||0),0)}));
      return json({ ok:true, type:"product", product_id:productId, base_price:price?.base_price ?? null, items });
    }

    if (customerId) {
      const customer = await env.DB.prepare(`SELECT id,name,phone,notes,created_at,updated_at FROM customers WHERE id=?`).bind(customerId).first();
      if (!customer) return json({ok:false,error:"Cliente não encontrado."},404);
      const orders = await env.DB.prepare(`
        SELECT o.id,o.pc,o.order_date,o.due_date,o.notes,o.priority,o.manually_closed_at,
          COALESCE(SUM(oi.quantity_ordered),0) quantity_ordered,
          COALESCE(SUM(oi.quantity_cancelled),0) quantity_cancelled,
          COALESCE(SUM((SELECT COALESCE(SUM(pm.quantity),0) FROM production_movements pm WHERE pm.order_item_id=oi.id)),0) quantity_produced,
          COALESCE(SUM(COALESCE(oi.unit_price,0)*oi.quantity_ordered),0) order_value
        FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
        WHERE o.customer_id=? GROUP BY o.id ORDER BY o.order_date DESC
      `).bind(customerId).all();
      const receivables = await env.DB.prepare(`
        SELECT r.*, COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.receivable_id=r.id),0) amount_paid
        FROM receivables r WHERE r.customer_id=? ORDER BY COALESCE(r.due_date,r.created_at) DESC
      `).bind(customerId).all();
      return json({ok:true,type:"customer",customer,orders:orders.results||[],receivables:(receivables.results||[]).map(r=>({...r,amount_remaining:Math.max(Number(r.amount)-Number(r.adjustment||0)-Number(r.amount_paid||0),0)}))});
    }

    if (orderItemId) {
      const item = await env.DB.prepare(`
        SELECT oi.*, o.pc,o.order_date,o.due_date,o.priority,o.notes AS order_notes,o.customer_id,
          c.name AS customer_name,c.phone AS customer_phone,
          COALESCE((SELECT SUM(pm.quantity) FROM production_movements pm WHERE pm.order_item_id=oi.id),0) quantity_produced
        FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN customers c ON c.id=o.customer_id
        WHERE oi.id=?
      `).bind(orderItemId).first();
      if (!item) return json({ok:false,error:"Item não encontrado."},404);
      const movements = await env.DB.prepare(`SELECT id,quantity,notes,created_at FROM production_movements WHERE order_item_id=? ORDER BY created_at DESC,id DESC`).bind(orderItemId).all();
      const base = await env.DB.prepare(`SELECT base_price FROM product_prices WHERE product_id=?`).bind(item.product_id).first();
      return json({ok:true,type:"item",item:{...item,quantity_remaining:Math.max(Number(item.quantity_ordered)-Number(item.quantity_cancelled||0)-Number(item.quantity_produced||0),0)},movements:movements.results||[],product_base_price:base?.base_price??null});
    }

    if (receivableId) {
      const receivable = await env.DB.prepare(`
        SELECT r.*,c.name customer_name,c.phone customer_phone,
          COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.receivable_id=r.id),0) amount_paid
        FROM receivables r JOIN customers c ON c.id=r.customer_id WHERE r.id=?
      `).bind(receivableId).first();
      if (!receivable) return json({ok:false,error:"Cobrança não encontrada."},404);
      const payments = await env.DB.prepare(`SELECT id,amount,payment_date,method,notes,created_at FROM payments WHERE receivable_id=? ORDER BY payment_date DESC,id DESC`).bind(receivableId).all();
      return json({ok:true,type:"receivable",receivable:{...receivable,amount_remaining:Math.max(Number(receivable.amount)-Number(receivable.adjustment||0)-Number(receivable.amount_paid||0),0)},payments:payments.results||[]});
    }

    return json({ok:false,error:"Informe product_id, customer_id, order_item_id ou receivable_id."},400);
  } catch (err) {
    return json({ ok:false, error:err.message },500);
  }
}
