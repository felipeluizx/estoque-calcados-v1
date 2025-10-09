// functions/api/reset.js
async function addHistoryD1(env, type, details) {
  // Mantém seu histórico também no D1 (como já fazia)
  await env.DB.prepare(
    "INSERT INTO history(date, type, details) VALUES (?, ?, ?)"
  ).bind(new Date().toISOString(), type, details).run();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "pragma": "no-cache",
      "expires": "0",
    },
  });
}

export async function onRequestPost({ env }) {
  // 1) ZERA D1 (como já fazia antes)
  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM inventory"),
      env.DB.prepare("DELETE FROM history"),
    ]);
    await addHistoryD1(env, "RESET", "O estoque foi completamente zerado.");
  } catch (e) {
    // Se D1 não estiver configurado neste ambiente, não falhe o reset global
    console.warn("[reset] D1 cleanup falhou ou não configurado:", e?.message || e);
  }

  // 2) ZERA KV (mantém o snapshot que o front usa)
  try {
    const kv = env.ESTOQUE_DB; // mesmo binding usado em estoque.js
    if (!kv || typeof kv.put !== "function") {
      throw new Error("KV 'ESTOQUE_DB' não encontrado.");
    }

    const resetHistoryKV = [
      {
        date: new Date().toISOString(),
        type: "RESET",
        details: "O estoque foi completamente zerado.",
      },
    ];
    const now = Date.now().toString();

    await Promise.all([
      kv.put("inventory", JSON.stringify([])),
      kv.put("history", JSON.stringify(resetHistoryKV)),
      kv.put("version", now),
    ]);

    return json({
      ok: true,
      reset: true,
      savedAt: now,
      version: now,
      inventory: [],
      history: resetHistoryKV,
      backend: { d1: "cleared", kv: "cleared" },
    });
  } catch (e) {
    // Se KV falhar, é crítico para o front.
    return json({ ok: false, error: "Falha ao resetar KV: " + (e?.message || e) }, 500);
  }
}
