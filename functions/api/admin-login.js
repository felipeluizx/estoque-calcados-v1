const SESSION_TTL_SECONDS = 60 * 60 * 24;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
    },
  });

async function ensureSessionTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      username TEXT,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`DELETE FROM admin_sessions WHERE expires_at <= ?`).bind(Math.floor(Date.now() / 1000)).run();
}

export const onRequestPost = async ({ request, env }) => {
  try {
    const adminPassword = env?.ADMIN_PASSWORD;
    const adminUsername = env?.ADMIN_USERNAME || env?.ADMIN_USER || "";
    const db = env?.DB;

    if (!adminPassword) return json({ ok: false, error: "ADMIN_PASSWORD não configurado no Preview." }, 500);
    if (!db) return json({ ok: false, error: "Binding D1 'DB' não configurado no Preview." }, 500);

    let body = {};
    try { body = await request.json(); }
    catch { return json({ ok: false, error: "JSON inválido." }, 400); }

    const providedPassword = String(body?.password || "");
    const providedUser = String(body?.username || "").trim();

    if (!providedPassword) return json({ ok: false, error: "Senha obrigatória." }, 400);
    if (adminUsername && !providedUser) return json({ ok: false, error: "Usuário obrigatório." }, 400);
    if (adminUsername && providedUser !== adminUsername) return json({ ok: false, error: "Usuário ou senha incorretos." }, 401);
    if (providedPassword !== adminPassword) return json({ ok: false, error: "Usuário ou senha incorretos." }, 401);

    await ensureSessionTable(db);
    const token = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    await db.prepare(`INSERT INTO admin_sessions (token, username, expires_at) VALUES (?, ?, ?)`)
      .bind(token, providedUser || "admin", expiresAt)
      .run();

    return json({ ok: true, token, expiresIn: SESSION_TTL_SECONDS });
  } catch (err) {
    console.error("[admin-login]", err);
    return json({ ok: false, error: `Falha ao autenticar: ${err?.message || "erro desconhecido"}` }, 500);
  }
};
