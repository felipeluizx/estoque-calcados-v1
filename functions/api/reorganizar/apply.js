// functions/api/reorganizar/apply.js  (KV-only)
import { json, keyInv, addHistory } from "../../_kv";

export const onRequestPost = async ({ env, request }) => {
  const { productId, from, to, qty } = await request.json().catch(()=>({}));
  if (!productId || !from || !to || !qty) return json({ ok:false, error:"payload inválido" }, 400);

  const keyFrom = keyInv(from, productId);
  const itemFrom = await env.ESTOQUE_DB.get(keyFrom, "json");
  if (!itemFrom || itemFrom.quantity < Number(qty)) return json({ ok:false, error:"quantidade insuficiente" }, 400);

  if (Number(qty) === itemFrom.quantity) {
    await env.ESTOQUE_DB.delete(keyFrom);
  } else {
    itemFrom.quantity = itemFrom.quantity - Number(qty);
    await env.ESTOQUE_DB.put(keyFrom, JSON.stringify(itemFrom));
  }

  const keyTo = keyInv(to, productId);
  const itemTo = await env.ESTOQUE_DB.get(keyTo, "json");
  const nowIso = new Date().toISOString();
  if (itemTo) {
    itemTo.quantity = (itemTo.quantity||0) + Number(qty);
    itemTo.lastAccess = nowIso;
    await env.ESTOQUE_DB.put(keyTo, JSON.stringify(itemTo));
  } else {
    await env.ESTOQUE_DB.put(keyTo, JSON.stringify({
      locationId: String(to).toUpperCase(),
      productId: Number(productId),
      quantity: Number(qty),
      lastAccess: nowIso
    }));
  }

  await addHistory(env, "MOVIMENTAÇÃO", `moveu ${qty} do produto #${productId} de ${from} → ${to}`);
  return json({ ok:true });
};
