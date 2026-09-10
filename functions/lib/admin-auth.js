function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyToken(secret, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), enc.encode(body));
  if (!valid) return false;

  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  const now = Math.floor(Date.now() / 1000);
  return Boolean(payload?.exp && Number(payload.exp) > now && payload?.v === 3);
}

export async function requireAdmin(request, env) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return false;
    const token = authHeader.slice(7).trim();
    const secret = env?.ADMIN_PASSWORD;
    if (!token || !secret) return false;
    return await verifyToken(secret, token);
  } catch {
    return false;
  }
}

export function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "Sessão administrativa inválida ou expirada." }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
