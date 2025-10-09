// functions/api/saida.js  (KV-only)
import { json, keyInv, addHistory } from "../_kv";

export const onRequestPost = async ({ env, request }) => {
  const { locationId, productId, quantity, productName } = await request.json().catch(()=>({}));
  if (!locationId || !productId || !quantity) return json({ ok:false, error:"payload inválido" }, 400);

  const key = keyInv(locationId, productId);
  const item = await env.ESTOQUE_DB.get(key, "json");
  if (!item) return json({ ok:false, error:"registro não encontrado" }, 404);

  const qty = Number(quantity);
  if (qty >= item.quantity) {
    await env.ESTOQUE_DB.delete(key);
  } else {
    item.quantity = item.quantity - qty;
    item.lastAccess = new Date().toISOString();
    await env.ESTOQUE_DB.put(key, JSON.stringify(item));
  }

  await addHistory(env, "SAÍDA", `-${qty} de ${productName||productId} de ${locationId}`);
  return json({ ok:true });
};
