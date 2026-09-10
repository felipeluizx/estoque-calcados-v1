const SESSION_PREFIX = "admin-session:";

export function getKvBinding(env) {
  const kv = env?.KV_BINDING || env?.ESTOQUE_DB;
  if (!kv || typeof kv.get !== "function") {
    throw new Error("Binding KV (KV_BINDING/ESTOQUE_DB) não encontrado.");
  }
  return kv;
}

export async function requireAdmin(request, env) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  const kv = getKvBinding(env);
  return Boolean(await kv.get(`${SESSION_PREFIX}${token}`));
}

export function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "Sessão administrativa inválida ou expirada." }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
