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
    const { results } = await env.DB.prepare(`
      SELECT oi.id AS order_item_id,oi.order_id,oi.product_id,oi.quantity_ordered,oi.quantity_cancelled,oi.unit_price,oi.base_unit_price,oi.discount_percent,oi.notes AS item_notes,
        o.pc,o.order_date,o.due_date,o.priority,o.notes AS order_notes,c.id AS customer_id,c.name AS customer_name,c.phone AS customer_phone,
        COALESCE(SUM(pm.quantity),0) AS quantity_produced
      FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN customers c ON c.id=o.customer_id
      LEFT JOIN production_movements pm ON pm.order_item_id=oi.id
      WHERE o.manually_closed_at IS NULL GROUP BY oi.id
      ORDER BY o.priority DESC,CASE WHEN o.due_date IS NOT NULL AND datetime(o.due_date)<datetime('now') THEN 0 ELSE 1 END,COALESCE(o.due_date,o.order_date) ASC,o.order_date ASC
    `).all();
    const items=(results||[]).map(item=>{const ordered=Number(item.quantity_ordered||0),produced=Number(item.quantity_produced||0),cancelled=Number(item.quantity_cancelled||0),remaining=Math.max(ordered-produced-cancelled,0);let status='pending';if(remaining===0)status='completed';else if(produced>0||cancelled>0)status='partial';return {...item,quantity_remaining:remaining,production_status:status,line_total:item.unit_price==null?null:Number(item.unit_price)*ordered}});
    return json({ok:true,items});
  } catch (err) { return json({ok:false,error:err.message},500); }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    const body=await request.json().catch(()=>({})),orderItemId=Number(body.order_item_id),quantity=Number(body.quantity);
    if(!orderItemId||quantity<=0)return json({ok:false,error:"Item e quantidade são obrigatórios."},400);
    const item=await env.DB.prepare(`SELECT oi.id,oi.quantity_ordered,oi.quantity_cancelled,COALESCE((SELECT SUM(pm.quantity) FROM production_movements pm WHERE pm.order_item_id=oi.id),0) AS quantity_produced FROM order_items oi WHERE oi.id=?`).bind(orderItemId).first();
    if(!item)return json({ok:false,error:"Item do pedido não encontrado."},404);
    const remaining=Math.max(Number(item.quantity_ordered)-Number(item.quantity_cancelled||0)-Number(item.quantity_produced||0),0);
    if(quantity>remaining)return json({ok:false,error:`Quantidade maior que o saldo pendente (${remaining}).`},400);
    const movement=await env.DB.prepare(`INSERT INTO production_movements (order_item_id,quantity,notes) VALUES (?,?,?) RETURNING id,order_item_id,quantity,notes,created_at`).bind(orderItemId,quantity,body.notes?String(body.notes).trim():null).first();
    const newRemaining=remaining-quantity;return json({ok:true,movement,quantity_remaining:newRemaining,production_status:newRemaining===0?'completed':'partial'},201);
  } catch (err) { return json({ok:false,error:err.message},500); }
}

export async function onRequestDelete({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return unauthorized();
    const url=new URL(request.url);let id=Number(url.searchParams.get('id')||0);if(!id){const body=await request.json().catch(()=>({}));id=Number(body.id||0)}
    if(!id)return json({ok:false,error:'Movimentação inválida.'},400);
    const movement=await env.DB.prepare(`SELECT id,order_item_id,quantity FROM production_movements WHERE id=?`).bind(id).first();if(!movement)return json({ok:false,error:'Movimentação não encontrada.'},404);
    await env.DB.prepare(`DELETE FROM production_movements WHERE id=?`).bind(id).run();
    return json({ok:true,deleted_id:id,order_item_id:movement.order_item_id,quantity:movement.quantity});
  } catch (err) { return json({ok:false,error:err.message},500); }
}
