export const onRequestGet = async ({ env }) => {
  const kv = env.estoque; // binding com nome 'estoque'
  // chaves fixas no seu KV
  const [inventoryJson, historyJson, version] = await Promise.all([
    kv.get("inventory"),
    kv.get("history"),
    kv.get("version"),
  ]);

  const inventory = inventoryJson ? JSON.parse(inventoryJson) : [];
  const history   = historyJson ? JSON.parse(historyJson)   : [];

  return new Response(JSON.stringify({
    inventory,
    history,
    version: version || String(Date.now()),
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }
  });
};

export const onRequestPost = async ({ request, env }) => {
  const kv = env.estoque;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];
  const history   = Array.isArray(payload.history)   ? payload.history   : [];

  // gravação atômica “best effort”
  const now = Date.now().toString();
  await Promise.all([
    kv.put("inventory", JSON.stringify(inventory)),
    kv.put("history",   JSON.stringify(history)),
    kv.put("version",   now),
  ]);

  return new Response(JSON.stringify({
    ok: true,
    savedAt: now,
    inventory,
    history,
    version: now,
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }
  });
};
