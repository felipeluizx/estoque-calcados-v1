// functions/api/entrada.js  (KV-only)
import { json, keyInv, addHistory } from "../_kv";

export const onRequestPost = async ({ env, request }) => {
  const { locationId, productId, quantity, productName } = await request.json().catch(()=>({}));
  if (!locationId || !productId || !quantity) return json({ ok:false, error:"payload inválido" }, 400);

  const key = keyInv(locationId, productId);
  const nowIso = new Date().toISOString();
  const current = await env.ESTOQUE_DB.get(key, "json");
  const qty = Number(quantity);

  const next = {
    locationId: String(locationId).toUpperCase(),
    productId: Number(productId),
    quantity: Math.max(0, (current?.quantity || 0) + qty),
    lastAccess: nowIso,
    productName: productName || current?.productName || ""
  };

  await env.ESTOQUE_DB.put(key, JSON.stringify(next));
  await addHistory(env, "ENTRADA", `+${qty} de ${productName||productId} em ${locationId}`);
  return json({ ok:true, item: next });
};
