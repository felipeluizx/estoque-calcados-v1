const SESSION_PREFIX = "admin-session:";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export function getKvBinding(env) {
  const kv = env?.KV_BINDING || env?.ESTOQUE_DB;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    throw new Error("KV binding 'KV_BINDING'/'ESTOQUE_DB' não encontrado.");
  }
  return kv;
}

export async function hasValidAdminSession(request, kv) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  const session = await kv.get(`${SESSION_PREFIX}${token}`);
  return Boolean(session);
}

export async function ensureAdminAuth(request, env) {
  const kv = getKvBinding(env);
  const authorized = await hasValidAdminSession(request, kv);
  if (!authorized) {
    return { response: json({ ok: false, error: "Token administrativo inválido ou ausente." }, 401) };
  }
  return { kv };
}
