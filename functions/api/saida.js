async function addHistory(env, type, details) {
  await env.DB.prepare(
    "INSERT INTO history(date, type, details) VALUES (?, ?, ?)"
  ).bind(new Date().toISOString(), type, details).run();
}

export async function onRequestPost({ request, env }) {
  const { inventoryId, quantity, productName, locationId } = await request.json().catch(() => ({}));
  if (!inventoryId || !quantity) {
    return new Response(JSON.stringify({ error: "payload inválido" }), { status: 400 });
  }

  const id = Number(inventoryId);
  const qty = Number(quantity);

  const row = await env.DB.prepare("SELECT id, quantity FROM inventory WHERE id=?")
    .bind(id).first();
  if (!row) return new Response(JSON.stringify({ error: "registro não encontrado" }), { status: 404 });

  if (qty >= row.quantity) {
    await env.DB.prepare("DELETE FROM inventory WHERE id=?").bind(row.id).run();
  } else {
    await env.DB.prepare("UPDATE inventory SET quantity=? WHERE id=?")
      .bind(row.quantity - qty, row.id).run();
  }

  await addHistory(env, "SAÍDA", `-${qty} caixas de ${productName || ""} de ${locationId || ""}`);
  return Response.json({ ok: true });
}
