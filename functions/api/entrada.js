import { addHistory, applyEntry } from "../lib/movements.js";

export async function onRequestPost({ request, env }) {
  const { locationId, productId, quantity, productName } = await request.json().catch(() => ({}));
  if (!locationId || !productId || !quantity) {
    return new Response(JSON.stringify({ error: "payload inválido" }), { status: 400 });
  }
  const loc = String(locationId);
  const pid = Number(productId);
  const qty = Number(quantity);

  await applyEntry(env, { locationId: loc, productId: pid, quantity: qty });

  await addHistory(env, "ENTRADA", `+${qty} caixas de ${productName || pid} em ${loc}`);
  return Response.json({ ok: true });
}
