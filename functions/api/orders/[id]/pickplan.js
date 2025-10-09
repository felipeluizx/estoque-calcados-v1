// functions/api/orders/[id]/pickplan.js
import { json, slotRank } from "../../../_kv";

export const onRequestGet = async ({ env, params }) => {
  const id = params.id;
  const pedido = await env.ESTOQUE_DB.get(`order:${id}`, "json");
  if (!pedido) return json({ ok:false, error:"not found" }, 404);

  // Build map inventory for products involved
  const picks = {};
  const allKeys = await env.ESTOQUE_DB.list({ prefix: "inv:" });
  for (const k of allKeys.keys) {
    const rec = await env.ESTOQUE_DB.get(k.name, "json");
    if (!rec) continue;
    if (!pedido.itens.some(i => Number(i.productId) === Number(rec.productId))) continue;
    const arr = picks[rec.productId] || [];
    arr.push({ locationId: rec.locationId, qty: rec.quantity });
    picks[rec.productId] = arr;
  }

  // Sort picks by slot priority FRENTE > MEIO > FUNDO
  for (const pid of Object.keys(picks)) {
    picks[pid].sort((a,b)=> slotRank(a.locationId) - slotRank(b.locationId));
  }

  // Build plan for missing quantities only
  const plan = pedido.itens.map(it => {
    const need = Math.max(0, Number(it.quantidadePedida) - Number(it.quantidadeSeparada||0));
    const srcs = picks[it.productId] || [];
    let remain = need;
    const take = [];
    for (const src of srcs) {
      if (remain <= 0) break;
      const use = Math.min(remain, Number(src.qty||0));
      if (use > 0) {
        take.push({ locationId: src.locationId, qty: use });
        remain -= use;
      }
    }
    return { productId: it.productId, need, plan: take };
  });

  return json({ ok:true, plan });
};
