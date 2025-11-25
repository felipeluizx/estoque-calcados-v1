export async function addHistory(env, type, details) {
  await env.DB.prepare(
    "INSERT INTO history(date, type, details) VALUES (?, ?, ?)"
  ).bind(new Date().toISOString(), type, details).run();
}

export async function applyEntry(env, { locationId, productId, quantity }) {
  const existing = await env.DB
    .prepare("SELECT id, quantity FROM inventory WHERE locationId=? AND productId=?")
    .bind(locationId, productId)
    .first();

  if (existing) {
    await env.DB.prepare("UPDATE inventory SET quantity=? WHERE id=?")
      .bind(existing.quantity + quantity, existing.id)
      .run();
    return { ...existing, quantity: existing.quantity + quantity, locationId, productId };
  }

  const result = await env.DB.prepare(
    "INSERT INTO inventory(locationId, productId, quantity) VALUES (?,?,?)"
  ).bind(locationId, productId, quantity).run();

  return { id: result.meta.last_row_id, locationId, productId, quantity };
}

export async function applyExit(env, { inventoryId, quantity }) {
  const row = await env.DB.prepare(
    "SELECT id, locationId, productId, quantity FROM inventory WHERE id=?"
  ).bind(inventoryId).first();

  if (!row) return null;

  if (quantity >= row.quantity) {
    await env.DB.prepare("DELETE FROM inventory WHERE id=?").bind(row.id).run();
    return { ...row, quantity: 0, removed: row.quantity };
  }

  const newQty = row.quantity - quantity;
  await env.DB.prepare("UPDATE inventory SET quantity=? WHERE id=?")
    .bind(newQty, row.id)
    .run();

  return { ...row, quantity: newQty, removed: quantity };
}

export async function applyMove(env, { fromLocationId, toLocationId, productId, quantity }) {
  const fromInventory = await env.DB.prepare(
    "SELECT id, quantity FROM inventory WHERE locationId=? AND productId=?"
  ).bind(fromLocationId, productId).first();

  if (!fromInventory || quantity <= 0 || fromInventory.quantity < quantity) {
    return null;
  }

  if (quantity >= fromInventory.quantity) {
    await env.DB.prepare("DELETE FROM inventory WHERE id=?").bind(fromInventory.id).run();
  } else {
    await env.DB.prepare("UPDATE inventory SET quantity=? WHERE id=?")
      .bind(fromInventory.quantity - quantity, fromInventory.id)
      .run();
  }

  await applyEntry(env, { locationId: toLocationId, productId, quantity });

  return {
    from: { ...fromInventory, locationId: fromLocationId, productId },
    to: { locationId: toLocationId, productId, quantity },
    moved: quantity,
  };
}
