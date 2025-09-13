async function addHistory(env, type, details) {
  await env.DB.prepare(
    "INSERT INTO history(date, type, details) VALUES (?, ?, ?)"
  ).bind(new Date().toISOString(), type, details).run();
}

export async function onRequestPost({ request, env }) {
  const { locationId, productId, quantity, productName } = await request.json().catch(() => ({}));
  if (!locationId || !productId || !quantity) {
    return new Response(JSON.stringify({ error: "payload inválido" }), { status: 400 });
  }
  const loc = String(locationId);
  const pid = Number(productId);
  const qty = Number(quantity);

  const existing = await env.DB
    .prepare("SELECT id, quantity FROM inventory WHERE locationId=? AND productId=?")
    .bind(loc, pid).first();

  if (existing) {
    await env.DB.prepare("UPDATE inventory SET quantity=? WHERE id=?")
      .bind(existing.quantity + qty, existing.id).run();
  } else {
    await env.DB.prepare("INSERT INTO inventory(locationId, productId, quantity) VALUES (?,?,?)")
      .bind(loc, pid, qty).run();
  }

  await addHistory(env, "ENTRADA", `+${qty} caixas de ${productName || pid} em ${loc}`);
  return Response.json({ ok: true });
}
