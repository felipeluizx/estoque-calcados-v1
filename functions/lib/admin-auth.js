export async function requireAdmin(request, env) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) return false;
    const token = authHeader.slice(7).trim();
    if (!token || !env?.DB) return false;

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        username TEXT,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const row = await env.DB.prepare(`SELECT token, expires_at FROM admin_sessions WHERE token = ? LIMIT 1`)
      .bind(token)
      .first();
    if (!row) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Number(row.expires_at) <= now) {
      await env.DB.prepare(`DELETE FROM admin_sessions WHERE token = ?`).bind(token).run();
      return false;
    }

    return true;
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
