import { addHistory, applyExit } from "../lib/movements.js";

export async function onRequestPost({ request, env }) {
  const { inventoryId, quantity, productName, locationId } = await request.json().catch(() => ({}));
  if (!inventoryId || !quantity) {
    return new Response(JSON.stringify({ error: "payload inválido" }), { status: 400 });
  }

  const id = Number(inventoryId);
  const qty = Number(quantity);

  const result = await applyExit(env, { inventoryId: id, quantity: qty });
  if (!result) return new Response(JSON.stringify({ error: "registro não encontrado" }), { status: 404 });

  const locationLabel = locationId || result.locationId || "";
  const productLabel = productName || result.productId || "";

  await addHistory(env, "SAÍDA", `-${qty} caixas de ${productLabel} de ${locationLabel}`);
  return Response.json({ ok: true });
}
