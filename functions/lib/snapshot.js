export async function readInventory(env) {
  const rows = await env.DB.prepare(
    "SELECT id, locationId, productId, quantity FROM inventory"
  ).all();
  return rows?.results || [];
}

export async function readHistory(env) {
  const rows = await env.DB.prepare(
    "SELECT date, type, details FROM history ORDER BY date ASC"
  ).all();
  return rows?.results || [];
}

export async function refreshKvSnapshot(env, kv) {
  const [inventory, history] = await Promise.all([readInventory(env), readHistory(env)]);
  const now = Date.now().toString();

  await Promise.all([
    kv.put("inventory", JSON.stringify(inventory)),
    kv.put("history", JSON.stringify(history)),
    kv.put("version", now),
  ]);

  return { inventory, history, version: now };
}
