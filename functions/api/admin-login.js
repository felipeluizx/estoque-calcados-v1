const SESSION_PREFIX = "admin-session:";
const SESSION_TTL_SECONDS = 60 * 30; // 30 minutos

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });

function getKvBinding(env) {
  const kv = env?.KV_BINDING || env?.ESTOQUE_DB;
  if (!kv || typeof kv.put !== "function") {
    throw new Error("Binding KV (KV_BINDING/ESTOQUE_DB) não encontrado.");
  }
  return kv;
}

export const onRequestPost = async ({ request, env }) => {
  try {
    const adminPassword = env?.ADMIN_PASSWORD;
    if (!adminPassword) {
      return json({ ok: false, error: "ADMIN_PASSWORD não configurado." }, 500);
    }

    let body = {};
    if (request.headers.get("content-type")?.includes("application/json")) {
      try {
        body = await request.json();
      } catch (err) {
        return json({ ok: false, error: "JSON inválido." }, 400);
      }
    }

    const providedPassword = body?.password;
    if (!providedPassword) {
      return json({ ok: false, error: "Campo 'password' é obrigatório." }, 400);
    }

    if (providedPassword !== adminPassword) {
      return json({ ok: false, error: "Senha incorreta." }, 401);
    }

    const kv = getKvBinding(env);
    const token = crypto.randomUUID();
    const key = `${SESSION_PREFIX}${token}`;
    await kv.put(key, JSON.stringify({ createdAt: new Date().toISOString() }), {
      expirationTtl: SESSION_TTL_SECONDS,
    });

    return json({ ok: true, token, expiresIn: SESSION_TTL_SECONDS });
  } catch (err) {
    console.error("[admin-login]", err);
    return json({ ok: false, error: "Falha ao autenticar." }, 500);
  }
};
