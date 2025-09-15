const json = (obj, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "pragma": "no-cache",
      "expires": "0",
      ...extraHeaders,
    },
  });

function assertKV(env) {
  const kv = env?.ESTOQUE_DB; // usa o binding configurado no Pages
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    throw new Error(
      "KV binding 'ESTOQUE_DB' não encontrado. Verifique Settings → Functions → KV bindings (Production e Preview)."
    );
  }
  return kv;
}

export const onRequestGet = async ({ request, env }) => {
  try {
    const kv = assertKV(env);
    const url = new URL(request.url);

    // Diagnóstico rápido: /api/estoque?op=ping
    if (url.searchParams.get("op") === "ping") {
      const [v, inv, hist] = await Promise.all([
        kv.get("version"),
        kv.get("inventory"),
        kv.get("history"),
      ]);
      return json({
        ok: true,
        message: "Binding OK",
        version: v || null,
        keys: {
          inventory: inv ? "existe" : "ausente",
          history:   hist ? "existe" : "ausente",
        },
      });
    }

    const [inventoryJson, historyJson, version] = await Promise.all([
      kv.get("inventory"),
      kv.get("history"),
      kv.get("version"),
    ]);

    const inventory = inventoryJson ? JSON.parse(inventoryJson) : [];
    const history   = historyJson ? JSON.parse(historyJson)   : [];

    return json({ inventory, history, version: version || String(Date.now()) });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
};

export const onRequestPost = async ({ request, env }) => {
  try {
    const kv = assertKV(env);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido" }, 400);
    }

    if (!("inventory" in payload) || !("history" in payload)) {
      return json({ ok: false, error: "Payload deve conter {inventory, history}" }, 400);
    }

    const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];
    const history   = Array.isArray(payload.history)   ? payload.history   : [];

    const now = Date.now().toString();
    await Promise.all([
      kv.put("inventory", JSON.stringify(inventory)),
      kv.put("history",   JSON.stringify(history)),
      kv.put("version",   now),
    ]);

    return json({ ok: true, savedAt: now, version: now, inventory, history });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
};
