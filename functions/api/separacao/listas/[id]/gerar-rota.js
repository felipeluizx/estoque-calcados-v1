import { loadList } from "../../../../lib/separation.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function onRequestPost({ env, params }) {
  try {
    const listId = params.id;
    const list = await loadList(env, listId);
    if (!list) return json({ error: "lista não encontrada" }, 404);

    const pendingItems = (list.items || []).filter(
      (item) => item.status !== "done" && item.status !== "canceled"
    );

    if (pendingItems.length === 0) {
      return json({ error: "nenhum item pendente para gerar rota" }, 400);
    }

    const inventoryRows = await env.DB.prepare(
      "SELECT id, locationId, productId, quantity FROM inventory WHERE quantity > 0"
    ).all();
    const inventory = inventoryRows?.results || [];

    const routeId = crypto.randomUUID();
    const routeName = `Rota ${list.name}`;
    const tempLocation = `TEMP-${listId}`;
    const finalLocation = `FINAL-${listId}`;
    let stepOrder = 1;

    const stepsToInsert = [];
    const shortages = [];

    for (const item of pendingItems) {
      let remaining = Math.max(
        0,
        Number(item.requested_qty || item.requestedQty || 0) -
          Number(item.separated_qty || item.separatedQty || 0)
      );
      if (!remaining) continue;

      const available = inventory.filter(
        (row) => row.productId === item.product_id && row.quantity > 0
      );

      for (const source of available) {
        if (remaining <= 0) break;
        const take = Math.min(source.quantity, remaining);
        stepsToInsert.push({
          productId: item.product_id,
          quantity: take,
          action: "MOVE_TEMP",
          from: source.locationId,
          to: tempLocation,
          order: stepOrder++,
        });
        stepsToInsert.push({
          productId: item.product_id,
          quantity: take,
          action: "PICK",
          from: tempLocation,
          to: null,
          order: stepOrder++,
        });
        stepsToInsert.push({
          productId: item.product_id,
          quantity: take,
          action: "MOVE_FINAL",
          from: tempLocation,
          to: finalLocation,
          order: stepOrder++,
        });
        remaining -= take;
      }

      if (remaining > 0) {
        shortages.push({ productId: item.product_id, missing: remaining });
      }
    }

    if (stepsToInsert.length === 0) {
      return json({ error: "nenhuma origem disponível para os SKUs solicitados" }, 400);
    }

    await env.DB.prepare(
      "INSERT INTO separation_routes(id, list_id, name, status, kind) VALUES (?, ?, ?, 'pending', 'picking')"
    )
      .bind(routeId, listId, routeName)
      .run();

    const insertStep = env.DB.prepare(
      "INSERT INTO separation_route_steps(route_id, product_id, step_order, quantity, status, action, from_location, to_location) VALUES (?,?,?,?,?,?,?,?)"
    );

    const stepStatements = stepsToInsert.map((step) =>
      insertStep.bind(
        routeId,
        step.productId,
        step.order,
        step.quantity,
        "pending",
        step.action,
        step.from,
        step.to
      )
    );

    await env.DB.batch(stepStatements);

    await env.DB.prepare(
      "UPDATE separation_lists SET status='in_progress', updated_at=CURRENT_TIMESTAMP WHERE id=?"
    )
      .bind(listId)
      .run();

    const updatedList = await loadList(env, listId);
    const createdRoute = updatedList?.routes?.find((r) => r.id === routeId);

    return json({
      route: createdRoute || null,
      shortages,
      list: updatedList,
    });
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}
