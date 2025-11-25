import { loadList } from "../../../lib/separation.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function onRequestGet({ env, params }) {
  try {
    const list = await loadList(env, params.id);
    if (!list) return json({ error: "lista não encontrada" }, 404);
    return json(list);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}

export async function onRequestPut({ request, env, params }) {
  try {
    const listId = params.id;
    const existing = await loadList(env, listId);
    if (!existing) return json({ error: "lista não encontrada" }, 404);

    const payload = await request.json().catch(() => ({}));
    let touched = false;

    if (typeof payload.status === "string") {
      await env.DB.prepare(
        "UPDATE separation_lists SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?"
      )
        .bind(payload.status, listId)
        .run();
      touched = true;
    }

    if (Array.isArray(payload.items)) {
      const updateItem = env.DB.prepare(
        "UPDATE separation_list_items SET separated_qty=?, status=? WHERE id=? AND list_id=?"
      );

      const existingItems = new Map(
        (existing.items || []).map((item) => [item.id, item])
      );

      const statements = [];
      for (const item of payload.items) {
        if (!item || !item.id) continue;
        const current = existingItems.get(item.id);
        const hasSeparatedField =
          item.separatedQty !== undefined || item.separated_qty !== undefined;
        const separatedQty = hasSeparatedField
          ? Number(item.separatedQty ?? item.separated_qty)
          : Number(current?.separated_qty || current?.separatedQty || 0);
        const status = typeof item.status === "string" ? item.status : current?.status;

        if (!status) continue;

        const finalQty = Number.isNaN(separatedQty)
          ? Number(current?.separated_qty || current?.separatedQty || 0)
          : separatedQty;

        statements.push(updateItem.bind(finalQty, status, item.id, listId));
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
        await env.DB.prepare(
          "UPDATE separation_lists SET updated_at=CURRENT_TIMESTAMP WHERE id=?"
        )
          .bind(listId)
          .run();
        touched = true;
      }
    }

    const updated = touched ? await loadList(env, listId) : existing;
    return json(updated);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
