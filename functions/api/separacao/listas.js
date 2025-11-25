import { loadList, loadLists } from "../../lib/separation.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function onRequestGet({ env }) {
  try {
    const lists = await loadLists(env);
    return json(lists);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload.name !== "string" || !Array.isArray(payload.items)) {
      return json({ error: "payload inválido" }, 400);
    }

    const items = payload.items
      .filter((item) => item && item.productId && item.requestedQty)
      .map((item) => ({
        productId: Number(item.productId),
        requestedQty: Number(item.requestedQty),
        separatedQty: Number(item.separatedQty || 0),
        status: typeof item.status === "string" ? item.status : "pending",
      }));

    if (!payload.name.trim() || items.length === 0) {
      return json({ error: "nome e itens são obrigatórios" }, 400);
    }

    const listId = payload.id || crypto.randomUUID();
    const kind = payload.kind === "planned" ? "planned" : "manual";

    await env.DB.prepare(
      "INSERT INTO separation_lists(id, name, status, kind) VALUES (?, ?, 'draft', ?)"
    )
      .bind(listId, payload.name.trim(), kind)
      .run();

    const insertItem = env.DB.prepare(
      "INSERT INTO separation_list_items(list_id, product_id, requested_qty, separated_qty, status) VALUES (?,?,?,?,?)"
    );

    const statements = items.map((item) =>
      insertItem.bind(listId, item.productId, item.requestedQty, item.separatedQty, item.status)
    );

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    const created = await loadList(env, listId);
    return json(created, 201);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
